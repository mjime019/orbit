import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSessionGoal, loadGoalWithSteps } from "@/lib/kid-access";
import { buildFileContext } from "@/lib/file-context";
import { callAI, AIUnavailableError } from "@/lib/ai";
import { buildGoalCheckinPrompt } from "@/lib/prompts";
import {
  parseAIResponse,
  AIResponseFormatError,
  GoalCheckinSchema,
} from "@/lib/parse-ai";
import { formatAge } from "@/lib/age";
import { familyFormatDate } from "@/lib/tz";
import { fmtDay, titleKey, type StepKind, type StepStatus } from "@/lib/rituals-goals";

// Writer-tier model (Sonnet 5.5) thinks before answering — give the
// function room beyond the platform default.
export const maxDuration = 60;

const WINDOW_DAYS = 60;

// How a step's state reads to the model, per kind.
const STATE_LABEL: Record<StepKind, Record<StepStatus, string>> = {
  routine: { suggested: "suggested, not started", active: "running", done: "a habit now", dismissed: "" },
  activity: { suggested: "suggested, not tried", active: "on the list", done: "done", dismissed: "" },
  sign: { suggested: "watching for", active: "watching for", done: "seen", dismissed: "" },
};

// "How's it going?" — reads the goal, the plan's state, and the moments
// captured recently, and writes a short honest note. The note lives on the
// goal (not in the kid's file); any new steps arrive as suggestions.
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
  const sinceIso = new Date(
    Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  // select("*") stays resilient if optional observation columns are missing.
  const [fileContext, stepsRes, obsRes] = await Promise.all([
    buildFileContext(child.id),
    sb
      .from("goal_steps")
      .select("*")
      .eq("goal_id", goal.id)
      .order("created_at", { ascending: true }),
    sb
      .from("observations")
      .select("*")
      .eq("child_id", child.id)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);
  if (stepsRes.error || obsRes.error) {
    return NextResponse.json(
      { error: (stepsRes.error ?? obsRes.error)?.message },
      { status: 500 }
    );
  }
  const allSteps = stepsRes.data ?? [];

  const planText = allSteps
    .filter((s) => s.status !== "dismissed")
    .map((s) => {
      const state = STATE_LABEL[s.kind as StepKind][s.status as StepStatus];
      const cadence = s.cadence ? ` (${s.cadence})` : "";
      const when = s.done_on ? ` — ${fmtDay(s.done_on)}` : "";
      return `[${s.kind} · ${state}] ${s.title}${cadence}${when}`;
    })
    .join("\n");

  const obsText = (obsRes.data ?? [])
    .map(
      (o: { created_at: string; source?: string; note: string }) =>
        `[${familyFormatDate(o.created_at)}] (${o.source === "parent" ? "parent" : "teacher"}) ${o.note}`
    )
    .join("\n");

  const longDate: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
    year: "numeric",
  };
  const prompt = buildGoalCheckinPrompt({
    childName: child.name,
    ageLabel: formatAge(child.date_of_birth) || "unknown age",
    goalTitle: goal.title,
    goalWhy: goal.why,
    goalHorizon: goal.horizon,
    startedLabel: familyFormatDate(goal.created_at, longDate),
    planText,
    todayLabel: familyFormatDate(new Date(), { weekday: "long", ...longDate }),
  });
  const userMessage = `${fileContext || "File is empty — nothing seeded yet."}\n\nMOMENTS CAPTURED IN THE LAST ${WINDOW_DAYS} DAYS:\n${obsText || "None captured."}`;

  let checkin;
  try {
    const result = await callAI(prompt, userMessage, {
      promptType: "goal_checkin",
      maxOutputTokens: 1200,
    });
    checkin = parseAIResponse(result.text, GoalCheckinSchema);
  } catch (err) {
    const message =
      err instanceof AIResponseFormatError
        ? "The check-in didn't come back readable — try again."
        : err instanceof Error
          ? err.message
          : "AI service unavailable";
    const status = err instanceof AIUnavailableError ? err.status : 502;
    return NextResponse.json({ error: message }, { status });
  }

  const { error: upError } = await sb
    .from("kid_goals")
    .update({
      checkin: {
        note: checkin.note.trim(),
        evidence: checkin.evidence.map((e) => e.trim()).filter(Boolean).slice(0, 3),
        nudge: checkin.nudge?.trim() || null,
      },
      checkin_at: new Date().toISOString(),
    })
    .eq("id", goal.id);
  if (upError) {
    return NextResponse.json({ error: upError.message }, { status: 500 });
  }

  // New steps join the plan as suggestions — never duplicates of anything
  // already there, including what the parents passed on.
  const known = new Set(allSteps.map((s) => titleKey(s.title)));
  const additions = checkin.suggested_steps
    .filter((s) => s.title.trim() && !known.has(titleKey(s.title)))
    .slice(0, 2);
  let warning: string | undefined;
  if (additions.length > 0) {
    const { error: insError } = await sb.from("goal_steps").insert(
      additions.map((s) => ({
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
      warning = `The check-in saved, but its new step ideas didn't: ${insError.message}`;
    }
  }

  return NextResponse.json({ goal: await loadGoalWithSteps(goal.id), warning });
}
