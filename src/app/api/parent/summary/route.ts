import { NextRequest, NextResponse } from "next/server";
import { callAI, AIUnavailableError } from "@/lib/ai";
import { buildWhatThisMeansPrompt } from "@/lib/prompts";
import { createServerSupabase } from "@/lib/supabase-server";
import { getChildContext } from "@/lib/queries";

// "What this means" summary for the child home page. Cached in
// child_summaries and regenerated only when the observation set changes —
// repeated loads cost zero AI calls.
export async function POST(request: NextRequest) {
  const { childId } = await request.json();
  if (!childId) {
    return NextResponse.json({ error: "Missing childId" }, { status: 400 });
  }

  const sb = createServerSupabase();

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
    return NextResponse.json({ content: null, cached: true });
  }

  const { data: cachedRow } = await sb
    .from("child_summaries")
    .select("*")
    .eq("child_id", childId)
    .maybeSingle();

  if (
    cachedRow &&
    cachedRow.observation_count === observationCount &&
    cachedRow.latest_observation_at === latestAt
  ) {
    return NextResponse.json({ content: cachedRow.content, cached: true });
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
        `[${new Date(o.created_at).toLocaleDateString()}] (${o.source === "parent" ? "parent" : "teacher"}) ${o.note}`
    )
    .join("\n");

  if (!obsText.trim()) {
    return NextResponse.json({ content: null, cached: true });
  }

  let content: string;
  try {
    const result = await callAI(
      buildWhatThisMeansPrompt({
        childName: context.childName,
        childAge: context.childAge,
        interests: context.interests,
      }),
      obsText,
      { maxOutputTokens: 400 }
    );
    content = result.text.replace(/^["']|["']$/g, "").trim();
  } catch (err) {
    // A stale summary beats an error here; only fail when there is nothing.
    if (cachedRow?.content) {
      return NextResponse.json({ content: cachedRow.content, cached: true, stale: true });
    }
    const message = err instanceof Error ? err.message : "AI service unavailable";
    const status = err instanceof AIUnavailableError ? err.status : 502;
    return NextResponse.json({ error: message }, { status });
  }

  await sb.from("child_summaries").upsert({
    child_id: childId,
    content,
    observation_count: observationCount,
    latest_observation_at: latestAt,
    generated_at: new Date().toISOString(),
  });

  return NextResponse.json({ content, cached: false });
}
