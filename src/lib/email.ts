import { createHmac, timingSafeEqual } from "node:crypto";

// Outbound + inbound email through Resend's REST API (no SDK). Sending needs
// RESEND_API_KEY and a from address; receiving needs a webhook signing
// secret. Everything degrades to a clear "not configured" error rather
// than failing silently.

const API = "https://api.resend.com";

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

// `Orbit <onboarding@resend.dev>` only delivers to the Resend account's own
// address — a verified domain is needed for the second parent.
export function emailFrom(): string {
  return process.env.RESEND_FROM || "Orbit <onboarding@resend.dev>";
}

// The Resend receiving address family: every username at this domain is
// delivered to the inbound webhook, so replies can carry the digest id as
// a plus-tag (orbit+<digestId>@<domain>).
export function inboundDomain(): string | null {
  return process.env.RESEND_INBOUND_DOMAIN?.trim() || null;
}

export function replyAddressFor(digestId: string): string | null {
  const domain = inboundDomain();
  return domain ? `orbit+${digestId}@${domain}` : null;
}

export async function sendEmail(message: {
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  idempotencyKey?: string;
}): Promise<{ id: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const res = await fetch(`${API}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: emailFrom(),
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.replyTo ? { reply_to: message.replyTo } : {}),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok || !body.id) {
    throw new Error(`Resend send failed (${res.status}): ${body.message ?? "unknown error"}`);
  }
  return { id: body.id };
}

export interface ReceivedEmail {
  id: string;
  from: string;
  to: string[];
  subject: string | null;
  text: string | null;
  html: string | null;
}

export async function getReceivedEmail(id: string): Promise<ReceivedEmail> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const res = await fetch(`${API}/emails/receiving/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const body = (await res.json().catch(() => ({}))) as Partial<ReceivedEmail> & {
    message?: string;
  };
  if (!res.ok || !body.id) {
    throw new Error(`Resend receive failed (${res.status}): ${body.message ?? "unknown error"}`);
  }
  return {
    id: body.id,
    from: String(body.from ?? ""),
    to: Array.isArray(body.to) ? body.to.map(String) : [],
    subject: body.subject ?? null,
    text: body.text ?? null,
    html: body.html ?? null,
  };
}

// Svix-style signature (what Resend uses): HMAC-SHA256 over
// "<svix-id>.<svix-timestamp>.<raw body>" with the base64-decoded secret
// (after its "whsec_" prefix); the header may list several "v1,<sig>".
const TIMESTAMP_TOLERANCE_S = 5 * 60;

export function verifyWebhookSignature(
  rawBody: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > TIMESTAMP_TOLERANCE_S) return false;

  const keyB64 = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const expected = createHmac("sha256", Buffer.from(keyB64, "base64"))
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest();

  return signature.split(" ").some((entry) => {
    const [version, sig] = entry.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

// Reserved TLDs and example domains never deliver (RFC 2606/6761). Test
// logins such as a dev account on ".test" must not be mailed: once a real
// sending domain is verified, each attempt is a hard bounce against it.
const NEVER_DELIVERS = /(\.(test|example|invalid|localhost)|@example\.(com|org|net))$/i;

export function isDeliverable(address: string): boolean {
  const a = address.trim();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a) && !NEVER_DELIVERS.test(a);
}

/** Extract "name@host" from "Name <name@host>" or a bare address. */
export function bareAddress(value: string): string {
  const match = value.match(/<([^>]+)>/);
  return (match ? match[1] : value).trim().toLowerCase();
}
