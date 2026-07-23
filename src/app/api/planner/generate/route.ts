import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSessionProfile } from "@/lib/session";
import { getParentChildren } from "@/lib/queries";
import { buildFileContext } from "@/lib/file-context";
import { callAI, AIUnavailableError } from "@/lib/ai";
import { buildPlannerPrompt, type PlannerKind } from "@/lib/prompts";
import { familyFormatDate, familySeasonLabel } from "@/lib/tz";

const KINDS = new Set<PlannerKind>(["activity", "weekend", "extracurricular"]);

// Generate fresh planner ideas. Per-kid for activity/extracurricular;
// family-wide (child_id null) for weekend. Prior "suggested" rows for the
// same scope are replaced; saved/done/dismissed history is kept.
export async function POST(request: NextRequest) {
  const { kind, childId } = (await request.json()) as {
    kind?: PlannerKind;
    childId?: string;
  };
  if (!kind || !KINDS.has(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  const { profileId } = await getSessionProfile();
  const kids = await getParentChildren(profileId);
  const isFamily = kind === "weekend";

  let prompt: string;
  const timeCtx = {
    todayLabel: familyFormatDate(new Date(), {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    seasonLabel: familySeasonLabel(),
  };

  let scopeChildId: string | null = null;
  if (isFamily) {
    if (kids.length === 0) {
      return NextResponse.json({ error: "No kids on file" }, { status: 400 });
    }
    const contexts = await Promise.all(kids.map((k) => buildFileContext(k.id)));
    prompt = buildPlannerPrompt("weekend", {
      crewContexts: contexts.filter(Boolean).join("\n\n---\n\n"),
      ...timeCtx,
    });
  } else {
    const child = kids.find((k) => k.id === childId);
    if (!child) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    scopeChildId = child.id;
    const fileContext = await buildFileContext(child.id);
    prompt = buildPlannerPrompt(kind, {
      childName: child.name,
      fileContext: fileContext || "File is empty — nothing seeded yet.",
      ...timeCtx,
    });
  }

  let items: Record<string, unknown>[];
  try {
    const result = await callAI(prompt, "Generate the ideas now.", {
      maxOutputTokens: 1800,
    });
    const cleaned = result.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    const parsed = JSON.parse(
      start !== -1 && end > start ? cleaned.slice(start, end + 1) : cleaned
    );
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("No ideas came back — try again.");
    }
    items = parsed;
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI service unavailable";
    const status = err instanceof AIUnavailableError ? err.status : 502;
    return NextResponse.json({ error: message }, { status });
  }

  const sb = await createServerSupabase();

  // Replace prior suggestions for this scope (saved/done/dismissed stay).
  let del = sb.from("planner_ideas").delete().eq("kind", kind).eq("status", "suggested");
  del = scopeChildId ? del.eq("child_id", scopeChildId) : del.is("child_id", null);
  const { error: delError } = await del;
  if (delError) {
    return NextResponse.json(
      { error: `Couldn't save ideas: ${delError.message}. Has scripts/pivot/08-round3.sql been run?` },
      { status: 500 }
    );
  }

  const rows = items.slice(0, 6).map((item) => ({
    kind,
    child_id: scopeChildId,
    title: String(item.title ?? item.category ?? "Idea").slice(0, 120),
    payload: item,
    status: "suggested",
    created_by: profileId,
  }));
  const { data: inserted, error: insError } = await sb
    .from("planner_ideas")
    .insert(rows)
    .select();
  if (insError) {
    return NextResponse.json({ error: insError.message }, { status: 500 });
  }

  return NextResponse.json({ ideas: inserted });
}
