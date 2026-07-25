import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai";
import { buildCaptureFollowupPrompt } from "@/lib/prompts";
import { safeParseAIResponse, CaptureFollowupSchema } from "@/lib/parse-ai";

interface RosterEntry {
  id: string;
  name: string;
  age: number | null;
}

// Generic follow-ups when AI is unavailable — no fabricated child content,
// just conversation starters referencing the roster names.
function fallbackFollowups(roster: RosterEntry[]) {
  const followups = roster.slice(0, 2).map((child) => ({
    question: `You mentioned the day — was there a moment with ${child.name} that stood out or surprised you?`,
    about_child: child.name.toLowerCase(),
    reason: "Getting specific observations",
  }));
  if (followups.length === 0) {
    followups.push({
      question: "Can you tell me a specific moment from today that stood out?",
      about_child: "general",
      reason: "Getting specific observations",
    });
  }
  return {
    followups,
    open_close:
      "Anything else notable — new, exciting, or challenging — that we haven't covered?",
  };
}

export async function POST(req: NextRequest) {
  try {
    const { transcript, observations, speakerName, roster } = await req.json();

    if (!transcript) {
      return NextResponse.json({ error: "Missing transcript" }, { status: 400 });
    }
    const rosterList: RosterEntry[] = Array.isArray(roster) ? roster : [];

    const systemPrompt = buildCaptureFollowupPrompt({
      speakerName: speakerName || "the speaker",
      roster: rosterList.map((r) => ({ name: r.name, age: r.age })),
    });
    const userMessage = `${speakerName || "Speaker"}'S DESCRIPTION:\n${transcript}\n\nEXTRACTED OBSERVATIONS:\n${JSON.stringify(observations, null, 2)}`;

    let result: string;
    try {
      ({ text: result } = await callAI(systemPrompt, userMessage, {
        promptType: "capture_followup",
        maxOutputTokens: 2000,
      }));
    } catch {
      // Follow-ups are optional decoration — degrade rather than block.
      return NextResponse.json({ ...fallbackFollowups(rosterList), degraded: true });
    }

    // Schema supplies the open_close default; any shape failure → fallback.
    const parsed =
      safeParseAIResponse(result, CaptureFollowupSchema) ??
      fallbackFollowups(rosterList);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("[Capture Followup]", error);
    return NextResponse.json(fallbackFollowups([]));
  }
}
