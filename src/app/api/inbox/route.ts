import { NextRequest, NextResponse } from "next/server";
import { resolveInboxCaller } from "@/lib/inbox-auth";
import { getKidsFor, ingestCapture, ingestSummary, INBOX_STATUSES } from "@/lib/inbox";

// The capture inbox.
//   POST  — jot words from anywhere (Siri shortcut via inbox token, or the
//           in-app "save for later" via session). Words saved first, then
//           extracted and parked for review. Nothing becomes an observation here.
//   GET   — the pending items + roster (session only).
//   PATCH — dismiss an item (session only).

export async function POST(req: NextRequest) {
  let caller;
  try {
    caller = await resolveInboxCaller(req);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "auth failed" }, { status: 503 });
  }
  if (!caller) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { text?: unknown; childId?: unknown };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Nothing to save — send some words in `text`." }, { status: 400 });
  }

  let roster;
  try {
    roster = await getKidsFor(caller.sb, caller.profileId);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "no kids" }, { status: 500 });
  }
  if (roster.length === 0) {
    return NextResponse.json({ error: "No kids on file for this parent." }, { status: 400 });
  }
  const scoped =
    typeof body.childId === "string" ? roster.filter((r) => r.id === body.childId) : [];
  const effective = scoped.length > 0 ? scoped : roster;

  let result;
  try {
    result = await ingestCapture(caller.sb, {
      authorProfileId: caller.profileId,
      speakerName: caller.speakerName,
      roster: effective,
      transcript: text.slice(0, 8000),
      channel: caller.viaToken ? "shortcut" : "later",
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't save" }, { status: 500 });
  }

  return NextResponse.json({
    captureId: result.captureId,
    status: result.status,
    message: ingestSummary(result, effective),
    children: result.children.map((c) => ({
      name: effective.find((r) => r.id === c.child_id)?.name ?? c.name,
      summary: c.observation_summary,
    })),
    ...(result.error ? { error: result.error } : {}),
  });
}

export async function GET(req: NextRequest) {
  const caller = await resolveInboxCaller(req);
  if (!caller || caller.viaToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const roster = await getKidsFor(caller.sb, caller.profileId);
  const { data, error } = await caller.sb
    .from("captures")
    .select("id, created_at, channel, transcript, context_note, status, structured, author_profile_id, child_ids")
    .in("status", [...INBOX_STATUSES])
    .neq("channel", "app")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    // Columns missing until the SQL batch runs — degrade, don't crash.
    console.warn("[inbox] unavailable:", error.message);
    return NextResponse.json({ items: [], roster, unavailable: true });
  }
  const items = (data ?? []).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    channel: row.channel,
    transcript: row.transcript,
    context_note: row.context_note,
    status: row.status,
    author_profile_id: row.author_profile_id,
    child_ids: row.child_ids ?? [],
    children: Array.isArray(row.structured?.children) ? row.structured.children : [],
  }));
  return NextResponse.json({ items, roster });
}

export async function PATCH(req: NextRequest) {
  const caller = await resolveInboxCaller(req);
  if (!caller || caller.viaToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, status } = (await req.json()) as { id?: string; status?: string };
  if (!id || status !== "dismissed") {
    return NextResponse.json({ error: "Invalid id or status" }, { status: 400 });
  }
  const { error } = await caller.sb
    .from("captures")
    .update({ status: "dismissed", reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", [...INBOX_STATUSES]);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
