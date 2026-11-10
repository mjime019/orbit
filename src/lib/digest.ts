import type { AnySupabase } from "./inbox";
import { buildFileContext } from "./file-context";
import { callAI } from "./ai";
import { buildDigestQuestionsPrompt } from "./prompts";
import { parseAIResponse, DigestQuestionsSchema } from "./parse-ai";
import { formatAge } from "./age";
import { familyFormatDate } from "./tz";
import { INBOX_STATUSES } from "./inbox";
import { isDeliverable } from "./email";

// The twice-weekly email: each kid in two lines (what's fresh + one leading
// question the parent can answer in a sentence), then whatever is waiting
// in the inbox. Replying is capturing.

const RECENT_DAYS = 14;
const PULSE_FRESH_DAYS = 14;
const PREVIOUS_DIGESTS = 3;

export interface DigestKid {
  childId: string;
  name: string;
  ageLabel: string;
  pulse: string | null;
  question: string;
  thread: string;
}

export interface DigestContent {
  dateLabel: string;
  kids: DigestKid[];
  pending: { count: number; snippets: string[] };
  recipients: { profileId: string; name: string; email: string }[];
}

export async function buildDigestContent(sb: AnySupabase): Promise<DigestContent> {
  const { data: parents, error: pError } = await sb
    .from("profiles")
    .select("id, name, email")
    .eq("role", "parent")
    .not("email", "is", null);
  if (pError) throw new Error(`[digest] parents: ${pError.message}`);
  const recipients = (parents ?? [])
    .map((p) => ({
      profileId: p.id as string,
      name: p.name as string,
      email: String(p.email).trim(),
    }))
    .filter((r) => isDeliverable(r.email));
  if (recipients.length === 0) throw new Error("[digest] no parent profiles with an email");

  const { data: links, error: lError } = await sb
    .from("parent_children")
    .select("children(id, name, date_of_birth)")
    .in(
      "parent_id",
      recipients.map((r) => r.profileId)
    );
  if (lError) throw new Error(`[digest] kids: ${lError.message}`);
  const seen = new Set<string>();
  const kids = ((links ?? []) as { children: unknown }[])
    .map((row) => row.children as { id: string; name: string; date_of_birth: string | null } | null)
    .filter((k): k is { id: string; name: string; date_of_birth: string | null } =>
      Boolean(k && !seen.has(k.id) && seen.add(k.id))
    )
    .sort((a, b) => (a.date_of_birth ?? "9999").localeCompare(b.date_of_birth ?? "9999"));
  if (kids.length === 0) throw new Error("[digest] no kids on file");

  const sinceIso = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const perKid = await Promise.all(
    kids.map(async (kid) => {
      const [fileContext, obsRes, pulseRes] = await Promise.all([
        buildFileContext(kid.id, sb),
        sb
          .from("observations")
          .select("note, source, created_at")
          .eq("child_id", kid.id)
          .gte("created_at", sinceIso)
          .order("created_at", { ascending: false })
          .limit(8),
        sb
          .from("child_summaries")
          .select("pulse, latest_observation_at")
          .eq("child_id", kid.id)
          .maybeSingle(),
      ]);
      const recentMoments = (obsRes.data ?? [])
        .map(
          (o: { created_at: string; source?: string; note: string }) =>
            `[${familyFormatDate(o.created_at)}] (${o.source === "parent" ? "parent" : "teacher"}) ${o.note}`
        )
        .join("\n");
      const latest = pulseRes.data?.latest_observation_at
        ? new Date(pulseRes.data.latest_observation_at).getTime()
        : 0;
      const pulseFresh = Date.now() - latest <= PULSE_FRESH_DAYS * 24 * 60 * 60 * 1000;
      return {
        childId: kid.id,
        name: kid.name,
        ageLabel: formatAge(kid.date_of_birth) || "unknown age",
        fileContext,
        recentMoments,
        pulse: pulseFresh ? ((pulseRes.data?.pulse as string | null) ?? null) : null,
      };
    })
  );

  const { data: previous } = await sb
    .from("family_digests")
    .select("questions")
    .order("sent_at", { ascending: false })
    .limit(PREVIOUS_DIGESTS);
  const previousQuestions = (previous ?? []).flatMap((d) =>
    (Array.isArray(d.questions) ? d.questions : []).map(
      (q: { name?: string; question?: string }) => `${q.name ?? ""}: ${q.question ?? ""}`
    )
  );

  const prompt = buildDigestQuestionsPrompt({
    parentNames: recipients.map((r) => r.name).join(" and "),
    kids: perKid.map((k) => ({
      name: k.name,
      ageLabel: k.ageLabel,
      fileContext: k.fileContext,
      recentMoments: k.recentMoments,
    })),
    previousQuestions,
    todayLabel: familyFormatDate(new Date(), {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  });
  const { text } = await callAI(prompt, "Write the questions now.", {
    promptType: "digest_questions",
    maxOutputTokens: 900,
  });
  const parsed = parseAIResponse(text, DigestQuestionsSchema);
  const byName = new Map(
    parsed.questions.map((q) => [q.name.trim().toLowerCase(), q] as const)
  );

  const digestKids: DigestKid[] = perKid.map((k) => {
    const q = byName.get(k.name.trim().toLowerCase());
    return {
      childId: k.childId,
      name: k.name,
      ageLabel: k.ageLabel,
      pulse: k.pulse,
      question: q?.question.trim() || fallbackQuestion(k.name, k.recentMoments),
      thread: q?.thread.trim() || "fallback",
    };
  });

  const { data: pendingRows, error: pendError } = await sb
    .from("captures")
    .select("transcript")
    .in("status", [...INBOX_STATUSES])
    .neq("channel", "app")
    .order("created_at", { ascending: false })
    .limit(50);
  if (pendError) console.warn("[digest] inbox unavailable:", pendError.message);
  const pendingAll = pendingRows ?? [];

  return {
    dateLabel: familyFormatDate(new Date(), { weekday: "long", month: "long", day: "numeric" }),
    kids: digestKids,
    pending: {
      count: pendingAll.length,
      snippets: pendingAll.slice(0, 3).map((r) => snippet(String(r.transcript))),
    },
    recipients,
  };
}

// If the model skipped a kid, still hand the parent a thread.
function fallbackQuestion(name: string, recentMoments: string): string {
  const last = recentMoments.split("\n")[0]?.replace(/^\[[^\]]+\]\s*\([^)]+\)\s*/, "");
  return last
    ? `Last time you noted: "${snippet(last, 90)}" — anything new on that?`
    : `What's ${name} been into this week — one thing is plenty.`;
}

