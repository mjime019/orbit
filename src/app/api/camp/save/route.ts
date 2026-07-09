import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCampKey } from "@/lib/camp-auth";

// POST persists a camp observation. The client calls it with the raw
// transcript BEFORE any AI processing (so a failed AI call never loses the
// teacher's words), then again with the same `id` to attach follow-ups and
// extracted observations.
export async function POST(req: NextRequest) {
  const unauthorized = requireCampKey(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    const { id, transcript, followupTranscript, observations, date, teacherName } =
      body;

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json({ error: "Missing transcript" }, { status: 400 });
    }

    const row = {
      teacher_name: teacherName || "Carla",
      transcript,
      followup_transcript: followupTranscript || null,
      observations: observations ?? null,
      date: date || new Date().toISOString().split("T")[0],
    };

    if (id) {
      const { data, error } = await supabase
        .from("camp_observations")
        .update(row)
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) {
        console.error("[Camp Save] Supabase update error:", error);
        return NextResponse.json(
          { error: "Failed to save observation", detail: error.message },
          { status: 500 }
        );
      }
      if (data) {
        return NextResponse.json({ saved: true, id: data.id });
      }
      // Update matched no rows (missing row, or RLS has no UPDATE policy on
      // camp_observations) — fall through and insert a fresh row rather than
      // stranding the teacher's words.
      console.warn("[Camp Save] Update matched no rows; inserting instead");
    }

    const { data, error } = await supabase
      .from("camp_observations")
      .insert(row)
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

export async function GET(req: NextRequest) {
  const unauthorized = requireCampKey(req);
  if (unauthorized) return unauthorized;

  try {
    const { data, error } = await supabase
      .from("camp_observations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Camp List] Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to load observations", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ records: data });
  } catch (error) {
    console.error("[Camp List]", error);
    return NextResponse.json(
      { error: "Failed to load observations" },
      { status: 500 }
    );
  }
}
