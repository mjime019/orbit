import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transcript, followupTranscript, observations, date, teacherName } = body;

    const { data, error } = await supabase
      .from("camp_observations")
      .insert({
        teacher_name: teacherName || "Carla",
        transcript,
        followup_transcript: followupTranscript || null,
        observations,
        date: date || new Date().toISOString().split("T")[0],
      })
      .select()
      .single();

    if (error) {
      console.error("[Camp Save] Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to save observation", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ saved: true, id: data.id });
  } catch (error) {
    console.error("[Camp Save]", error);
    return NextResponse.json(
      { error: "Failed to save observation" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("camp_observations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Camp List] Supabase error:", error);
      return NextResponse.json({ records: [] });
    }

    return NextResponse.json({ records: data });
  } catch (error) {
    console.error("[Camp List]", error);
    return NextResponse.json({ records: [] });
  }
}
