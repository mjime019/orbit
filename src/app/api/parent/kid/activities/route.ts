import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSessionProfile } from "@/lib/session";

const CATEGORIES = new Set(["sport", "music", "art", "stem", "other"]);
const STATUSES = new Set(["active", "paused", "past"]);

// Per-kid activities (sports, music, classes). Auth: middleware session.
export async function GET(req: NextRequest) {
  const childId = req.nextUrl.searchParams.get("childId");
  if (!childId) {
    return NextResponse.json({ error: "Missing childId" }, { status: 400 });
  }
  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("child_activities")
    .select("*")
    .eq("child_id", childId)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ activities: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { childId, name, category, scheduleNote, startedOn, notes } = body;
  if (!childId || !name?.trim()) {
    return NextResponse.json(
      { error: "Missing childId or name" },
      { status: 400 }
    );
  }
  const { profileId } = await getSessionProfile();
  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("child_activities")
    .insert({
      child_id: childId,
      name: name.trim(),
      category: CATEGORIES.has(category) ? category : "other",
      schedule_note: scheduleNote?.trim() || null,
      started_on: startedOn || null,
      notes: notes?.trim() || null,
      created_by: profileId,
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ activity: data });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...patch } = body;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const update: Record<string, unknown> = {};
  if (patch.name?.trim()) update.name = patch.name.trim();
  if (CATEGORIES.has(patch.category)) update.category = patch.category;
  if (STATUSES.has(patch.status)) update.status = patch.status;
  if (patch.scheduleNote !== undefined)
    update.schedule_note = patch.scheduleNote?.trim() || null;
  if (patch.notes !== undefined) update.notes = patch.notes?.trim() || null;
  if (patch.startedOn !== undefined) update.started_on = patch.startedOn || null;

  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("child_activities")
    .update(update)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ activity: data });
}
