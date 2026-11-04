import type { SupabaseClient } from "@supabase/supabase-js";
import { extractMultiChild, ageFromDob, type RosterEntry, type Extraction } from "./extract";

// "Jot now, tidy later": a capture that arrives without the in-app review
// (Siri shortcut, email reply, in-app "save for later") is saved words-first,
// extracted, and parked in the inbox as `processed`. Nothing becomes an
// observation until a parent reviews it there — the review invariant holds
// for every channel.

/* eslint-disable @typescript-eslint/no-explicit-any */
export type AnySupabase = SupabaseClient<any, any, any>;

export type Channel = "later" | "shortcut" | "email";

export interface IngestInput {
  authorProfileId: string;
  speakerName: string;
  roster: RosterEntry[];
  transcript: string;
  channel: Channel;
  contextNote?: string | null;
  /** Provider-side id for idempotent retries (e.g. "resend:<email id>"). */
  sourceRef?: string | null;
}

export interface IngestResult {
  captureId: string;
  status: "processed" | "draft";
  children: Extraction["children"];
  /** Set when the words were saved but extraction failed. */
  error?: string;
}

export const INBOX_STATUSES = ["draft", "processed"] as const;

export async function getKidsFor(sb: AnySupabase, parentId: string): Promise<RosterEntry[]> {
  const { data, error } = await sb
    .from("parent_children")
    .select("children(id, name, date_of_birth)")
    .eq("parent_id", parentId);
  if (error) throw new Error(`[db] load kids: ${error.message}`);
  const kids = (data ?? [])
    .map((row: { children: unknown }) => row.children)
    .filter(Boolean) as { id: string; name: string; date_of_birth: string | null }[];
  return kids
    .sort((a, b) => (a.date_of_birth ?? "9999").localeCompare(b.date_of_birth ?? "9999"))
    .map((k) => ({ id: k.id, name: k.name, age: ageFromDob(k.date_of_birth) }));
}

export async function ingestCapture(sb: AnySupabase, input: IngestInput): Promise<IngestResult> {
  const transcript = input.transcript.trim();
  const { data: row, error: insError } = await sb
    .from("captures")
    .insert({
      author_profile_id: input.authorProfileId,
      child_ids: input.roster.map((r) => r.id),
      transcript,
      status: "draft",
      channel: input.channel,
      context_note: input.contextNote ?? null,
      source_ref: input.sourceRef ?? null,
    })
    .select("id")
    .single();
  if (insError) {
    throw new Error(
      `Couldn't save the words: ${insError.message}. Has scripts/pivot/10-inbox-digest.sql been run?`
    );
  }
  const captureId = row.id as string;

  try {
    const result = await extractMultiChild({
      transcript,
      speakerName: input.speakerName,
      speakerRole: "parent",
      setting: "home",
      roster: input.roster,
      contextNote: input.contextNote ?? null,
    });
    const { error: upError } = await sb
      .from("captures")
      .update({ structured: result.observations, status: "processed" })
      .eq("id", captureId);
    if (upError) throw new Error(upError.message);
    return { captureId, status: "processed", children: result.observations.children };
  } catch (err) {
    // Words are durable; the inbox offers "extract again".
    const message = err instanceof Error ? err.message : "Extraction failed";
    console.warn("[inbox] extraction failed, kept as draft:", message);
    return { captureId, status: "draft", children: [], error: message };
  }
}

/** One friendly sentence for Siri / the shortcut to read back. */
export function ingestSummary(result: IngestResult, roster: RosterEntry[]): string {
  if (result.status === "draft") {
    return "Saved your words. Orbit couldn't sort them just now — they're in your inbox to retry.";
  }
  const byKid = new Map<string, number>();
  for (const c of result.children) {
    const name = roster.find((r) => r.id === c.child_id)?.name ?? "someone";
    byKid.set(name, (byKid.get(name) ?? 0) + 1);
  }
  if (byKid.size === 0) {
    return "Saved your words — nothing specific picked out yet. It's in your inbox to review.";
  }
  const parts = [...byKid.entries()].map(
    ([name, n]) => `${n} moment${n === 1 ? "" : "s"} about ${name}`
  );
  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `Got it — ${list}, waiting for your OK in Orbit.`;
}
