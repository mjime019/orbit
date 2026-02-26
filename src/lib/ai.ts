import { GoogleGenAI } from "@google/genai";
import { generateMockResponse } from "./ai-mock";

const apiKey = process.env.GEMINI_API_KEY;
const useMock = !apiKey || apiKey === "mock" || apiKey === "";

// Only initialize the real client if we have a key
const ai = useMock ? null : new GoogleGenAI({ apiKey: apiKey! });

export async function callAI(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  // ── No API key → mock mode immediately ──
  if (useMock || !ai) {
    console.log("[AI] No GEMINI_API_KEY — using mock response");
    return generateMockResponse(systemPrompt, userMessage);
  }

  // ── Try the real API ──
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: userMessage,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 1000,
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
      console.warn(
        "[AI] Gemini quota exceeded — falling back to mock response"
      );
      return generateMockResponse(systemPrompt, userMessage);
    }

    // Non-quota errors still throw so the caller can handle them
    throw err;
  }
}
