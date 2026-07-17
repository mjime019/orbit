import { NextRequest, NextResponse } from "next/server";
import { callAI, AIUnavailableError } from "@/lib/ai";
import { buildMultiChildExtractionPrompt } from "@/lib/prompts";

interface RosterEntry {
  id: string;
  name: string;
  age: number | null;
}

interface ExtractedChild {
  name?: string;
  observation_summary?: string;
  domains?: string[];
  social_moments?: { type: string; description: string; with_whom: string[] }[];
  direct_quotes?: string[];
  other_kids_involved?: string[];
  notable?: boolean;
  notable_reason?: string | null;
}

// Multi-child extraction: the speaker talks once about the whole day/outing;
// the AI splits it into per-child observations, which the server maps back to
// roster ids. Unmatched names go to `unassigned` for manual assignment in the
// review screen — nothing is attributed by guesswork.
export async function POST(req: NextRequest) {
  try {
    const { transcript, speakerName, speakerRole, setting, roster } =
      await req.json();

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json({ error: "Missing transcript" }, { status: 400 });
    }
    if (!Array.isArray(roster) || roster.length === 0) {
      return NextResponse.json({ error: "Missing roster" }, { status: 400 });
    }

    const systemPrompt = buildMultiChildExtractionPrompt({
      speakerName: speakerName || "the speaker",
      speakerRole: speakerRole === "parent" ? "parent" : "teacher",
      setting: setting === "home" ? "home" : "school",
      roster: (roster as RosterEntry[]).map((r) => ({ name: r.name, age: r.age })),
    });

    let result: string;
    try {
      ({ text: result } = await callAI(systemPrompt, transcript, {
        maxOutputTokens: 4000,
      }));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "AI service unavailable";
      const status = err instanceof AIUnavailableError ? err.status : 502;
      return NextResponse.json({ error: message }, { status });
    }

    let parsed: { children?: ExtractedChild[]; day_summary?: string; themes?: string[] };
    try {
      const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "AI returned an unreadable response. Your words are saved — try again." },
        { status: 502 }
      );
    }

    const byName = new Map(
      (roster as RosterEntry[]).map((r) => [r.name.trim().toLowerCase(), r])
    );
    const children: (ExtractedChild & { child_id: string | null })[] = [];
    const unassigned: string[] = [];

    for (const child of parsed.children ?? []) {
      if (!child?.observation_summary) continue;
      const match = child.name
        ? byName.get(child.name.trim().toLowerCase())
        : undefined;
      if (!match) unassigned.push(child.name ?? "Unnamed");
      children.push({ ...child, child_id: match?.id ?? null });
    }

    return NextResponse.json({
      observations: {
        children,
        day_summary: parsed.day_summary ?? transcript.slice(0, 200),
        themes: parsed.themes ?? [],
      },
      unassigned,
    });
  } catch (error) {
    console.error("[Capture Process]", error);
    return NextResponse.json(
      { error: "Failed to process the recording" },
      { status: 500 }
    );
  }
}
