import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

const DEMO_TEACHER_ID = "00000000-0000-0000-0000-000000000101";

export async function POST(request: NextRequest) {
  const { digestId, title, content } = await request.json();

  if (!digestId) {
    return NextResponse.json(
      { error: "Missing digestId" },
      { status: 400 }
    );
  }

  const sb = createServerSupabase();
  const now = new Date().toISOString();

  const { data, error } = await sb
    .from("digests")
    .update({
      title,
      content,
      status: "sent",
      approved_by: DEMO_TEACHER_ID,
      approved_at: now,
      sent_at: now,
    })
    .eq("id", digestId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
