import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import {
  assembleGoal,
  getSessionKid,
  getSessionGoal,
  loadGoalWithSteps,
} from "@/lib/kid-access";
import { displayPills } from "@/lib/extra-registry";
import { familyToday } from "@/lib/tz";
import {
  GOAL_STATUSES,
  titleKey,
  type Goal,
  type GoalStatus,
  type GoalStep,
} from "@/lib/rituals-goals";

// A kid's long-term goals with their steps. `hints` are the goals the
// parents already named in his file (onboarding) that aren't goals here yet
// — one-tap starting points.
export async function GET(req: NextRequest) {
  const { child } = await getSessionKid(req.nextUrl.searchParams.get("childId"));
  if (!child) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sb = await createServerSupabase();
  const { data: goalRows, error } = await sb
    .from("kid_goals")
    .select("*")
    .eq("child_id", child.id)
    .order("created_at", { ascending: true });
  if (error) {
    // Table missing until the SQL batch runs — degrade, don't crash.
    console.warn("[goals] unavailable:", error.message);
    return NextResponse.json({ goals: [], hints: [], unavailable: true });
  }

  const ids = (goalRows ?? []).map((g) => g.id as string);
  let steps: GoalStep[] = [];
  if (ids.length > 0) {
    const { data: stepRows, error: stepError } = await sb
      .from("goal_steps")
      .select("*")
      .in("goal_id", ids)
      .neq("status", "dismissed")
      .order("created_at", { ascending: true });
    if (stepError) {
      return NextResponse.json({ error: stepError.message }, { status: 500 });
    }
    steps = (stepRows ?? []) as GoalStep[];
  }

  const goals: Goal[] = (goalRows ?? []).map((g) =>
    assembleGoal(
      g,
      steps.filter((s) => s.goal_id === g.id)
    )
  );

  const { data: profile } = await sb
    .from("child_profiles")
    .select("parent_goals")
    .eq("child_id", child.id)
    .maybeSingle();
  const have = new Set(goals.map((g) => titleKey(g.title)));
  const hints = displayPills(profile?.parent_goals)
    .filter((h) => !have.has(titleKey(h)))
    .slice(0, 6);

  return NextResponse.json({ goals, hints });
}

export async function POST(req: NextRequest) {
  const { childId, title, why, horizon } = (await req.json()) as {
    childId?: string;
    title?: string;
    why?: string;
    horizon?: string;
  };
  const { profileId, child } = await getSessionKid(childId);
  if (!child) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!title?.trim()) {
    return NextResponse.json({ error: "Name the goal" }, { status: 400 });
  }

  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("kid_goals")
    .insert({
      child_id: child.id,
      title: title.trim().slice(0, 160),
      why: why?.trim() || null,
      horizon: horizon?.trim() || null,
      created_by: profileId,
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ goal: assembleGoal(data, []) });
}

export async function PATCH(req: NextRequest) {
  const { id, status, title, why, horizon } = (await req.json()) as {
    id?: string;
    status?: string;
    title?: string;
    why?: string | null;
    horizon?: string | null;
  };
  const { goal, error: loadError } = await getSessionGoal(id);
  if (loadError) {
    return NextResponse.json({ error: loadError }, { status: 500 });
  }
  if (!goal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = {};
  if (status !== undefined) {
    if (!GOAL_STATUSES.includes(status as GoalStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    update.status = status;
    update.achieved_on = status === "achieved" ? familyToday() : null;
  }
  if (title?.trim()) update.title = title.trim().slice(0, 160);
  if (why !== undefined) update.why = why?.trim() || null;
  if (horizon !== undefined) update.horizon = horizon?.trim() || null;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  }

  const sb = await createServerSupabase();
  const { error } = await sb.from("kid_goals").update(update).eq("id", goal.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ goal: await loadGoalWithSteps(goal.id) });
}

// Removing a goal removes its steps with it (FK cascade).
export async function DELETE(req: NextRequest) {
  const { goal, error: loadError } = await getSessionGoal(
    req.nextUrl.searchParams.get("id")
  );
  if (loadError) {
    return NextResponse.json({ error: loadError }, { status: 500 });
  }
  if (!goal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const sb = await createServerSupabase();
  const { error } = await sb.from("kid_goals").delete().eq("id", goal.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
