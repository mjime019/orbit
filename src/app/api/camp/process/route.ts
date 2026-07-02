import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai";

function buildSystemPrompt(teacherName: string) {
  return `You are an early childhood observation assistant for a small summer camp in Miami. A teacher named ${teacherName} is describing their day with the kids. They speak naturally about the whole day — multiple kids, multiple activities. Your job is to extract structured developmental observations for TWO specific children only: Felipe (age 3) and Rafael (age 4).

Other kids in the camp (Bryce, Bella, Emilia, Ale) may be mentioned — include them in social context but do NOT create standalone observation records for them.

FOR EACH CHILD (Felipe and Rafael), EXTRACT:
1. **observation_summary** — what happened, in ${teacherName}'s natural voice. Specific details, not generic. "Felipe spent 10 minutes painting with blue" is good. "Felipe engaged in creative play" is bad.
2. **domains** — which developmental areas this touches. Choose from: language, motor_fine, motor_gross, social_emotional, cognitive, creative. Be conservative — only tag with clear evidence.
3. **social_moments** — array of social interactions. Each has: type (helped, led, regulated, played_with, conflict, breakthrough), description (what happened), with_whom (other kids involved).
4. **direct_quotes** — anything ${teacherName} quoted the child saying, verbatim.
5. **other_kids_involved** — names of other children in the interaction.
6. **notable** — boolean. True if something seems new, emerging, or especially worth tracking.
7. **notable_reason** — if notable is true, why.

RULES:
- Preserve ${teacherName}'s voice and specifics. Never generalize.
- Never use clinical language (no "demonstrates," "exhibits," "displays").
- If a child wasn't mentioned at all, return null for that child.
- If something is ambiguous, note it but don't guess.
- Even if the transcript is short or informal, extract whatever you can. A short observation is better than none.

Return ONLY valid JSON (no markdown, no backticks):
{
  "felipe": null | {
    "observation_summary": string,
    "domains": string[],
    "social_moments": [{"type": string, "description": string, "with_whom": string[]}],
    "direct_quotes": string[],
    "other_kids_involved": string[],
    "notable": boolean,
    "notable_reason": string | null
  },
  "rafael": null | {
    "observation_summary": string,
    "domains": string[],
    "social_moments": [{"type": string, "description": string, "with_whom": string[]}],
    "direct_quotes": string[],
    "other_kids_involved": string[],
    "notable": boolean,
    "notable_reason": string | null
  },
  "day_summary": string,
  "themes": string[]
}`;
}

// Normalize responses that don't match the expected camp format
// (e.g. mock fallback returns flat ObservationExtraction shape)
function normalizeObservations(parsed: Record<string, unknown>, transcript: string) {
  // If already in the right format, return as-is
  if ("felipe" in parsed || "rafael" in parsed) {
    return {
      felipe: parsed.felipe ?? null,
      rafael: parsed.rafael ?? null,
      day_summary: parsed.day_summary ?? transcript.slice(0, 200),
      themes: parsed.themes ?? [],
    };
  }

  // Flat format from mock — try to build a reasonable structure
  const summary = (parsed.summary as string) || transcript.slice(0, 200);
  const domains = (parsed.domains as string[]) || [];
  const socialTag = parsed.social_tag as string | null;
  const keyQuote = parsed.key_quote as string | null;
  const otherChildren = (parsed.other_children as string[]) || [];

  // Check which kids are mentioned in the transcript
  const lower = transcript.toLowerCase();
  const mentionsFelipe = lower.includes("felipe");
  const mentionsRafael = lower.includes("rafael");

  function buildChild(mentioned: boolean) {
    if (!mentioned) return null;
    return {
      observation_summary: summary,
      domains,
      social_moments: socialTag
        ? [{ type: socialTag, description: summary, with_whom: otherChildren }]
        : [],
      direct_quotes: keyQuote ? [keyQuote] : [],
      other_kids_involved: otherChildren,
      notable: false,
      notable_reason: null,
    };
  }

  // If neither kid mentioned specifically, attribute to both
  const bothOrNeither = !mentionsFelipe && !mentionsRafael;

  return {
    felipe: buildChild(mentionsFelipe || bothOrNeither),
    rafael: buildChild(mentionsRafael || bothOrNeither),
    day_summary: summary,
    themes: domains,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { transcript, teacherName } = await req.json();

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json(
        { error: "Missing transcript" },
        { status: 400 }
      );
    }

    const systemPrompt = buildSystemPrompt(teacherName || "Carla");
    const result = await callAI(systemPrompt, transcript, { maxOutputTokens: 4000 });

    // Try to parse the JSON response
    let parsed;
    try {
      // Strip markdown code fences if present
      const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // If AI returned non-JSON, build a basic structure from the transcript
      return NextResponse.json({
        observations: normalizeObservations({}, transcript),
      });
    }

    // Normalize to expected format (handles mock fallback)
    const observations = normalizeObservations(parsed, transcript);
    return NextResponse.json({ observations });
  } catch (error) {
    console.error("[Camp Process]", error);
    return NextResponse.json(
      { error: "Failed to process observation" },
      { status: 500 }
    );
  }
}
