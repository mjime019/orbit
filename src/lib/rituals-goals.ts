// Shared vocabulary for the Rituals and Goals modules — the enums the SQL
// check constraints, the AI schemas, the routes, and the tabs all agree on.
// Client-safe: no server imports.

export const RITUAL_AREAS = [
  "self_care",
  "home",
  "belongings",
  "family",
  "choices",
] as const;
export type RitualArea = (typeof RITUAL_AREAS)[number];

export const RITUAL_AREA_META: Record<RitualArea, { emoji: string; label: string }> = {
  self_care: { emoji: "🪥", label: "Taking care of himself" },
  home: { emoji: "🏠", label: "Helping the house run" },
  belongings: { emoji: "🎒", label: "His own stuff" },
  family: { emoji: "🤝", label: "Caring for others" },
  choices: { emoji: "🧭", label: "His own decisions" },
};

export const RITUAL_STATUSES = ["suggested", "active", "mastered", "dismissed"] as const;
export type RitualStatus = (typeof RITUAL_STATUSES)[number];

export interface Ritual {
  id: string;
  child_id: string;
  title: string;
  area: RitualArea;
  why_now: string | null;
  how_to_start: string | null;
  cadence: string | null;
  looks_like_owning_it: string | null;
  status: RitualStatus;
  source: "ai" | "parent";
  started_on: string | null;
  mastered_on: string | null;
  created_at: string;
}

export const GOAL_STATUSES = ["active", "achieved", "paused"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

// routine = recurring habit · activity = one-off to try · sign = something
// you'd notice that says the goal is taking root (observed, never scored).
export const STEP_KINDS = ["routine", "activity", "sign"] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export const STEP_STATUSES = ["suggested", "active", "done", "dismissed"] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

export interface GoalStep {
  id: string;
  goal_id: string;
  kind: StepKind;
  title: string;
  detail: string | null;
  cadence: string | null;
  status: StepStatus;
  source: "ai" | "parent";
  done_on: string | null;
  created_at: string;
}

export interface GoalCheckin {
  note: string;
  evidence: string[];
  nudge: string | null;
}

export interface Goal {
  id: string;
  child_id: string;
  title: string;
  why: string | null;
  horizon: string | null;
  approach: string | null;
  status: GoalStatus;
  checkin: GoalCheckin | null;
  checkin_at: string | null;
  achieved_on: string | null;
  created_at: string;
  steps: GoalStep[];
  /** Whole days since the last check-in (computed server-side; null = never). */
  checkin_days: number | null;
}

export const SETUP_SQL = "scripts/pivot/09-rituals-goals.sql";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-03-15" → "Mar 15, 2026" without Date() (avoids the UTC day shift on
// date-only columns like started_on / mastered_on / done_on).
export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** Case- and punctuation-insensitive key for "is this the same step?". */
export function titleKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
