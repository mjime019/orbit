// Ownership checks for per-kid API routes. RLS already limits every table
// to the family; these make sure a request names a kid (or a goal) that
// belongs to the logged-in parent before any AI call or write.

import { createServerSupabase } from "./supabase-server";
import { getSessionProfile } from "./session";
import { getParentChildren } from "./queries";
import type { Goal, GoalStep } from "./rituals-goals";

type Kid = { id: string; name: string; date_of_birth: string | null };

export async function getSessionKid(
  childId: string | null | undefined
): Promise<{ profileId: string; child: Kid | null }> {
  const { profileId } = await getSessionProfile();
  const kids = await getParentChildren(profileId);
  return { profileId, child: kids.find((k) => k.id === childId) ?? null };
}

type GoalRow = Omit<Goal, "steps" | "checkin_days">;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Attach steps + the days-since-check-in the tab shows as staleness. */
export function assembleGoal(row: GoalRow, steps: GoalStep[]): Goal {
  return {
    ...row,
    steps,
    checkin_days: row.checkin_at
      ? Math.max(0, Math.floor((Date.now() - new Date(row.checkin_at).getTime()) / DAY_MS))
      : null,
  };
}

/** The goal a request names plus the kid it belongs to — null if not theirs. */
export async function getSessionGoal(goalId: string | null | undefined): Promise<{
  profileId: string;
  goal: GoalRow | null;
  child: Kid | null;
  error?: string;
}> {
  const { profileId } = await getSessionProfile();
  if (!goalId) return { profileId, goal: null, child: null };
  const kids = await getParentChildren(profileId);
  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("kid_goals")
    .select("*")
    .eq("id", goalId)
    .maybeSingle();
  if (error) return { profileId, goal: null, child: null, error: error.message };
  const child = data ? (kids.find((k) => k.id === data.child_id) ?? null) : null;
  return { profileId, goal: child ? (data as GoalRow) : null, child };
}

/** A goal with its live (non-dismissed) steps, oldest first. */
export async function loadGoalWithSteps(goalId: string): Promise<Goal | null> {
  const sb = await createServerSupabase();
  const [{ data: goal }, { data: steps }] = await Promise.all([
    sb.from("kid_goals").select("*").eq("id", goalId).maybeSingle(),
    sb
      .from("goal_steps")
      .select("*")
      .eq("goal_id", goalId)
      .neq("status", "dismissed")
      .order("created_at", { ascending: true }),
  ]);
  if (!goal) return null;
  return assembleGoal(goal as GoalRow, (steps ?? []) as GoalStep[]);
}
