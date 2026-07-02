import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { generateMockResponse } from "./ai-mock";

// ── Anthropic (primary) ──
const anthropicKey = process.env.ANTHROPIC_API_KEY;
const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;

// ── Gemini (fallback) ──
const geminiKey = process.env.GEMINI_API_KEY;
const gemini =
  geminiKey && geminiKey !== "mock" && geminiKey !== ""
    ? new GoogleGenAI({ apiKey: geminiKey })
    : null;

export async function callAI(
  systemPrompt: string,
  userMessage: string,
  options?: { maxOutputTokens?: number }
): Promise<string> {
  const maxTokens = options?.maxOutputTokens ?? 1000;

  // ── Try Anthropic first (Claude Haiku 3.5) ──
  if (anthropic) {
    try {
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });
      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
      return text;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[AI] Anthropic error, trying Gemini fallback:", message);
      // Fall through to Gemini
    }
  }

  // ── Try Gemini (fallback) ──
  if (gemini) {
    try {
      const response = await gemini.models.generateContent({
        model: "gemini-2.0-flash",
        contents: userMessage,
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: maxTokens,
        },
      });
      return response.text ?? "";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isQuotaError =
        message.includes("429") ||
        message.includes("quota") ||
        message.includes("RESOURCE_EXHAUSTED") ||
        message.includes("rate limit");

      if (isQuotaError) {
        console.warn("[AI] Gemini quota exceeded — falling back to mock");
      } else {
        console.warn("[AI] Gemini error:", message);
      }
      // Fall through to mock
    }
  }

  // ── Mock (last resort) ──
  console.log("[AI] Using mock response");
  return generateMockResponse(systemPrompt, userMessage);
}
