import { NextRequest, NextResponse } from "next/server";
import { callAI, AIUnavailableError } from "@/lib/ai";
import { buildChapterPrompt } from "@/lib/prompts";
import { createServerSupabase } from "@/lib/supabase-server";
import { getLatestJourneyChapter } from "@/lib/queries";
import { ageBand, formatAge } from "@/lib/age";
import { familyFormatDate, familySeasonLabel } from "@/lib/tz";

const VALID_DOMAINS = new Set([
  "language", "motor_fine", "motor_gross", "social_emotional", "cognitive", "creative",
]);
const MIN_NEW_OBSERVATIONS = 3;

// "Write the next chapter": distills the observations since the last chapter
// into a JourneyChapter row. Age-aware framing; anchored only in real
// observations; the previous chapter yields is_current.
export async function POST(request: NextRequest) {
  const { childId } = await request.json();
  if (!childId) {
    return NextResponse.json({ error: "Missing childId" }, { status: 400 });
  }

  const sb = await createServerSupabase();

  const [{ data: child }, lastChapter] = await Promise.all([
    sb
      .from("children")
      .select("name, date_of_birth")
      .eq("id", childId)
      .maybeSingle(),
    getLatestJourneyChapter(childId),
  ]);
  if (!child) {
    return NextResponse.json({ error: "Child not found" }, { status: 404 });
  }

  const sinceIso: string | null = lastChapter?.created_at ?? null;
  let obsQuery = sb
    .from("observations")
    .select("note, domains, social_tag, source, created_at")
    .eq("child_id", childId)
    .order("created_at", { ascending: true })
    .limit(40);
  if (sinceIso) obsQuery = obsQuery.gt("created_at", sinceIso);
  const { data: observations, error: obsError } = await obsQuery;
  if (obsError) {
    return NextResponse.json({ error: obsError.message }, { status: 500 });
  }

  const count = observations?.length ?? 0;
  if (count < MIN_NEW_OBSERVATIONS) {
    return NextResponse.json(
      {
        error: `Only ${count} new moment${count === 1 ? "" : "s"} since the last chapter — capture a few more first.`,
        count,
      },
      { status: 409 }
    );
  }

  const { data: profileRow } = await sb
    .from("child_profiles")
    .select("interests")
    .eq("child_id", childId)
    .maybeSingle();

  const obsText = (observations ?? [])
    .map(
      (o) =>
        `[${familyFormatDate(o.created_at)}] (${o.source === "parent" ? "parent" : "teacher"}) ${o.note}`
    )
    .join("\n");

  let parsed: Record<string, unknown>;
  try {
    const result = await callAI(
      buildChapterPrompt({
        childName: child.name,
        ageLabel: formatAge(child.date_of_birth) || "young",
        ageBand: ageBand(child.date_of_birth),
        periodLabel: familySeasonLabel(),
        interests: profileRow?.interests ?? [],
      }),
      obsText,
      { maxOutputTokens: 1200 }
    );
    const cleaned = result.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    parsed = JSON.parse(start !== -1 && end > start ? cleaned.slice(start, end + 1) : cleaned);
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI service unavailable";
    const status = err instanceof AIUnavailableError ? err.status : 503;
    return NextResponse.json({ error: message }, { status });
  }

  if (!parsed.title || !parsed.summary) {
    return NextResponse.json(
      { error: "The chapter came back incomplete — try again." },
      { status: 502 }
    );
  }

  const row = {
    child_id: childId,
    period: String(parsed.period ?? familySeasonLabel()),
    age_label: String(parsed.age_label ?? formatAge(child.date_of_birth)),
    title: String(parsed.title),
    emoji: String(parsed.emoji ?? "🌱"),
    is_current: true,
    observation_count: count,
    top_domains: (Array.isArray(parsed.top_domains) ? parsed.top_domains : [])
      .filter((d) => VALID_DOMAINS.has(String(d)))
      .slice(0, 3),
    summary: String(parsed.summary),
    highlight_text: parsed.highlight_text ? String(parsed.highlight_text) : null,
    highlight_icon: parsed.highlight_icon ? String(parsed.highlight_icon) : null,
    breakthrough_text: parsed.breakthrough_text ? String(parsed.breakthrough_text) : null,
    breakthrough_icon: parsed.breakthrough_icon ? String(parsed.breakthrough_icon) : null,
    emerging: Array.isArray(parsed.emerging) ? parsed.emerging.map(String) : [],
    friends: Array.isArray(parsed.friends) ? parsed.friends.map(String) : [],
    parent_note: parsed.parent_note ? String(parsed.parent_note) : null,
  };

  const { data: inserted, error: insertError } = await sb
    .from("journey_chapters")
    .insert(row)
    .select()
    .single();
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // De-current the previous chapter (best effort; the new row is in).
  if (lastChapter?.id) {
    await sb
      .from("journey_chapters")
      .update({ is_current: false })
      .eq("id", lastChapter.id);
  }

  return NextResponse.json({ chapter: inserted });
}
