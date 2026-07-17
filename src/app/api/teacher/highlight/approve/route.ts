import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

const DEMO_TEACHER_ID = "00000000-0000-0000-0000-000000000101";

export async function POST(request: NextRequest) {
  const { highlightId, title, content, summary } = await request.json();

  if (!highlightId) {
    return NextResponse.json(
      { error: "Missing highlightId" },
      { status: 400 }
    );
  }

  const sb = await createServerSupabase();
  const now = new Date().toISOString();

  const { data, error } = await sb
    .from("highlights")
    .update({
      title,
      content,
      summary,
      status: "sent",
      approved_by: DEMO_TEACHER_ID,
      approved_at: now,
      sent_at: now,
    })
    .eq("id", highlightId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
