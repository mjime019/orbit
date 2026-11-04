import { callAI } from "./ai";
import { buildMultiChildExtractionPrompt } from "./prompts";
import {
  parseAIResponse,
  AIResponseFormatError,
  MultiChildExtractionSchema,
} from "./parse-ai";
import type { z } from "zod";

// The one extraction core behind every capture channel (in-app, inbox
// token, email reply): words in, per-child moments out, mapped to roster
// ids. Nothing is attributed by guesswork — unmatched names stay unassigned.

export interface RosterEntry {
  id: string;
  name: string;
  age: number | null;
}

export type ExtractedChild = z.output<
  typeof MultiChildExtractionSchema
>["children"][number] & { child_id: string | null };

export interface Extraction {
  children: ExtractedChild[];
  day_summary: string;
  themes: string[];
}

export interface ExtractResult {
  observations: Extraction;
  unassigned: string[];
  /** The words held no moment (a question, a test) — not an error. */
  noMoment: boolean;
}

export function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  return Math.floor(
    (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );
}

// Throws AIUnavailableError (service) or AIResponseFormatError (JSON that
// came back broken). A pure-prose reply is returned as noMoment instead.
export async function extractMultiChild(input: {
  transcript: string;
  speakerName: string;
  speakerRole: "teacher" | "parent";
  setting: "school" | "home";
  roster: RosterEntry[];
  contextNote?: string | null;
}): Promise<ExtractResult> {
  const systemPrompt = buildMultiChildExtractionPrompt({
    speakerName: input.speakerName,
    speakerRole: input.speakerRole,
    setting: input.setting,
    roster: input.roster.map((r) => ({ name: r.name, age: r.age })),
    contextNote: input.contextNote ?? null,
  });

  // The transcript is DATA to process, not a message to the assistant —
  // unwrapped, a dictated question ("how do I…") baits a conversational
  // answer instead of extraction JSON.
  const { text: result } = await callAI(
    systemPrompt,
    `Recording transcript to process:\n"""\n${input.transcript}\n"""\n\nReturn the extraction JSON now.`,
    { promptType: "multi_child_extraction", maxOutputTokens: 4000 }
  );

  let parsed: z.output<typeof MultiChildExtractionSchema>;
  try {
    parsed = parseAIResponse(result, MultiChildExtractionSchema);
  } catch (err) {
    if (err instanceof AIResponseFormatError && !err.raw.includes("{")) {
      console.warn("[extract] prose reply, treating as no-moment:", result.slice(0, 200));
      return {
        observations: { children: [], day_summary: input.transcript.slice(0, 200), themes: [] },
        unassigned: [],
        noMoment: true,
      };
    }
    console.error("[extract] unparseable AI response (first 300 chars):", result.slice(0, 300));
    throw err;
  }

  const byName = new Map(input.roster.map((r) => [r.name.trim().toLowerCase(), r]));
  const children: ExtractedChild[] = [];
  const unassigned: string[] = [];
  for (const child of parsed.children) {
    if (!child.observation_summary) continue;
    const match = child.name ? byName.get(child.name.trim().toLowerCase()) : undefined;
    if (!match) unassigned.push(child.name || "Unnamed");
    children.push({ ...child, child_id: match?.id ?? null });
  }

  return {
    observations: {
      children,
      day_summary: parsed.day_summary || input.transcript.slice(0, 200),
      themes: parsed.themes,
    },
    unassigned,
    noMoment: false,
  };
}
