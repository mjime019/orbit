import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import type { DevDomain, SocialTag } from "@/lib/types";

const DEMO_TEACHER_ID = "00000000-0000-0000-0000-000000000101";
const DEMO_CLASSROOM_ID = "00000000-0000-0000-0000-000000000010";

export async function POST(request: NextRequest) {
  const body: {
    child_id: string;
    note: string;
    domains: DevDomain[];
    social_tag: SocialTag | null;
    other_children_ids: string[];
  } = await request.json();

  if (!body.child_id || !body.note) {
    return NextResponse.json(
      { error: "Missing child_id or note" },
      { status: 400 }
    );
  }

  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("observations")
    .insert({
      child_id: body.child_id,
      teacher_id: DEMO_TEACHER_ID,
      classroom_id: DEMO_CLASSROOM_ID,
      note: body.note,
      domains: body.domains ?? [],
      social_tag: body.social_tag ?? null,
      other_children_ids: body.other_children_ids ?? [],
      source: "teacher",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
