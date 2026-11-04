import { NextRequest, NextResponse } from "next/server";
import { AIUnavailableError } from "@/lib/ai";
import { AIResponseFormatError } from "@/lib/parse-ai";
import { extractMultiChild, type RosterEntry } from "@/lib/extract";

// Multi-child extraction for the in-app flow: the speaker talks once about
// the whole day/outing; the AI splits it into per-child observations mapped
// back to roster ids (see src/lib/extract.ts — shared with the inbox
// channels). Unmatched names go to `unassigned` for manual assignment in
// the review screen.
export async function POST(req: NextRequest) {
  try {
    const { transcript, speakerName, speakerRole, setting, roster, contextNote } =
      await req.json();

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json({ error: "Missing transcript" }, { status: 400 });
    }
    if (!Array.isArray(roster) || roster.length === 0) {
      return NextResponse.json({ error: "Missing roster" }, { status: 400 });
    }

    try {
      const result = await extractMultiChild({
        transcript,
        speakerName: speakerName || "the speaker",
        speakerRole: speakerRole === "parent" ? "parent" : "teacher",
        setting: setting === "home" ? "home" : "school",
        roster: roster as RosterEntry[],
        contextNote: typeof contextNote === "string" ? contextNote : null,
      });
      return NextResponse.json({
        observations: result.observations,
        unassigned: result.unassigned,
      });
    } catch (err) {
      if (err instanceof AIResponseFormatError) {
        return NextResponse.json(
          { error: "AI returned an unreadable response. Your words are saved — try again." },
          { status: 502 }
        );
      }
      const message = err instanceof Error ? err.message : "AI service unavailable";
      const status = err instanceof AIUnavailableError ? err.status : 502;
      return NextResponse.json({ error: message }, { status });
    }
  } catch (error) {
    console.error("[Capture Process]", error);
    return NextResponse.json(
      { error: "Failed to process the recording" },
      { status: 500 }
    );
  }
}
