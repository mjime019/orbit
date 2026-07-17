import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

// Words-first persistence for the unified capture flow. The client calls
// this with the raw transcript BEFORE any AI processing, then again with the
// same `id` to attach follow-ups / structured output / status changes.
// Auth: middleware session (family login).
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  try {
    const body = await req.json();
    const {
      id,
      authorProfileId,
      childIds,
      transcript,
      followupTranscript,
      structured,
      status,
    } = body;

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json({ error: "Missing transcript" }, { status: 400 });
    }

    const row = {
      author_profile_id: authorProfileId ?? null,
      child_ids: Array.isArray(childIds) ? childIds : [],
      transcript,
      followup_transcript: followupTranscript || null,
      structured: structured ?? null,
      status: status ?? "draft",
    };

    if (id) {
      const { data, error } = await supabase
        .from("captures")
        .update(row)
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) {
        console.error("[Capture Save] Supabase update error:", error);
        return NextResponse.json(
          { error: "Failed to save", detail: error.message },
          { status: 500 }
        );
      }
      if (data) {
        return NextResponse.json({ saved: true, id: data.id });
      }
      // Update matched no rows — fall through and insert rather than
      // stranding the speaker's words.
      console.warn("[Capture Save] Update matched no rows; inserting instead");
    }

    const { data, error } = await supabase
      .from("captures")
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error("[Capture Save] Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to save", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ saved: true, id: data.id });
  } catch (error) {
    console.error("[Capture Save]", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
