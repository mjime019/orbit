"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { familyFormatDate } from "@/lib/tz";
import { kidText } from "@/lib/kid-colors";
import {
  SETUP_SQL,
  STEP_KINDS,
  fmtDay,
  type Goal,
  type GoalStatus,
  type GoalStep,
  type StepKind,
  type StepStatus,
} from "@/lib/rituals-goals";

// Long-term goals: the parents name what they want for a kid; Orbit turns
// it into routines, things to try, and signs to notice, then checks in
// against captured moments. Everything Orbit proposes is dashed until a
// parent takes it on — and progress is described, never scored.

const KIND_META: Record<
  StepKind,
  {
    emoji: string;
    heading: string;
    short: string;
    takeOn: string | null;
    done: string;
    doneNote: string;
    empty: string;
  }
> = {
  routine: {
    emoji: "🔁",
    heading: "Routines",
    short: "Routine",
    takeOn: "Start it",
    done: "It's a habit",
    doneNote: "A habit since",
    empty: "No routines yet.",
  },
  activity: {
    emoji: "🧪",
    heading: "To try",
    short: "To try",
    takeOn: "Add to our list",
    done: "Did it",
    doneNote: "Done",
    empty: "Nothing to try yet.",
  },
  sign: {
    emoji: "👀",
    heading: "Signs it's taking root",
    short: "Sign",
    takeOn: null,
    done: "Seen it",
    doneNote: "Seen",
    empty: "No signs to watch for yet.",
  },
};

const STATUS_ORDER: Record<StepStatus, number> = {
  active: 0,
  suggested: 1,
  done: 2,
  dismissed: 3,
};

const STALE_CHECKIN_DAYS = 21;

function progressParts(steps: GoalStep[]): string[] {
  const count = (kind: StepKind, ...statuses: StepStatus[]) =>
    steps.filter((s) => s.kind === kind && statuses.includes(s.status)).length;
  const parts: string[] = [];
  const running = count("routine", "active");
  const habits = count("routine", "done");
  if (running) parts.push(`${running} routine${running === 1 ? "" : "s"} running`);
  if (habits) parts.push(`${habits} now a habit`);
  const activities = count("activity", "suggested", "active", "done");
  if (activities) parts.push(`${count("activity", "done")} of ${activities} tried`);
  const signs = count("sign", "suggested", "active", "done");
  if (signs) parts.push(`${count("sign", "done")} of ${signs} signs seen`);
  return parts;
}

type Working = { id: string; what: "plan" | "checkin" } | null;

