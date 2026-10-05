import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSessionGoal } from "@/lib/kid-access";
import { familyToday } from "@/lib/tz";
import {
  STEP_KINDS,
  STEP_STATUSES,
  type StepKind,
  type StepStatus,
} from "@/lib/rituals-goals";

// A parent adds their own step to a goal — it's in play immediately.
export async function POST(req: NextRequest) {
  const { goalId, kind, title, cadence } = (await req.json()) as {
    goalId?: string;
    kind?: string;
    title?: string;
    cadence?: string;
  };
  const { goal, error: loadError } = await getSessionGoal(goalId);
  if (loadError) {
    return NextResponse.json({ error: loadError }, { status: 500 });
  }
  if (!goal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!title?.trim() || !STEP_KINDS.includes(kind as StepKind)) {
    return NextResponse.json({ error: "Missing title or kind" }, { status: 400 });
  }

  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("goal_steps")
    .insert({
      goal_id: goal.id,
      kind,
      title: title.trim().slice(0, 160),
      cadence: kind === "routine" ? cadence?.trim() || null : null,
      status: "active",
      source: "parent",
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ step: data });
}

// suggested → active (taken on) → done (habit stuck / did it / seen it);
// dismissed hides it and keeps it from being suggested again.
export async function PATCH(req: NextRequest) {
  const { id, status } = (await req.json()) as { id?: string; status?: string };
  if (!id || !STEP_STATUSES.includes(status as StepStatus)) {
    return NextResponse.json({ error: "Invalid id or status" }, { status: 400 });
  }

  const sb = await createServerSupabase();
  const { data: row, error: rowError } = await sb
    .from("goal_steps")
    .select("id, goal_id")
    .eq("id", id)
    .maybeSingle();
  if (rowError) {
    return NextResponse.json({ error: rowError.message }, { status: 500 });
  }
  const { goal } = await getSessionGoal(row?.goal_id);
  if (!row || !goal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await sb
    .from("goal_steps")
    .update({ status, done_on: status === "done" ? familyToday() : null })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ step: data });
}
