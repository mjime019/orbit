import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, hasAdminSupabase } from "@/lib/supabase-admin";
import { createServerSupabase } from "@/lib/supabase-server";
import { buildDigestContent, renderDigestEmail } from "@/lib/digest";
import { emailConfigured, inboundDomain, replyAddressFor, sendEmail } from "@/lib/email";
import type { AnySupabase } from "@/lib/inbox";

// Writer-tier model (Sonnet 5.5) thinks before answering — give the
// function room beyond the platform default.
export const maxDuration = 60;

// Twice-weekly email (vercel.json cron). Auth is either the cron's
// CRON_SECRET bearer, or a logged-in parent: `?preview=1` renders the email
// in the browser without sending; `?send=1` sends it now.
// Cron delivery can duplicate or miss a run, so sending is idempotent per
// ~20h window and each run rebuilds from current state.
const MIN_GAP_HOURS = 20;

function appUrl(req: NextRequest): string {
  return (process.env.APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`).replace(/\/$/, "");
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  const viaCron = Boolean(cronSecret) && auth === `Bearer ${cronSecret}`;

  let sb: AnySupabase;
  let preview = false;
  let force = false;
  if (viaCron) {
    if (!hasAdminSupabase()) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY is not set — the digest cron needs it." },
        { status: 503 }
      );
    }
    sb = createAdminSupabase();
  } else {
    const session = await createServerSupabase();
    const {
      data: { user },
    } = await session.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    sb = session;
    preview = req.nextUrl.searchParams.get("preview") === "1";
    force = req.nextUrl.searchParams.get("send") === "1";
    if (!preview && !force) {
      return NextResponse.json(
        { error: "Add ?preview=1 to see the email, or ?send=1 to send it now." },
        { status: 400 }
      );
    }
  }

  if (!preview && !emailConfigured()) {
    return NextResponse.json({ error: "RESEND_API_KEY is not set — nothing sent." }, { status: 503 });
  }

  if (!preview && !force) {
    const since = new Date(Date.now() - MIN_GAP_HOURS * 60 * 60 * 1000).toISOString();
    const { data: recent, error } = await sb
      .from("family_digests")
      .select("id, sent_at")
      .gte("sent_at", since)
      .limit(1);
    if (error) {
      return NextResponse.json(
        { error: `family_digests unavailable: ${error.message}. Has scripts/pivot/10-inbox-digest.sql been run?` },
        { status: 500 }
      );
    }
    if (recent && recent.length > 0) {
      return NextResponse.json({ skipped: "already sent in the last 20h", digestId: recent[0].id });
    }
  }

  let content;
  try {
    content = await buildDigestContent(sb);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't build the digest";
    console.error("[digest] build failed:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const canReply = Boolean(inboundDomain());
  const base = appUrl(req);

  if (preview) {
    const { html } = renderDigestEmail(content, { appUrl: base, canReply });
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  // Record first so the reply address can carry the digest id.
  const { data: digest, error: insError } = await sb
    .from("family_digests")
    .insert({
      recipient_emails: content.recipients.map((r) => r.email),
      questions: content.kids.map((k) => ({
        child_id: k.childId,
        name: k.name,
        question: k.question,
        thread: k.thread,
      })),
      pending_count: content.pending.count,
    })
    .select("id")
    .single();
  if (insError) {
    return NextResponse.json({ error: `Couldn't record the digest: ${insError.message}` }, { status: 500 });
  }

  const { subject, html, text } = renderDigestEmail(content, { appUrl: base, canReply });
  const replyTo = replyAddressFor(digest.id);
  const sent: { email: string; id: string }[] = [];
  const failed: { email: string; error: string }[] = [];
  for (const r of content.recipients) {
    try {
      const { id } = await sendEmail({
        to: [r.email],
        subject,
        html,
        text,
        replyTo,
        idempotencyKey: `digest-${digest.id}-${r.profileId}`,
      });
      sent.push({ email: r.email, id });
    } catch (err) {
      const message = err instanceof Error ? err.message : "send failed";
      console.error(`[digest] send to ${r.email} failed:`, message);
      failed.push({ email: r.email, error: message });
    }
  }

  await sb
    .from("family_digests")
    .update({ provider_ids: { sent, failed } })
    .eq("id", digest.id);

  console.log(`[digest] ${digest.id}: sent ${sent.length}, failed ${failed.length}, pending ${content.pending.count}`);
  return NextResponse.json({ digestId: digest.id, sent, failed, questions: content.kids.map((k) => k.question) });
}
