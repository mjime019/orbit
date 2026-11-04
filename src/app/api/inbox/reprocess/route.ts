import { NextRequest, NextResponse } from "next/server";
import { resolveInboxCaller } from "@/lib/inbox-auth";
import { getKidsFor, INBOX_STATUSES } from "@/lib/inbox";
import { extractMultiChild } from "@/lib/extract";
import { AIUnavailableError } from "@/lib/ai";

export const maxDuration = 60;

// Run (or re-run) extraction on an inbox item — the retry for words that
// were saved while the AI was unavailable, or a second pass after a
// different kid scope.
export async function POST(req: NextRequest) {
  const caller = await resolveInboxCaller(req);
  if (!caller || caller.viaToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, childId } = (await req.json()) as { id?: string; childId?: string };
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { data: capture, error } = await caller.sb
    .from("captures")
    .select("id, transcript, context_note, status, child_ids, author_profile_id")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!capture || !(INBOX_STATUSES as readonly string[]).includes(capture.status)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const kids = await getKidsFor(caller.sb, caller.profileId);
  const wanted = childId ? [childId] : (capture.child_ids as string[]) ?? [];
  const scoped = kids.filter((k) => wanted.includes(k.id));
  const roster = scoped.length > 0 ? scoped : kids;

  const { data: author } = await caller.sb
    .from("profiles")
    .select("name")
    .eq("id", capture.author_profile_id ?? caller.profileId)
    .maybeSingle();

  try {
    const result = await extractMultiChild({
      transcript: capture.transcript,
      speakerName: author?.name ?? caller.speakerName,
      speakerRole: "parent",
      setting: "home",
      roster,
      contextNote: capture.context_note,
    });
    const { error: upError } = await caller.sb
      .from("captures")
      .update({ structured: result.observations, status: "processed", child_ids: roster.map((r) => r.id) })
      .eq("id", id);
    if (upError) throw new Error(upError.message);
    return NextResponse.json({ children: result.observations.children, noMoment: result.noMoment });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    const status = err instanceof AIUnavailableError ? err.status : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
