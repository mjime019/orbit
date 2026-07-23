import Anthropic from "@anthropic-ai/sdk";
import { generateMockResponse } from "./ai-mock";

// Claude Haiku 4.5 — the only AI provider. (The former Google fallback was
// removed Jul 2026: its model had been retired, and the fallback transmitted
// child data before erroring.)
const MODEL = "claude-haiku-4-5-20251001";

const anthropicKey = process.env.ANTHROPIC_API_KEY;
const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;

// Mock is opt-in for local dev only (AI_MODE=mock). It is never a silent
// fallback: a real AI failure must surface to the caller, not fabricate
// child-specific content.
const mockMode = process.env.AI_MODE === "mock";

export interface AIResult {
  text: string;
  source: "anthropic" | "mock";
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

export async function callAI(
  systemPrompt: string,
  userMessage: string,
  options?: { maxOutputTokens?: number }
): Promise<AIResult> {
  if (mockMode) {
    return {
      text: generateMockResponse(systemPrompt, userMessage),
      source: "mock",
    };
  }

  if (!anthropic) {
    throw new AIUnavailableError(
      "AI is not configured (ANTHROPIC_API_KEY missing). Set AI_MODE=mock for local development."
    );
  }

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: options?.maxOutputTokens ?? 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    return { text, source: "anthropic" };
  } catch (err) {
    throw toUnavailable(err);
  }
}

// Same contract as callAI, but the user turn carries a document (PDF) or
// image content block so Claude reads the actual file. Used by report
// ingestion.
export async function callAIWithDocument(
  systemPrompt: string,
  doc: { base64: string; mediaType: string },
  userMessage?: string,
  options?: { maxOutputTokens?: number }
): Promise<AIResult> {
  if (mockMode) {
    return {
      text: JSON.stringify({
        summary: "Mock report summary (AI_MODE=mock).",
        strengths: ["Mock strength"],
        growth_areas: ["Mock growth area"],
        notable_quotes: [],
        suggested_file_updates: {},
      }),
      source: "mock",
    };
  }

  if (!anthropic) {
    throw new AIUnavailableError(
      "AI is not configured (ANTHROPIC_API_KEY missing). Set AI_MODE=mock for local development."
    );
  }

  const fileBlock =
    doc.mediaType === "application/pdf"
      ? {
          type: "document" as const,
          source: {
            type: "base64" as const,
            media_type: "application/pdf" as const,
            data: doc.base64,
          },
        }
      : {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: doc.mediaType as "image/jpeg" | "image/png" | "image/webp",
            data: doc.base64,
          },
        };

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: options?.maxOutputTokens ?? 1500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            fileBlock,
            { type: "text", text: userMessage ?? "Read this report." },
          ],
        },
      ],
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    return { text, source: "anthropic" };
  } catch (err) {
    throw toUnavailable(err);
  }
}

// The SDK already retried transient failures (2x) before this throws —
// don't add another retry layer on top.
function toUnavailable(err: unknown): AIUnavailableError {
  const rateLimited = err instanceof Anthropic.APIError && err.status === 429;
  const detail = err instanceof Error ? err.message : String(err);
  console.error("[AI] Anthropic error:", detail);
  return new AIUnavailableError(
    rateLimited
      ? "AI rate limit reached. Please try again in a few seconds."
      : "AI service unavailable. Please try again.",
    rateLimited
  );
}
