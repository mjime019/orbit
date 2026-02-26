import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai";
import { buildObservationExtractionPrompt } from "@/lib/prompts";
import { createServerSupabase } from "@/lib/supabase-server";
import type { ObservationExtraction } from "@/lib/types";

export async function POST(request: NextRequest) {
  const { childId, note } = await request.json();

  if (!childId || !note) {
    return NextResponse.json(
      { error: "Missing childId or note" },
      { status: 400 }
    );
  }

  const sb = createServerSupabase();

  // Fetch child + profile + classroom in parallel
  const { data: child } = await sb
    .from("children")
    .select("name, date_of_birth, classroom_id")
    .eq("id", childId)
    .single();

  const [{ data: profile }, { data: classroom }] = await Promise.all([
    sb
      .from("child_profiles")
      .select("interests, parent_goals")
      .eq("child_id", childId)
      .single(),
    sb
      .from("classrooms")
      .select("name")
      .eq("id", child?.classroom_id ?? "")
      .single(),
  ]);

  const age = child?.date_of_birth
    ? Math.floor(
        (Date.now() - new Date(child.date_of_birth).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000)
      )
    : 4;

  const systemPrompt = buildObservationExtractionPrompt({
    schoolName: "Little Explorers Academy",
    childName: child?.name ?? "Child",
    childAge: age,
    classroomName: classroom?.name ?? "Classroom",
    interests: profile?.interests ?? [],
    focusAreas: profile?.parent_goals ?? [],
  });

  let rawResponse: string;
  try {
    rawResponse = await callAI(systemPrompt, note);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "AI service unavailable";
    const isRateLimit = message.includes("429") || message.includes("quota");
    return NextResponse.json(
      { error: isRateLimit ? "AI rate limit reached. Please try again in a few seconds." : message },
      { status: isRateLimit ? 429 : 502 }
    );
  }

  // Parse JSON — Gemini sometimes wraps in markdown code fences
  let extraction: ObservationExtraction;
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
