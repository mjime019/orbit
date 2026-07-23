import { NextRequest, NextResponse } from "next/server";
import { callAI, AIUnavailableError } from "@/lib/ai";
import { buildWhatThisMeansPrompt } from "@/lib/prompts";
import { createServerSupabase } from "@/lib/supabase-server";
import { getChildContext } from "@/lib/queries";
import { formatAge } from "@/lib/age";
import { familyFormatDate } from "@/lib/tz";

// "What this means" summary for the child home page. Cached in
// child_summaries and regenerated only when the observation set changes —
// repeated loads cost zero AI calls.
export async function POST(request: NextRequest) {
  const { childId } = await request.json();
  if (!childId) {
    return NextResponse.json({ error: "Missing childId" }, { status: 400 });
  }

  const sb = await createServerSupabase();

  const [{ count }, { data: latest }] = await Promise.all([
    sb
      .from("observations")
      .select("id", { count: "exact", head: true })
      .eq("child_id", childId),
    sb
      .from("observations")
      .select("created_at")
      .eq("child_id", childId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const observationCount = count ?? 0;
  const latestAt = latest?.[0]?.created_at ?? null;

  if (observationCount === 0) {
    return NextResponse.json({ content: null, pulse: null, cached: true });
  }

  const { data: cachedRow } = await sb
    .from("child_summaries")
    .select("*")
    .eq("child_id", childId)
    .maybeSingle();

  if (
    cachedRow &&
    cachedRow.observation_count === observationCount &&
    cachedRow.latest_observation_at === latestAt &&
    cachedRow.pulse // pre-pulse cache rows regenerate once to gain one
  ) {
    return NextResponse.json({
      content: cachedRow.content,
      pulse: cachedRow.pulse ?? null,
      cached: true,
    });
  }

  // select("*") stays resilient if optional columns (e.g. `source`) are
  // missing — never let a schema mismatch feed the AI an empty prompt.
  const [context, { data: observations, error: obsError }] = await Promise.all([
    getChildContext(childId),
    sb
      .from("observations")
      .select("*")
      .eq("child_id", childId)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  if (obsError) {
    return NextResponse.json(
      { error: `Couldn't load observations: ${obsError.message}` },
      { status: 500 }
    );
  }

  const obsText = (observations ?? [])
    .map(
      (o: { created_at: string; source?: string; note: string }) =>
        `[${familyFormatDate(o.created_at)}] (${o.source === "parent" ? "parent" : "teacher"}) ${o.note}`
    )
    .join("\n");

  if (!obsText.trim()) {
    return NextResponse.json({ content: null, pulse: null, cached: true });
  }

  // One AI call yields both the one-line pulse (home card) and the fuller
  // summary (kid page), cached together under the same staleness key.
  let content: string;
  let pulse: string | null = null;
  try {
    const { data: childRow } = await sb
      .from("children")
      .select("date_of_birth")
      .eq("id", childId)
      .maybeSingle();

    const result = await callAI(
      buildWhatThisMeansPrompt({
        childName: context.childName,
        ageLabel: formatAge(childRow?.date_of_birth ?? null) || `${context.childAge} yr`,
        interests: context.interests,
      }),
      obsText,
      { maxOutputTokens: 500 }
    );
    const cleaned = result.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    try {
      const parsed = JSON.parse(cleaned);
      content = (parsed.summary ?? "").trim();
      pulse = (parsed.pulse ?? "").trim() || null;
    } catch {
      // Model ignored the JSON shape — use the text as the summary, no pulse.
      content = cleaned.replace(/^["']|["']$/g, "").trim();
    }
    if (!content) throw new AIUnavailableError("AI returned an empty summary.");
  } catch (err) {
    // A stale summary beats an error here; only fail when there is nothing.
    if (cachedRow?.content) {
      return NextResponse.json({
        content: cachedRow.content,
        pulse: cachedRow.pulse ?? null,
        cached: true,
        stale: true,
      });
    }
    const message = err instanceof Error ? err.message : "AI service unavailable";
    const status = err instanceof AIUnavailableError ? err.status : 502;
    return NextResponse.json({ error: message }, { status });
  }

  await sb.from("child_summaries").upsert({
    child_id: childId,
    content,
    pulse,
    observation_count: observationCount,
    latest_observation_at: latestAt,
    generated_at: new Date().toISOString(),
  });

  return NextResponse.json({ content, pulse, cached: false });
}
