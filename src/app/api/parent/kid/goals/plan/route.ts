import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSessionGoal, loadGoalWithSteps } from "@/lib/kid-access";
import { buildFileContext } from "@/lib/file-context";
import { callAI, AIUnavailableError } from "@/lib/ai";
import { buildGoalPlanPrompt } from "@/lib/prompts";
import {
  parseAIResponse,
  AIResponseFormatError,
  GoalPlanSchema,
} from "@/lib/parse-ai";
import { formatAge } from "@/lib/age";
import { familyFormatDate } from "@/lib/tz";
import { titleKey } from "@/lib/rituals-goals";

// Writer-tier model (Sonnet 5.5) thinks before answering — give the
// function room beyond the platform default.
export const maxDuration = 60;

// Turn a parent-defined goal into steps: routines, things to try, signs to
// notice. Everything arrives as a suggestion; prior AI suggestions are
// replaced, and anything the parents took on, finished, or wrote is kept.
export async function POST(request: NextRequest) {
  const { goalId } = (await request.json()) as { goalId?: string };
  const { goal, child, error: loadError } = await getSessionGoal(goalId);
  if (loadError) {
    return NextResponse.json({ error: loadError }, { status: 500 });
  }
  if (!goal || !child) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sb = await createServerSupabase();
  const { data: existing, error: existingError } = await sb
    .from("goal_steps")
    .select("title, kind, status")
    .eq("goal_id", goal.id);
  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }
  const rows = existing ?? [];
  const inPlay = rows.filter((r) => r.status === "active" || r.status === "done");

  const fileContext = await buildFileContext(child.id);
  const prompt = buildGoalPlanPrompt({
    childName: child.name,
    ageLabel: formatAge(child.date_of_birth) || "unknown age",
    goalTitle: goal.title,
    goalWhy: goal.why,
    goalHorizon: goal.horizon,
    fileContext: fileContext || "File is empty — nothing seeded yet.",
    inPlay: inPlay.map((r) => `${r.title} (${r.kind}${r.status === "done" ? ", done" : ""})`),
    passedOn: rows.filter((r) => r.status === "dismissed").map((r) => r.title),
    todayLabel: familyFormatDate(new Date(), {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  });

  let plan;
  try {
    const result = await callAI(prompt, "Build the plan now.", {
      promptType: "goal_plan",
      maxOutputTokens: 1800,
    });
    plan = parseAIResponse(result.text, GoalPlanSchema);
  } catch (err) {
    const message =
      err instanceof AIResponseFormatError
        ? "No plan came back — try again."
        : err instanceof Error
          ? err.message
          : "AI service unavailable";
    const status = err instanceof AIUnavailableError ? err.status : 502;
    return NextResponse.json({ error: message }, { status });
  }

  const taken = new Set(
    rows.filter((r) => r.status !== "suggested").map((r) => titleKey(r.title))
  );
  const fresh = plan.steps
    .filter((s) => s.title.trim() && !taken.has(titleKey(s.title)))
    .slice(0, 9);
  if (fresh.length === 0) {
    return NextResponse.json(
      { error: "Nothing new came back — try again." },
      { status: 502 }
    );
  }

  const { error: delError } = await sb
    .from("goal_steps")
    .delete()
    .eq("goal_id", goal.id)
    .eq("status", "suggested")
    .eq("source", "ai");
  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  const { error: insError } = await sb.from("goal_steps").insert(
    fresh.map((s) => ({
      goal_id: goal.id,
      kind: s.kind,
      title: s.title.trim().slice(0, 160),
      detail: s.detail,
      cadence: s.kind === "routine" ? s.cadence : null,
      status: "suggested",
      source: "ai",
    }))
  );
  if (insError) {
    return NextResponse.json({ error: insError.message }, { status: 500 });
  }

  if (plan.approach.trim()) {
    const { error: upError } = await sb
      .from("kid_goals")
      .update({ approach: plan.approach.trim() })
      .eq("id", goal.id);
    if (upError) {
      return NextResponse.json({ error: upError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ goal: await loadGoalWithSteps(goal.id) });
}
