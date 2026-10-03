import Anthropic from "@anthropic-ai/sdk";
import { generateMockResponse } from "./ai-mock";
import type { PromptType } from "./prompts";
import { FAST_TIER, tierFor, type ModelTier } from "./ai-models";

// Anthropic is the only AI provider. Model choice per job lives in
// ai-models.ts; this file only executes it. (The former Google fallback was
// removed Jul 2026: its model had been retired, and the fallback transmitted
// child data before erroring.)

const anthropicKey = process.env.ANTHROPIC_API_KEY;
const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;

// Mock is opt-in for local dev only (AI_MODE=mock). It is never a silent
// fallback: a real AI failure must surface to the caller, not fabricate
// child-specific content.
const mockMode = process.env.AI_MODE === "mock";

export interface AIResult {
  text: string;
  source: "anthropic" | "mock";
  /** The model that actually produced the text (absent in mock mode). */
  model?: string;
}

export interface CallAIOptions {
  /** Which prompt this is — picks the model tier, and the mock routes on it. */
  promptType: PromptType;
  /** Budget for the VISIBLE reply; thinking headroom is added per tier. */
  maxOutputTokens?: number;
}

export class AIUnavailableError extends Error {
  readonly rateLimited: boolean;
  /** Suggested HTTP status for routes surfacing this error. */
  readonly status: number;

  constructor(message: string, rateLimited = false) {
    super(message);
    this.name = "AIUnavailableError";
    this.rateLimited = rateLimited;
    this.status = rateLimited ? 429 : 502;
  }
}

// The model declined (HTTP 200, stop_reason "refusal") or returned no text.
class AINoAnswerError extends Error {}

type UserContent = string | Anthropic.ContentBlockParam[];

async function runOnTier(
  tier: ModelTier,
  promptType: PromptType,
  systemPrompt: string,
  content: UserContent,
  visibleTokens: number
): Promise<string> {
  const response = await anthropic!.messages.create({
    model: tier.model,
    max_tokens: visibleTokens + tier.thinkingHeadroom,
    system: systemPrompt,
    messages: [{ role: "user", content }],
    // Haiku 4.5 rejects effort; Sonnet 5.5 needs it set explicitly (its
    // default is "high"). Thinking is left at the model default (adaptive).
    ...(tier.effort ? { output_config: { effort: tier.effort } } : {}),
  });

  // Counts only — no prompt or reply content. This is the measurement
  // channel for cost per route (visible in Vercel runtime logs).
  console.info(
    `[AI] ${promptType} model=${response.model} in=${response.usage.input_tokens} out=${response.usage.output_tokens} stop=${response.stop_reason}`
  );

  if (response.stop_reason === "refusal") {
    throw new AINoAnswerError(`${tier.model} declined the request`);
  }
  // Read by block type: a response can begin with (empty) thinking blocks.
  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  if (!text.trim()) {
    throw new AINoAnswerError(
      `${tier.model} returned no text (stop_reason=${response.stop_reason})`
    );
  }
  return text;
}

// Runs the prompt on its tier. If the writer tier fails for ANY reason — a
// refusal, a model/parameter error, its separate rate-limit pool — the same
// request is served once by the fast tier: a real answer from the proven
// model beats an error. The downgrade is loud in logs and visible in
// AIResult.model; nothing is ever fabricated.
async function generate(
  promptType: PromptType,
  systemPrompt: string,
  content: UserContent,
  visibleTokens: number
): Promise<AIResult> {
  if (!anthropic) {
    throw new AIUnavailableError(
      "AI is not configured (ANTHROPIC_API_KEY missing). Set AI_MODE=mock for local development."
    );
  }

  const tier = tierFor(promptType);
  try {
    const text = await runOnTier(tier, promptType, systemPrompt, content, visibleTokens);
    return { text, source: "anthropic", model: tier.model };
  } catch (err) {
    if (tier === FAST_TIER) throw toUnavailable(err);
    console.error(
      `[AI] ${promptType}: ${tier.model} failed (${describe(err)}) — serving from ${FAST_TIER.model}`
    );
    try {
      const text = await runOnTier(FAST_TIER, promptType, systemPrompt, content, visibleTokens);
      return { text, source: "anthropic", model: FAST_TIER.model };
    } catch (fallbackErr) {
      throw toUnavailable(fallbackErr);
    }
  }
}

export async function callAI(
  systemPrompt: string,
  userMessage: string,
  options: CallAIOptions
): Promise<AIResult> {
  if (mockMode) {
    return {
      text: generateMockResponse(options.promptType, systemPrompt, userMessage),
      source: "mock",
    };
  }
  return generate(
    options.promptType,
    systemPrompt,
    userMessage,
    options.maxOutputTokens ?? 1000
  );
}

// Same contract as callAI, but the user turn carries a document (PDF) or
// image content block so Claude reads the actual file. Used by report
// ingestion.
export async function callAIWithDocument(
  systemPrompt: string,
  doc: { base64: string; mediaType: string },
  userMessage: string | undefined,
  options: CallAIOptions
): Promise<AIResult> {
  if (mockMode) {
    return {
      text: generateMockResponse(
        options.promptType,
        systemPrompt,
        userMessage ?? ""
      ),
      source: "mock",
    };
  }

  const fileBlock: Anthropic.ContentBlockParam =
    doc.mediaType === "application/pdf"
      ? {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: doc.base64,
          },
        }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: doc.mediaType as "image/jpeg" | "image/png" | "image/webp",
            data: doc.base64,
          },
        };

  return generate(
    options.promptType,
    systemPrompt,
    [fileBlock, { type: "text", text: userMessage ?? "Read this report." }],
    options.maxOutputTokens ?? 1500
  );
}

function describe(err: unknown): string {
  if (err instanceof Anthropic.APIError) return `API ${err.status}: ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}

// The SDK already retried transient failures (2x) before this throws —
// don't add another retry layer on top.
function toUnavailable(err: unknown): AIUnavailableError {
  if (err instanceof AINoAnswerError) {
    console.error("[AI] no answer:", err.message);
    return new AIUnavailableError(
      "Orbit couldn't produce an answer for that. Please try again."
    );
  }
  const rateLimited = err instanceof Anthropic.RateLimitError;
  console.error("[AI] Anthropic error:", describe(err));
  return new AIUnavailableError(
    rateLimited
      ? "AI rate limit reached. Please try again in a few seconds."
      : "AI service unavailable. Please try again.",
    rateLimited
  );
}
