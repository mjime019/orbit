import { NextRequest, NextResponse } from "next/server";
import { callAI, AIUnavailableError } from "@/lib/ai";
import { buildOnboardingExtractionPrompt } from "@/lib/prompts";
import { createServerSupabase } from "@/lib/supabase-server";
import type { OnboardingExtraction } from "@/lib/types";

export async function POST(request: NextRequest) {
  const { childId, promptKey, promptText, promptCategory, response } =
    await request.json();

  if (!childId || !promptKey || !response) {
    return NextResponse.json(
      { error: "Missing childId, promptKey, or response" },
      { status: 400 }
    );
  }

  // Fetch child info for prompt context
  const sb = await createServerSupabase();
  const { data: child } = await sb
    .from("children")
    .select("name, date_of_birth")
    .eq("id", childId)
    .single();

  const age = child?.date_of_birth
    ? Math.floor(
        (Date.now() - new Date(child.date_of_birth).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000)
      )
    : 4;

  const systemPrompt = buildOnboardingExtractionPrompt({
    promptText: promptText ?? promptKey,
    promptCategory: promptCategory ?? "interests",
    childName: child?.name ?? "Child",
    childAge: age,
  });

  let rawResponse: string;
  try {
    ({ text: rawResponse } = await callAI(systemPrompt, response));
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "AI service unavailable";
    const status = err instanceof AIUnavailableError ? err.status : 502;
    return NextResponse.json({ error: message }, { status });
  }

  // Parse JSON response
  let extraction: OnboardingExtraction;
  try {
    const cleaned = rawResponse
      .replace(/```json?\n?/g, "")
      .replace(/```/g, "")
      .trim();
    extraction = JSON.parse(cleaned);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse AI response", raw: rawResponse },
      { status: 502 }
    );
  }

  return NextResponse.json(extraction);
}