function snippet(text: string, max = 120): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Pure: the same content renders to HTML and text (and a preview page).
export function renderDigestEmail(content: DigestContent, opts: { appUrl: string; canReply: boolean }) {
  const { kids, pending, dateLabel } = content;
  const names = kids.map((k) => k.name).join(", ");
  const subject = `${dateLabel}: ${names}`;
  const inboxUrl = `${opts.appUrl}/parent/inbox`;
  const captureUrl = `${opts.appUrl}/capture`;

  const replyLine = opts.canReply
    ? "Just reply to this email — one line per question is plenty. Replies land in your Orbit inbox for a quick OK."
    : `Answer in Orbit when you have a minute: ${captureUrl}`;

  const text = [
    `Orbit · ${dateLabel}`,
    "",
    ...kids.flatMap((k) => [
      `${k.name.toUpperCase()} (${k.ageLabel})`,
      ...(k.pulse ? [k.pulse] : []),
      `→ ${k.question}`,
      "",
    ]),
    replyLine,
    "",
    ...(pending.count > 0
      ? [
          `${pending.count} moment${pending.count === 1 ? "" : "s"} waiting for your OK:`,
          ...pending.snippets.map((s) => `  · ${s}`),
          `Review: ${inboxUrl}`,
          "",
        ]
      : []),
    `— Orbit`,
  ].join("\n");

  const kidBlocks = kids
    .map(
      (k) => `
      <tr><td style="padding:0 0 22px 0;">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:19px;color:#1C2429;font-weight:600;">${esc(k.name)} <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#566670;font-weight:400;">${esc(k.ageLabel)}</span></div>
        ${k.pulse ? `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#566670;margin-top:4px;">${esc(k.pulse)}</div>` : ""}
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1C2429;margin-top:8px;padding:10px 14px;background:#EDF0F1;border-left:3px solid #2F6E95;border-radius:0 10px 10px 0;">${esc(k.question)}</div>
      </td></tr>`
    )
    .join("");

  const pendingBlock =
    pending.count > 0
      ? `
      <tr><td style="padding:18px 0 0 0;border-top:1px solid #D7DDE0;">
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#566670;font-weight:700;">📥 ${pending.count} moment${pending.count === 1 ? "" : "s"} waiting for your OK</div>
        ${pending.snippets.map((s) => `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#1C2429;margin-top:6px;">· ${esc(s)}</div>`).join("")}
        <div style="margin-top:12px;"><a href="${esc(inboxUrl)}" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;color:#2F6E95;font-weight:600;">Review them →</a></div>
      </td></tr>`
      : "";

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#F3F5F6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F5F6;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FBFCFC;border-radius:18px;padding:28px 26px;">
  <tr><td style="padding:0 0 18px 0;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#1C2429;letter-spacing:.02em;">orbit <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:linear-gradient(120deg,#3E97DE,#B097D6,#C4D24C);vertical-align:middle;"></span></div>
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#566670;margin-top:2px;">${esc(dateLabel)}</div>
  </td></tr>
  ${kidBlocks}
  <tr><td style="padding:0 0 18px 0;">
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#566670;">${esc(replyLine)}</div>
  </td></tr>
  ${pendingBlock}
</table>
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;color:#8A959C;margin-top:14px;">Orbit, the boys' story kept safe · <a href="${esc(opts.appUrl)}/parent" style="color:#8A959C;">open the app</a></div>
</td></tr></table>
</body></html>`;

  return { subject, html, text };
}
