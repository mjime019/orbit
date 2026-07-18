import { NextRequest, NextResponse } from "next/server";
import { callAI, AIUnavailableError } from "@/lib/ai";
import { buildOnboardingExtractionPrompt } from "@/lib/prompts";
import { createServerSupabase } from "@/lib/supabase-server";
import type { OnboardingExtraction } from "@/lib/types";
import { formatAge } from "@/lib/age";

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

  const systemPrompt = buildOnboardingExtractionPrompt({
    promptText: promptText ?? promptKey,
    promptCategory: promptCategory ?? "interests",
    childName: child?.name ?? "Child",
    ageLabel: formatAge(child?.date_of_birth ?? null) || "preschool age",
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

  // Parse JSON response — tolerate fences and prose preambles by taking the
  // outermost {...} block.
  let extraction: OnboardingExtraction;
  try {
    const cleaned = rawResponse
      .replace(/```json?\n?/g, "")
      .replace(/```/g, "")
      .trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    const jsonBlock =
      start !== -1 && end > start ? cleaned.slice(start, end + 1) : cleaned;
    extraction = JSON.parse(jsonBlock);
  } catch {
    return NextResponse.json(
      { error: "Couldn't structure that answer — try once more.", raw: rawResponse },
      { status: 502 }
    );
  }

  return NextResponse.json(extraction);
}
