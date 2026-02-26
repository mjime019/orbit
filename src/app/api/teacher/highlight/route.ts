import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai";
import { buildHighlightPrompt } from "@/lib/prompts";
import { getChildContext } from "@/lib/queries";
import { createServerSupabase } from "@/lib/supabase-server";
import type { HighlightGeneration } from "@/lib/types";

export async function POST(request: NextRequest) {
  const { childId, observationIds } = await request.json();

  if (!childId || !observationIds?.length) {
    return NextResponse.json(
      { error: "Missing childId or observationIds" },
      { status: 400 }
    );
  }

  if (observationIds.length > 3) {
    return NextResponse.json(
      { error: "Select up to 3 observations" },
      { status: 400 }
    );
  }

  const sb = createServerSupabase();

  // Fetch child context + observations in parallel
  const [context, { data: observations }] = await Promise.all([
    getChildContext(childId),
    sb
      .from("observations")
      .select("*")
      .in("id", observationIds)
      .order("created_at", { ascending: true }),
  ]);

  if (!observations?.length) {
    return NextResponse.json(
      { error: "No observations found" },
      { status: 404 }
    );
  }

  const systemPrompt = buildHighlightPrompt({
    schoolName: "Little Explorers Academy",
    childName: context.childName,
    childAge: context.childAge,
    interests: context.interests,
    parentGoals: context.parentGoals,
  });

  const userMessage = JSON.stringify(
    observations.map((o) => ({
      note: o.note,
      domains: o.domains,
      social_tag: o.social_tag,
      date: o.created_at,
    }))
  );

  let rawResponse: string;
  try {
    rawResponse = await callAI(systemPrompt, userMessage);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "AI service unavailable";
    const isRateLimit = message.includes("429") || message.includes("quota");
    return NextResponse.json(
      {
        error: isRateLimit
          ? "AI rate limit reached. Please try again in a few seconds."
          : message,
      },
      { status: isRateLimit ? 429 : 502 }
    );
  }

  let generation: HighlightGeneration;
  try {
    const cleaned = rawResponse
      .replace(/```json?\n?/g, "")
      .replace(/```/g, "")
      .trim();
    generation = JSON.parse(cleaned);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse AI response", raw: rawResponse },
      { status: 502 }
    );
  }

  // Insert as draft highlight
  const { data, error } = await sb
    .from("highlights")
    .insert({
      child_id: childId,
      title: generation.title,
      content: generation.content,
      summary: generation.summary,
      observation_ids: observationIds,
      domains: generation.domains ?? [],
      social_tags: generation.social_tags ?? [],
      status: "draft",
      generated_by: "ai",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
