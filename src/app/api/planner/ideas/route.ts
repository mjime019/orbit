import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSessionProfile } from "@/lib/session";
import { getParentChildren } from "@/lib/queries";

const KINDS = new Set(["activity", "weekend", "extracurricular"]);
const STATUSES = new Set(["suggested", "saved", "done", "dismissed"]);

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("kind") ?? "";
  const childId = req.nextUrl.searchParams.get("childId");
  if (!KINDS.has(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  const sb = await createServerSupabase();
  let query = sb
    .from("planner_ideas")
    .select("*")
    .eq("kind", kind)
    .neq("status", "dismissed")
    .order("created_at", { ascending: false })
    .limit(30);
  query = childId ? query.eq("child_id", childId) : query.is("child_id", null);

  const { data, error } = await query;
  if (error) {
    // Table missing until the SQL batch runs — degrade, don't crash.
    console.warn("[planner] ideas unavailable:", error.message);
    return NextResponse.json({ ideas: [], unavailable: true });
  }
  return NextResponse.json({ ideas: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const { id, status } = (await req.json()) as { id?: string; status?: string };
  if (!id || !status || !STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid id or status" }, { status: 400 });
  }

  // Session must be a parent in the family (RLS scopes the rest).
  await getSessionProfile().then((p) => getParentChildren(p.profileId));

  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("planner_ideas")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ idea: data });
}
