import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { extractReplyText } from "../email-reply";
import { verifyWebhookSignature, bareAddress } from "../email";
import { renderDigestEmail } from "../digest";

describe("extractReplyText", () => {
  it("keeps the reply and drops a Gmail quote", () => {
    const text =
      "Still going — he built one taller than the fridge yesterday.\n\nOn Tue, Nov 3, 2026 at 8:02 AM Orbit <orbit@x.resend.app> wrote:\n> MATEO (5 yr)\n> → Still into building towers?";
    expect(extractReplyText(text, null)).toBe(
      "Still going — he built one taller than the fridge yesterday."
    );
  });

  it("handles a wrapped 'On … wrote:' line and quoted lines", () => {
    const text =
      "Yes, feeds the dog every morning now.\nNo nudge needed.\n\nOn Tue, Nov 3, 2026 at 8:02 AM Orbit\n<orbit@x.resend.app> wrote:\n\n> …";
    expect(extractReplyText(text, null)).toBe(
      "Yes, feeds the dog every morning now.\nNo nudge needed."
    );
  });

  it("stops at an Outlook header block and a phone signature", () => {
    expect(
      extractReplyText("Pool happened Saturday.\n\nSent from my iPhone\n\nFrom: Orbit\nSent: …", null)
    ).toBe("Pool happened Saturday.");
    expect(
      extractReplyText("Pool happened Saturday.\n________________________________\nFrom: Orbit", null)
    ).toBe("Pool happened Saturday.");
  });

  it("falls back to HTML and cuts before the quote container", () => {
    const html =
      '<div dir="ltr">He asked for the pool twice.<br>Both times.</div><br><div class="gmail_quote">On Tue… wrote:<blockquote>…</blockquote></div>';
    expect(extractReplyText("", html)).toBe("He asked for the pool twice.\nBoth times.");
  });
});

describe("verifyWebhookSignature", () => {
  const key = Buffer.from("0123456789abcdef0123456789abcdef");
  const secret = "whsec_" + key.toString("base64");
  const body = '{"type":"email.received","data":{"email_id":"abc"}}';
  const id = "msg_1";
  const now = 1_800_000_000;
  const sign = (ts: number) =>
    "v1," + createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");

  it("accepts a valid signature among several", () => {
    const sig = `v1,bogus ${sign(now)}`;
    expect(
      verifyWebhookSignature(body, { id, timestamp: String(now), signature: sig }, secret, now)
    ).toBe(true);
  });

  it("rejects a tampered body, a bad secret, and a stale timestamp", () => {
    expect(
      verifyWebhookSignature(body + " ", { id, timestamp: String(now), signature: sign(now) }, secret, now)
    ).toBe(false);
    expect(
      verifyWebhookSignature(body, { id, timestamp: String(now), signature: sign(now) }, "whsec_AAAA", now)
    ).toBe(false);
    const old = now - 3600;
    expect(
      verifyWebhookSignature(body, { id, timestamp: String(old), signature: sign(old) }, secret, now)
    ).toBe(false);
  });
});

describe("renderDigestEmail", () => {
  const content = {
    dateLabel: "Tuesday, November 3",
    kids: [
      { childId: "a", name: "Mateo", ageLabel: "5 yr", pulse: "Mateo's been building towers taller than himself.", question: "Still into the towers, or has he moved on?", thread: "interest: towers" },
      { childId: "b", name: "Luca", ageLabel: "4 yr", pulse: null, question: "Did feeding the dog happen without a nudge this week?", thread: "ritual: dog" },
    ],
    pending: { count: 2, snippets: ["He asked for the pool twice", "Luca counted to 30 <in the car>"] },
    recipients: [{ profileId: "p", name: "Ana", email: "ana@example.com" }],
  };

  it("carries every question in both text and html, escaped", () => {
    const { subject, text, html } = renderDigestEmail(content, {
      appUrl: "https://orbit.example",
      canReply: true,
    });
    expect(subject).toBe("Tuesday, November 3: Mateo, Luca");
    for (const k of content.kids) {
      expect(text).toContain(k.question);
      expect(html).toContain(k.question);
    }
    expect(text).toContain("Just reply to this email");
    expect(html).toContain("&lt;in the car&gt;");
    expect(html).toContain("https://orbit.example/parent/inbox");
  });

  it("points at the app instead of reply when inbound mail is off", () => {
    const { text } = renderDigestEmail(content, { appUrl: "https://orbit.example", canReply: false });
    expect(text).not.toContain("Just reply");
    expect(text).toContain("https://orbit.example/capture");
  });
});

describe("bareAddress", () => {
  it("strips display names", () => {
    expect(bareAddress("Miguel <M@Example.com>")).toBe("m@example.com");
    expect(bareAddress("plain@example.com")).toBe("plain@example.com");
  });
});
