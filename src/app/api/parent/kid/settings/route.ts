import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSessionProfile } from "@/lib/session";
import { getParentChildren } from "@/lib/queries";

// Edit a kid's basics (name, date of birth). Session parent must own the kid.
export async function PATCH(request: NextRequest) {
  const { childId, name, dateOfBirth } = (await request.json()) as {
    childId?: string;
    name?: string;
    dateOfBirth?: string | null;
  };

  if (!childId) {
    return NextResponse.json({ error: "Missing childId" }, { status: 400 });
  }

  const { profileId } = await getSessionProfile();
  const kids = await getParentChildren(profileId);
  if (!kids.some((k) => k.id === childId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = {};

  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed || trimmed.length > 60) {
      return NextResponse.json({ error: "Name must be 1–60 characters." }, { status: 400 });
    }
    update.name = trimmed;
  }

  if (dateOfBirth !== undefined) {
    if (dateOfBirth === null || dateOfBirth === "") {
      update.date_of_birth = null;
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
        return NextResponse.json({ error: "Date must be YYYY-MM-DD." }, { status: 400 });
      }
      const dob = new Date(`${dateOfBirth}T00:00:00Z`);
      const now = new Date();
      if (Number.isNaN(dob.getTime()) || dob > now || dob.getUTCFullYear() < 1990) {
        return NextResponse.json({ error: "That date doesn't look right." }, { status: 400 });
      }
      update.date_of_birth = dateOfBirth;
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("children")
    .update(update)
    .eq("id", childId)
    .select("id, name, date_of_birth")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ child: data });
}
