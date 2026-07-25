import { NextRequest, NextResponse } from "next/server";
import { callAI, AIUnavailableError } from "@/lib/ai";
import { buildHighlightPrompt } from "@/lib/prompts";
import { parseAIResponse, HighlightGenerationSchema } from "@/lib/parse-ai";
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

  const sb = await createServerSupabase();

  // Fetch child context + observations in parallel
  const [context, { data: observations }] = await Promise.all([
    getChildContext(childId),
    sb
      .from("observations")
      .select("*")
      .in("id", observationIds)
      // Scope to the child: ids from another child's feed must not leak
      // into this highlight (DD audit finding 5).
      .eq("child_id", childId)
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
    ({ text: rawResponse } = await callAI(systemPrompt, userMessage, {
      promptType: "highlight",
    }));
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "AI service unavailable";
    const status = err instanceof AIUnavailableError ? err.status : 502;
    return NextResponse.json({ error: message }, { status });
  }

  let generation: HighlightGeneration;
  try {
    generation = parseAIResponse(rawResponse, HighlightGenerationSchema);
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
