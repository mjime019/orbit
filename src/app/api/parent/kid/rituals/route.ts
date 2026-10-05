import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSessionKid } from "@/lib/kid-access";
import { getSessionProfile } from "@/lib/session";
import { getParentChildren } from "@/lib/queries";
import { familyToday } from "@/lib/tz";
import {
  RITUAL_AREAS,
  RITUAL_STATUSES,
  type RitualArea,
  type RitualStatus,
} from "@/lib/rituals-goals";

// A kid's rituals: the responsibilities he owns, is learning, or has been
// offered. Dismissed ones are kept in the table (so they aren't suggested
// again) but never listed.
export async function GET(req: NextRequest) {
  const { child } = await getSessionKid(req.nextUrl.searchParams.get("childId"));
  if (!child) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("kid_rituals")
    .select("*")
    .eq("child_id", child.id)
    .neq("status", "dismissed")
    .order("created_at", { ascending: true });
  if (error) {
    // Table missing until the SQL batch runs — degrade, don't crash.
    console.warn("[rituals] unavailable:", error.message);
    return NextResponse.json({ rituals: [], unavailable: true });
  }
  return NextResponse.json({ rituals: data ?? [] });
}

// A parent adds one of their own — it starts as "learning now".
export async function POST(req: NextRequest) {
  const { childId, title, area, cadence } = (await req.json()) as {
    childId?: string;
    title?: string;
    area?: string;
    cadence?: string;
  };
  const { profileId, child } = await getSessionKid(childId);
  if (!child) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!title?.trim()) {
    return NextResponse.json({ error: "Give it a name" }, { status: 400 });
  }

  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("kid_rituals")
    .insert({
      child_id: child.id,
      title: title.trim().slice(0, 140),
      area: RITUAL_AREAS.includes(area as RitualArea) ? area : "home",
      cadence: cadence?.trim() || null,
      status: "active",
      source: "parent",
      started_on: familyToday(),
      created_by: profileId,
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ritual: data });
}

export async function PATCH(req: NextRequest) {
  const { id, status } = (await req.json()) as { id?: string; status?: string };
  if (!id || !RITUAL_STATUSES.includes(status as RitualStatus)) {
    return NextResponse.json({ error: "Invalid id or status" }, { status: 400 });
  }

  const { profileId } = await getSessionProfile();
  const kids = await getParentChildren(profileId);
  const sb = await createServerSupabase();
  const { data: row, error: loadError } = await sb
    .from("kid_rituals")
    .select("id, child_id, started_on")
    .eq("id", id)
    .maybeSingle();
  if (loadError) {
    return NextResponse.json({ error: loadError.message }, { status: 500 });
  }
  if (!row || !kids.some((k) => k.id === row.child_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const today = familyToday();
  const update: Record<string, unknown> = { status };
  if (status === "active" || status === "mastered") {
    if (!row.started_on) update.started_on = today;
    update.mastered_on = status === "mastered" ? today : null;
  }

  const { data, error } = await sb
    .from("kid_rituals")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ritual: data });
}
