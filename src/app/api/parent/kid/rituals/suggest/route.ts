import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSessionKid } from "@/lib/kid-access";
import { buildFileContext } from "@/lib/file-context";
import { callAI, AIUnavailableError } from "@/lib/ai";
import { buildRitualSuggestionsPrompt } from "@/lib/prompts";
import {
  parseAIResponse,
  AIResponseFormatError,
  RitualSuggestionsSchema,
} from "@/lib/parse-ai";
import { formatAge, ageBand } from "@/lib/age";
import { familyFormatDate } from "@/lib/tz";
import { SETUP_SQL, titleKey } from "@/lib/rituals-goals";

// Writer-tier model (Sonnet 5.5) thinks before answering — give the
// function room beyond the platform default.
export const maxDuration = 60;

// Suggest the next responsibilities for one kid, from his age and his file.
// Prior AI suggestions are replaced; anything a parent started, mastered,
// or added themselves is untouched. Suggestions are only offers — nothing
// is "his" until a parent taps Start.
export async function POST(request: NextRequest) {
  const { childId } = (await request.json()) as { childId?: string };
  const { profileId, child } = await getSessionKid(childId);
  if (!child) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sb = await createServerSupabase();

  // Read what exists first — also proves the table is there before an AI
  // call is spent.
  const { data: existing, error: existingError } = await sb
    .from("kid_rituals")
    .select("title, status")
    .eq("child_id", child.id);
  if (existingError) {
    console.warn("[rituals] unavailable:", existingError.message);
    return NextResponse.json(
      { error: `Rituals aren't set up yet — run ${SETUP_SQL} in Supabase.` },
      { status: 500 }
    );
  }
  const rows = existing ?? [];
  const titlesWith = (status: string) =>
    rows.filter((r) => r.status === status).map((r) => r.title as string);

  const fileContext = await buildFileContext(child.id);
  const prompt = buildRitualSuggestionsPrompt({
    childName: child.name,
    ageLabel: formatAge(child.date_of_birth) || "unknown age",
    ageBand: ageBand(child.date_of_birth),
    fileContext: fileContext || "File is empty — nothing seeded yet.",
    onTheTable: titlesWith("suggested"),
    passedOn: titlesWith("dismissed"),
    todayLabel: familyFormatDate(new Date(), {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  });

  let items;
  try {
    const result = await callAI(prompt, "Suggest the next responsibilities now.", {
      promptType: "ritual_suggestions",
      maxOutputTokens: 1500,
    });
    items = parseAIResponse(result.text, RitualSuggestionsSchema);
  } catch (err) {
    const message =
      err instanceof AIResponseFormatError
        ? "No suggestions came back — try again."
        : err instanceof Error
          ? err.message
          : "AI service unavailable";
    const status = err instanceof AIUnavailableError ? err.status : 502;
    return NextResponse.json({ error: message }, { status });
  }

  // Never offer something he already owns, is learning, or was passed on.
  const taken = new Set(
    rows.filter((r) => r.status !== "suggested").map((r) => titleKey(r.title))
  );
  const fresh = items
    .filter((i) => i.title.trim() && !taken.has(titleKey(i.title)))
    .slice(0, 4);
  if (fresh.length === 0) {
    return NextResponse.json(
      { error: "Nothing new came back — try again." },
      { status: 502 }
    );
  }

  const { error: delError } = await sb
    .from("kid_rituals")
    .delete()
    .eq("child_id", child.id)
    .eq("status", "suggested")
    .eq("source", "ai");
  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  const { error: insError } = await sb.from("kid_rituals").insert(
    fresh.map((i) => ({
      child_id: child.id,
      title: i.title.trim().slice(0, 140),
      area: i.area,
      why_now: i.why_now,
      how_to_start: i.how_to_start,
      cadence: i.cadence,
      looks_like_owning_it: i.looks_like_owning_it,
      status: "suggested",
      source: "ai",
      created_by: profileId,
    }))
  );
  if (insError) {
    return NextResponse.json({ error: insError.message }, { status: 500 });
  }

  const { data: rituals, error: listError } = await sb
    .from("kid_rituals")
    .select("*")
    .eq("child_id", child.id)
    .neq("status", "dismissed")
    .order("created_at", { ascending: true });
  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }
  return NextResponse.json({ rituals: rituals ?? [] });
}
