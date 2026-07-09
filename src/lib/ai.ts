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
    // The SDK already retried transient failures (2x) before this throws —
    // don't add another retry layer on top.
    const rateLimited =
      err instanceof Anthropic.APIError && err.status === 429;
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[AI] Anthropic error:", detail);
    throw new AIUnavailableError(
      rateLimited
        ? "AI rate limit reached. Please try again in a few seconds."
        : "AI service unavailable. Please try again.",
      rateLimited
    );
  }
}
