import { NextRequest, NextResponse } from "next/server";
import { callAI, AIUnavailableError } from "@/lib/ai";
import { buildDigestPrompt } from "@/lib/prompts";
import { getChildContext } from "@/lib/queries";
import { createServerSupabase } from "@/lib/supabase-server";
import type { DigestGeneration } from "@/lib/types";

export async function POST(request: NextRequest) {
  const { childId, periodStart, periodEnd } = await request.json();

  if (!childId || !periodStart || !periodEnd) {
    return NextResponse.json(
      { error: "Missing childId, periodStart, or periodEnd" },
      { status: 400 }
    );
  }

  const sb = await createServerSupabase();

  // Fetch child context + observations + sent highlights in the date range
  const [context, { data: observations }, { data: highlights }] =
    await Promise.all([
      getChildContext(childId),
      sb
        .from("observations")
        .select("*")
        .eq("child_id", childId)
        .gte("created_at", periodStart)
        .lte("created_at", periodEnd + "T23:59:59Z")
        .order("created_at", { ascending: true }),
      sb
        .from("highlights")
        .select("*")
        .eq("child_id", childId)
        .eq("status", "sent")
        .gte("created_at", periodStart)
        .lte("created_at", periodEnd + "T23:59:59Z")
        .order("created_at", { ascending: true }),
    ]);

  const obs = observations ?? [];
  const hls = highlights ?? [];

  if (obs.length === 0) {
    return NextResponse.json(
      { error: "No observations found for this period" },
      { status: 404 }
    );
  }

  const systemPrompt = buildDigestPrompt({
    schoolName: "Little Explorers Academy",
    childName: context.childName,
    childAge: context.childAge,
    interests: context.interests,
    classroomTheme: context.classroomTheme,
    parentGoals: context.parentGoals,
  });

  const userMessage = JSON.stringify({
    observations: obs.map((o) => ({
      note: o.note,
      domains: o.domains,
      social_tag: o.social_tag,
      date: o.created_at,
    })),
    highlights: hls.map((h) => ({
      title: h.title,
      content: h.content,
      domains: h.domains,
    })),
  });

  let rawResponse: string;
  try {
    ({ text: rawResponse } = await callAI(systemPrompt, userMessage));
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "AI service unavailable";
    const status = err instanceof AIUnavailableError ? err.status : 502;
    return NextResponse.json({ error: message }, { status });
  }

  let generation: DigestGeneration;
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

  // Insert as draft digest
  const { data, error } = await sb
    .from("digests")
    .insert({
      child_id: childId,
      digest_type: "weekly",
      period_start: periodStart,
      period_end: periodEnd,
      title: generation.title,
      content: generation.content,
      observation_ids: obs.map((o) => o.id),
      highlight_ids: hls.map((h) => h.id),
      domains_covered: generation.domains_covered ?? [],
      status: "draft",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