export function GoalsTab({
  childId,
  childName,
  kidIndex,
}: {
  childId: string;
  childName: string;
  kidIndex: number;
}) {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState<Working>(null);
  const [form, setForm] = useState({ title: "", why: "", horizon: "" });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/parent/kid/goals?childId=${childId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load goals");
      setGoals(data.goals);
      setHints(data.hints ?? []);
      setUnavailable(Boolean(data.unavailable));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load goals");
      setGoals([]);
    }
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  const replaceGoal = (goal: Goal) =>
    setGoals((prev) => (prev ? prev.map((g) => (g.id === goal.id ? goal : g)) : prev));

  // One AI call at a time: build/refresh a plan, or check in.
  const run = async (id: string, what: "plan" | "checkin") => {
    if (working) return;
    setWorking({ id, what });
    setError("");
    try {
      const res = await fetch(`/api/parent/kid/goals/${what}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      if (data.goal) replaceGoal(data.goal as Goal);
      if (data.warning) setError(data.warning);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setWorking(null);
    }
  };

  const createGoal = async () => {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/parent/kid/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save the goal");
      const goal = data.goal as Goal;
      setGoals((prev) => [...(prev ?? []), goal]);
      setHints((prev) => prev.filter((h) => h !== form.title));
      setForm({ title: "", why: "", horizon: "" });
      setAdding(false);
      setSaving(false);
      // The goal is saved either way; the plan follows (and can be retried).
      await run(goal.id, "plan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the goal");
      setSaving(false);
    }
  };

  const setGoalStatus = async (id: string, status: GoalStatus) => {
    setError("");
    try {
      const res = await fetch("/api/parent/kid/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't update");
      if (data.goal) replaceGoal(data.goal as Goal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update");
    }
  };

  const removeGoal = async (goal: Goal) => {
    if (!window.confirm(`Remove "${goal.title}" and its steps? This can't be undone.`)) {
      return;
    }
    setError("");
    try {
      const res = await fetch(`/api/parent/kid/goals?id=${goal.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't remove");
      }
      setGoals((prev) => (prev ? prev.filter((g) => g.id !== goal.id) : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove");
    }
  };

  const setStepStatus = async (goalId: string, stepId: string, status: StepStatus) => {
    setError("");
    const patchSteps = (fn: (steps: GoalStep[]) => GoalStep[]) =>
      setGoals((prev) =>
        prev ? prev.map((g) => (g.id === goalId ? { ...g, steps: fn(g.steps) } : g)) : prev
      );
    // Optimistic — dismissed disappears, the rest change in place.
    patchSteps((steps) =>
      status === "dismissed"
        ? steps.filter((s) => s.id !== stepId)
        : steps.map((s) => (s.id === stepId ? { ...s, status } : s))
    );
    try {
      const res = await fetch("/api/parent/kid/goals/steps", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: stepId, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't update");
      if (data.step && status !== "dismissed") {
        patchSteps((steps) =>
          steps.map((s) => (s.id === stepId ? (data.step as GoalStep) : s))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update");
      await load();
    }
  };

  const addStep = async (
    goalId: string,
    step: { kind: StepKind; title: string; cadence: string }
  ): Promise<boolean> => {
    setError("");
    try {
      const res = await fetch("/api/parent/kid/goals/steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId, ...step }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't add the step");
      setGoals((prev) =>
        prev
          ? prev.map((g) =>
              g.id === goalId ? { ...g, steps: [...g.steps, data.step as GoalStep] } : g
            )
          : prev
      );
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add the step");
      return false;
    }
  };

  const active = (goals ?? []).filter((g) => g.status === "active");
  const paused = (goals ?? []).filter((g) => g.status === "paused");
  const achieved = (goals ?? []).filter((g) => g.status === "achieved");

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 rounded-xl text-sm text-red-700">{error}</div>
      )}
      {unavailable && !error && (
        <div className="mb-4 p-3 bg-golden/10 rounded-xl text-xs text-espresso">
          Goals aren&apos;t set up yet — run {SETUP_SQL} in Supabase, then come back.
        </div>
      )}

      {goals === null ? (
        <div className="space-y-3">
          <div className="animate-pulse bg-sand-dark/40 rounded-2xl h-32" />
          <div className="animate-pulse bg-sand-dark/40 rounded-2xl h-32" />
        </div>
      ) : (
        <>
          {goals.length === 0 && !adding && !unavailable && (
            <div className="bg-sand rounded-2xl px-6 py-10 text-center mb-4">
              <span className="text-3xl">🎯</span>
              <p className="text-sm font-semibold text-espresso mt-3">
                The long game for {childName}
              </p>
              <p className="text-xs text-warm-gray mt-1.5 leading-relaxed max-w-[360px] mx-auto">
                Name something you want for him over the long run — a skill, an
                ability, a way of being. Orbit turns it into small routines, things
                to try, and signs to watch for, then checks in against the moments
                you capture.
              </p>
            </div>
          )}

          <div className="space-y-4">
            {active.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                childName={childName}
                accentText={kidText(kidIndex)}
                working={working?.id === goal.id ? working.what : null}
                locked={working !== null}
                onPlan={() => run(goal.id, "plan")}
                onCheckin={() => run(goal.id, "checkin")}
                onStatus={(status) => setGoalStatus(goal.id, status)}
                onRemove={() => removeGoal(goal)}
                onStepStatus={(stepId, status) => setStepStatus(goal.id, stepId, status)}
                onAddStep={(step) => addStep(goal.id, step)}
              />
            ))}
          </div>

          {!adding ? (
            <button
              onClick={() => setAdding(true)}
              disabled={unavailable}
              className={`w-full py-3 bg-rust text-white rounded-2xl text-sm font-medium shadow-sm hover:bg-rust-deep active:scale-[0.99] transition-all disabled:opacity-40 ${
                active.length > 0 ? "mt-4" : ""
              }`}
            >
              + Add a long-term goal
            </button>
          ) : (
            <div className={`bg-white rounded-2xl p-4 shadow-sm space-y-3 ${active.length > 0 ? "mt-4" : ""}`}>
              <p className="text-sm font-semibold text-espresso">
                What do you want for {childName}, long-term?
              </p>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Swims confidently on his own"
                autoFocus
                className="w-full bg-cream rounded-xl px-3 py-2.5 text-sm text-espresso outline-none border border-sand-dark/50 focus:border-rust/50"
              />
              {hints.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-warm-gray uppercase tracking-wide mb-1.5">
                    Already in his file
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {hints.map((h) => (
                      <button
                        key={h}
                        onClick={() => setForm({ ...form, title: h })}
                        className={`text-xs px-2.5 py-1 rounded-full text-left transition-all ${
                          form.title === h
                            ? "bg-espresso text-white"
                            : "bg-sand text-espresso/80 hover:bg-sand-dark/50"
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <textarea
                value={form.why}
                onChange={(e) => setForm({ ...form, why: e.target.value })}
                placeholder="Why it matters to you (optional) — it shapes the plan"
                rows={2}
                className="w-full bg-cream rounded-xl px-3 py-2.5 text-sm text-espresso outline-none border border-sand-dark/50 focus:border-rust/50 resize-none"
              />
              <input
                value={form.horizon}
                onChange={(e) => setForm({ ...form, horizon: e.target.value })}
                placeholder="By when — next summer, by age 7, ongoing (optional)"
                className="w-full bg-cream rounded-xl px-3 py-2.5 text-sm text-espresso outline-none border border-sand-dark/50 focus:border-rust/50"
              />
              <div className="flex gap-2">
                <button
                  onClick={createGoal}
                  disabled={!form.title.trim() || saving || working !== null}
                  className="flex-1 py-2.5 bg-rust text-white rounded-full text-sm font-medium disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Save & build a plan"}
                </button>
                <button
                  onClick={() => setAdding(false)}
                  className="px-4 text-sm text-warm-gray underline underline-offset-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {paused.length > 0 && (
            <div className="mt-6">
              <p className="text-[11px] font-bold uppercase tracking-wider text-warm-gray mb-2">
                Paused
              </p>
              <div className="space-y-2">
                {paused.map((g) => (
                  <div
                    key={g.id}
                    className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-sand-dark/40 flex items-center gap-3"
                  >
                    <p className="text-sm text-espresso/80 flex-1 min-w-0">⏸ {g.title}</p>
                    <button
                      onClick={() => setGoalStatus(g.id, "active")}
                      className="text-xs font-semibold text-rust shrink-0"
                    >
                      Resume
                    </button>
                    <button
                      onClick={() => removeGoal(g)}
                      className="text-xs text-warm-gray/80 shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {achieved.length > 0 && (
            <div className="mt-6">
              <p className="text-[11px] font-bold uppercase tracking-wider text-warm-gray mb-2">
                Got there
              </p>
              <div className="space-y-2">
                {achieved.map((g) => (
                  <div
                    key={g.id}
                    className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-sand-dark/40 relative overflow-hidden"
                  >
                    <div
                      className="absolute inset-x-0 top-0 h-1"
                      style={{ background: "var(--gradient-orbit)" }}
                    />
                    <p className="text-sm font-semibold text-espresso">🎉 {g.title}</p>
                    <p className="text-[11px] text-warm-gray mt-0.5">
                      {g.achieved_on ? `${fmtDay(g.achieved_on)} · ` : ""}
                      <button
                        onClick={() => setGoalStatus(g.id, "active")}
                        className="underline underline-offset-2 hover:text-espresso"
                      >
                        reopen
                      </button>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-warm-gray leading-relaxed mt-5 px-1">
            Dashed steps are Orbit&apos;s ideas — they count once you take them on.
            Check-ins describe what&apos;s been captured; they never score {childName}.
          </p>
        </>
      )}
    </div>
  );
}

function GoalCard({
  goal,
  childName,
  accentText,
  working,
  locked,
  onPlan,
  onCheckin,
  onStatus,
  onRemove,
  onStepStatus,
  onAddStep,
}: {
  goal: Goal;
  childName: string;
  accentText: string;
  working: "plan" | "checkin" | null;
  locked: boolean;
  onPlan: () => void;
  onCheckin: () => void;
  onStatus: (status: GoalStatus) => void;
  onRemove: () => void;
  onStepStatus: (stepId: string, status: StepStatus) => void;
  onAddStep: (step: { kind: StepKind; title: string; cadence: string }) => Promise<boolean>;
}) {
  const [stepForm, setStepForm] = useState<{
    kind: StepKind;
    title: string;
    cadence: string;
  } | null>(null);
  const [addingStep, setAddingStep] = useState(false);

  const parts = progressParts(goal.steps);
  const hasSteps = goal.steps.length > 0;
  const hasIdeas = goal.steps.some((s) => s.status === "suggested");
  const stale = goal.checkin_days !== null && goal.checkin_days >= STALE_CHECKIN_DAYS;

  const submitStep = async () => {
    if (!stepForm?.title.trim() || addingStep) return;
    setAddingStep(true);
    const ok = await onAddStep(stepForm);
    setAddingStep(false);
    if (ok) setStepForm(null);
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-sand-dark/40">
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${accentText}`}>
        🎯 Long-term goal
        {goal.horizon ? ` · ${goal.horizon}` : ""}
      </p>
      <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-espresso leading-snug">
        {goal.title}
      </h3>
      {goal.why && (
        <p className="text-xs text-warm-gray italic leading-relaxed mt-1">
          &ldquo;{goal.why}&rdquo;
        </p>
      )}
      {goal.approach && (
        <p className="text-[13px] text-espresso/85 leading-relaxed mt-3">
          <span className="font-semibold text-espresso">The approach: </span>
          {goal.approach}
        </p>
      )}

      {parts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {parts.map((p) => (
            <span
              key={p}
              className="text-[11px] px-2.5 py-1 rounded-full bg-sand text-espresso/80 font-[family-name:var(--font-meta)]"
            >
              {p}
            </span>
          ))}
        </div>
      )}

      {working === "plan" ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-warm-gray">
            🧠 Building a plan from {childName}&apos;s file…
          </p>
          <div className="animate-pulse bg-sand-dark/40 rounded-xl h-16" />
          <div className="animate-pulse bg-sand-dark/40 rounded-xl h-16" />
        </div>
      ) : !hasSteps ? (
        <button
          onClick={onPlan}
          disabled={locked}
          className="w-full mt-4 py-3 bg-espresso text-white rounded-2xl text-sm font-medium shadow-sm hover:bg-espresso/90 active:scale-[0.99] transition-all disabled:opacity-60"
        >
          ✨ Build a plan
        </button>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {STEP_KINDS.map((kind) => {
            const meta = KIND_META[kind];
            const steps = goal.steps
              .filter((s) => s.kind === kind)
              .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
            return (
              <div key={kind}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-warm-gray mb-2">
                  {meta.emoji} {meta.heading}
                </p>
                {steps.length === 0 ? (
                  <p className="text-xs text-warm-gray/80">{meta.empty}</p>
                ) : (
                  <div className="space-y-2">
                    {steps.map((s) => (
                      <StepRow
                        key={s.id}
                        step={s}
                        onStatus={(status) => onStepStatus(s.id, status)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {working !== "plan" &&
        (stepForm ? (
          <div className="mt-3 bg-cream rounded-xl p-3 space-y-2 border border-sand-dark/40">
            <div className="flex flex-wrap gap-1.5">
              {STEP_KINDS.map((k) => (
                <button
                  key={k}
                  onClick={() => setStepForm({ ...stepForm, kind: k })}
                  className={`text-xs px-2.5 py-1 rounded-full transition-all ${
                    stepForm.kind === k ? "bg-espresso text-white" : "bg-white text-warm-gray"
                  }`}
                >
                  {KIND_META[k].emoji} {KIND_META[k].short}
                </button>
              ))}
            </div>
            <input
              value={stepForm.title}
              onChange={(e) => setStepForm({ ...stepForm, title: e.target.value })}
              placeholder={
                stepForm.kind === "sign"
                  ? "Something you'd notice — e.g. He asks to go"
                  : "What is it?"
              }
              autoFocus
              className="w-full bg-white rounded-xl px-3 py-2 text-sm text-espresso outline-none border border-sand-dark/50 focus:border-rust/50"
            />
            {stepForm.kind === "routine" && (
              <input
                value={stepForm.cadence}
                onChange={(e) => setStepForm({ ...stepForm, cadence: e.target.value })}
                placeholder="When — e.g. Saturday mornings"
                className="w-full bg-white rounded-xl px-3 py-2 text-sm text-espresso outline-none border border-sand-dark/50 focus:border-rust/50"
              />
            )}
            <div className="flex gap-3">
              <button
                onClick={submitStep}
                disabled={!stepForm.title.trim() || addingStep}
                className="text-xs font-semibold text-rust disabled:opacity-40"
              >
                {addingStep ? "Saving…" : "Save step"}
              </button>
              <button onClick={() => setStepForm(null)} className="text-xs text-warm-gray">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setStepForm({ kind: "routine", title: "", cadence: "" })}
            className="mt-3 text-xs font-medium text-rust"
          >
            + Add a step of our own
          </button>
        ))}

      {/* Check-in: the plan read against captured moments. */}
      {hasSteps && (
        <div className="mt-4 bg-cream rounded-xl p-3.5 border border-sand-dark/40">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-espresso/60">
              🧭 Check-in
              {goal.checkin_at ? ` · ${familyFormatDate(goal.checkin_at)}` : ""}
            </p>
            {stale && (
              <span className="text-[10px] font-semibold text-golden shrink-0">
                {goal.checkin_days} days ago
              </span>
            )}
          </div>
          {working === "checkin" ? (
            <p className="text-xs text-warm-gray">
              🧠 Reading the plan against recent moments…
            </p>
          ) : goal.checkin ? (
            <>
              <p className="text-[13px] text-espresso leading-relaxed">{goal.checkin.note}</p>
              {goal.checkin.evidence.length > 0 && (
                <div className="mt-2 space-y-1">
                  {goal.checkin.evidence.map((line) => (
                    <p key={line} className="text-xs text-espresso/75 leading-relaxed">
                      • {line}
                    </p>
                  ))}
                </div>
              )}
              {goal.checkin.nudge && (
                <p className="text-xs text-espresso leading-relaxed mt-2">
                  <span className="font-semibold">This week: </span>
                  {goal.checkin.nudge}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-warm-gray leading-relaxed">
              Once a few steps are in motion, ask how it&apos;s going — Orbit reads
              the plan against the moments you&apos;ve captured and says what it sees.
            </p>
          )}
          {working !== "checkin" && (
            <button
              onClick={onCheckin}
              disabled={locked}
              className="mt-2.5 text-xs font-semibold text-rust disabled:opacity-40"
            >
              {goal.checkin ? "Check in again" : "How's it going?"}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 pt-3 border-t border-sand-dark/30">
        {hasSteps && (
          <button
            onClick={onPlan}
            disabled={locked}
            className="text-xs font-medium text-rust disabled:opacity-40"
          >
            {hasIdeas ? "✨ Different ideas" : "✨ More step ideas"}
          </button>
        )}
        <button onClick={() => onStatus("achieved")} className="text-xs font-medium text-sage">
          🎉 We got there
        </button>
        <div className="flex items-center gap-4 ml-auto">
          <button onClick={() => onStatus("paused")} className="text-xs text-warm-gray">
            Pause
          </button>
          <button onClick={onRemove} className="text-xs text-warm-gray/70">
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function StepRow({
  step,
  onStatus,
}: {
  step: GoalStep;
  onStatus: (status: StepStatus) => void;
}) {
  const meta = KIND_META[step.kind];

  if (step.status === "done") {
    return (
      <div className="px-1">
        <p className="text-[13px] text-espresso/70 leading-snug">
          <span className="text-sage font-semibold">✓</span> {step.title}
        </p>
        <p className="text-[11px] text-warm-gray mt-0.5">
          {meta.doneNote}
          {step.done_on ? ` ${fmtDay(step.done_on)}` : ""}
          {" · "}
          <button
            onClick={() => onStatus("active")}
            className="underline underline-offset-2 hover:text-espresso"
          >
            undo
          </button>
          {step.kind !== "routine" && (
            <>
              {" · "}
              <Link href="/capture" className="text-rust font-medium">
                capture it →
              </Link>
            </>
          )}
        </p>
      </div>
    );
  }

  const idea = step.status === "suggested";
  return (
    <div
      className={`rounded-xl px-3 py-2.5 ${
        idea
          ? "bg-white border border-dashed border-sand-dark"
          : "bg-cream border border-sand-dark/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-espresso leading-snug">{step.title}</p>
        <button
          onClick={() => onStatus("dismissed")}
          title={idea ? "Not for us" : "Drop it"}
          className="text-warm-gray/50 hover:text-warm-gray text-xs shrink-0"
        >
          ✕
        </button>
      </div>
      {step.cadence && <p className="text-[11px] text-warm-gray mt-0.5">{step.cadence}</p>}
      {step.detail && (
        <p className="text-xs text-espresso/75 leading-relaxed mt-1">{step.detail}</p>
      )}
      <div className="flex items-center gap-3 mt-2">
        {idea && meta.takeOn && (
          <button onClick={() => onStatus("active")} className="text-xs font-semibold text-rust">
            {meta.takeOn}
          </button>
        )}
        {(!idea || step.kind !== "routine") && (
          <button onClick={() => onStatus("done")} className="text-xs font-semibold text-sage">
            ✓ {meta.done}
          </button>
        )}
      </div>
    </div>
  );
}
