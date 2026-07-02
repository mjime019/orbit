import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai";

function buildSystemPrompt(teacherName: string) {
  return `You are a warm, curious observation assistant helping ${teacherName} (a camp teacher) capture richer details about Felipe (age 3) and Rafael (age 4) at their summer camp.

You just received ${teacherName}'s day description and the structured observations extracted from it. Your job is to ask 1-2 specific follow-up questions that would deepen the most interesting observations. Then add one open close.

RULES FOR FOLLOW-UP QUESTIONS:
- Be specific. Reference what they actually said. "You mentioned Felipe was focused on the painting — did he say anything about what he was making?" is good. "Can you tell me more?" is bad.
- Focus on moments that suggest growth, new behavior, or social dynamics.
- Keep it conversational and appreciative. They just finished a long day with kids.
- Maximum 2 targeted questions + 1 open close.

The open close should always be a version of: "Anything else notable today — new, exciting, or challenging — that we haven't covered?"

Return ONLY valid JSON (no markdown, no backticks):
{
  "followups": [
    {"question": string, "about_child": "felipe" | "rafael" | "general", "reason": string}
  ],
  "open_close": string
}`;
}

// Generate fallback follow-ups when AI fails
function fallbackFollowups(transcript: string) {
  const lower = transcript.toLowerCase();
  const followups = [];

  if (lower.includes("felipe")) {
    followups.push({
      question: "You mentioned Felipe — did he say anything interesting or react in a way that stood out?",
      about_child: "felipe",
      reason: "Getting direct quotes and emotional reactions",
    });
  }
  if (lower.includes("rafael")) {
    followups.push({
      question: "You mentioned Rafael — was there a moment where he surprised you or did something new?",
      about_child: "rafael",
      reason: "Identifying emerging behaviors",
    });
  }
  if (followups.length === 0) {
    followups.push({
      question: "Can you tell me a specific moment from today with Felipe or Rafael that stood out?",
      about_child: "general",
      reason: "Getting specific observations",
    });
  }

  return {
    followups,
    open_close: "Anything else notable today — new, exciting, or challenging — that we haven't covered?",
  };
}

export async function POST(req: NextRequest) {
  try {
    const { transcript, observations, teacherName } = await req.json();

    if (!transcript) {
      return NextResponse.json(
        { error: "Missing transcript" },
        { status: 400 }
      );
    }

    const systemPrompt = buildSystemPrompt(teacherName || "Carla");
    const userMessage = `${teacherName || "Carla"}'S DESCRIPTION:\n${transcript}\n\nEXTRACTED OBSERVATIONS:\n${JSON.stringify(observations, null, 2)}`;

    const result = await callAI(systemPrompt, userMessage, { maxOutputTokens: 2000 });

    let parsed;
    try {
      const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // AI returned non-JSON — use fallback follow-ups
      parsed = fallbackFollowups(transcript);
    }

    // Ensure the response has the expected shape
    if (!parsed.followups || !Array.isArray(parsed.followups)) {
      parsed = fallbackFollowups(transcript);
    }

    if (!parsed.open_close) {
      parsed.open_close = "Anything else notable today — new, exciting, or challenging — that we haven't covered?";
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("[Camp Followup]", error);
    // Even on error, return usable follow-ups
    return NextResponse.json(fallbackFollowups(""));
  }
}
