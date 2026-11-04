import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, hasAdminSupabase } from "@/lib/supabase-admin";
import { bareAddress, getReceivedEmail, verifyWebhookSignature } from "@/lib/email";
import { extractReplyText } from "@/lib/email-reply";
import { getKidsFor, ingestCapture } from "@/lib/inbox";

export const maxDuration = 60;

// Resend "email.received" webhook: a parent replied to the digest. The
// sender must be a parent profile (anything else is ignored), the quoted
// digest is stripped, and the words go through the same inbox path as the
// shortcut — saved first, extracted, parked for review.
export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "RESEND_WEBHOOK_SECRET is not set" }, { status: 503 });
  }
  const rawBody = await req.text();
  const ok = verifyWebhookSignature(
    rawBody,
    {
      id: req.headers.get("svix-id"),
      timestamp: req.headers.get("svix-timestamp"),
      signature: req.headers.get("svix-signature"),
    },
    secret
  );
  if (!ok) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: { type?: string; data?: { email_id?: string; from?: string; to?: string[] } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (event.type !== "email.received" || !event.data?.email_id) {
    return NextResponse.json({ ignored: event.type ?? "unknown event" });
  }

  if (!hasAdminSupabase()) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 503 });
  }
  const admin = createAdminSupabase();
  const sourceRef = `resend:${event.data.email_id}`;

  // Webhooks retry; the words must land once.
  const { data: existing } = await admin
    .from("captures")
    .select("id")
    .eq("source_ref", sourceRef)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ duplicate: true, captureId: existing.id });
  }

  let email;
  try {
    email = await getReceivedEmail(event.data.email_id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "fetch failed";
    console.error("[inbox/email] fetch failed:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const from = bareAddress(email.from);
  const { data: profile } = await admin
    .from("profiles")
    .select("id, name, email")
    .eq("role", "parent")
    .ilike("email", from)
    .maybeSingle();
  if (!profile) {
    console.warn("[inbox/email] ignored: sender is not a parent profile");
    return NextResponse.json({ ignored: "unknown sender" }, { status: 202 });
  }

  const words = extractReplyText(email.text, email.html);
  if (!words) {
    return NextResponse.json({ ignored: "empty reply" });
  }

  // The digest id rides in the reply address (orbit+<id>@…): its questions
  // give the extractor the thread the parent is answering.
  const digestId = email.to
    .map((t) => bareAddress(t).match(/^orbit\+([0-9a-f-]{36})@/)?.[1])
    .find(Boolean);
  let contextNote: string | null = null;
  if (digestId) {
    const { data: digest } = await admin
      .from("family_digests")
      .select("questions")
      .eq("id", digestId)
      .maybeSingle();
    const questions = Array.isArray(digest?.questions) ? digest.questions : [];
    if (questions.length > 0) {
      contextNote =
        "Orbit's email asked:\n" +
        questions
          .map((q: { name?: string; question?: string }) => `- ${q.name ?? ""}: ${q.question ?? ""}`)
          .join("\n");
    }
  }

  const roster = await getKidsFor(admin, profile.id);
  if (roster.length === 0) {
    return NextResponse.json({ ignored: "no kids for sender" }, { status: 202 });
  }

  try {
    const result = await ingestCapture(admin, {
      authorProfileId: profile.id,
      speakerName: profile.name,
      roster,
      transcript: words.slice(0, 8000),
      channel: "email",
      contextNote,
      sourceRef,
    });
    console.log(`[inbox/email] capture ${result.captureId} ${result.status} (${result.children.length} moments)`);
    return NextResponse.json({ captureId: result.captureId, status: result.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ingest failed";
    console.error("[inbox/email] ingest failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
