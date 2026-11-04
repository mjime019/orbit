"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { familyFormatDate } from "@/lib/tz";
import {
  DOMAIN_CONFIG,
  SOCIAL_TAG_CONFIG,
  type DevDomain,
  type SocialTag,
} from "@/lib/types";

// Review for the inbox channels — the same per-child cards the in-app
// capture uses, so what reaches a kid's file is held to one standard
// whichever door the words came through.

interface RosterEntry {
  id: string;
  name: string;
  age: number | null;
}

interface ExtractedChild {
  child_id: string | null;
  name?: string;
  observation_summary?: string;
  domains?: string[];
  social_moments?: { type: string; description: string; with_whom: string[] }[];
  direct_quotes?: string[];
  notable?: boolean;
  notable_reason?: string | null;
}

interface InboxItem {
  id: string;
  created_at: string;
  channel: "later" | "shortcut" | "email";
  transcript: string;
  context_note: string | null;
  status: "draft" | "processed";
  author_profile_id: string | null;
  child_ids: string[];
  children: ExtractedChild[];
}

interface CardState {
  key: number;
  childId: string | null;
  include: boolean;
  note: string;
  domains: DevDomain[];
  socialTag: SocialTag | null;
}

const CHANNEL_META: Record<InboxItem["channel"], { emoji: string; label: string }> = {
  later: { emoji: "✏️", label: "Saved for later" },
  shortcut: { emoji: "🎙️", label: "From your shortcut" },
  email: { emoji: "✉️", label: "Email reply" },
};

function buildNote(c: ExtractedChild): string {
  const parts = [c.observation_summary?.trim()].filter(Boolean) as string[];
  if (c.direct_quotes?.length) parts.push(c.direct_quotes.map((q) => `"${q}"`).join(" · "));
  if (c.notable && c.notable_reason) parts.push(`Notable: ${c.notable_reason}`);
  return parts.join(" — ");
}

function buildCards(children: ExtractedChild[]): CardState[] {
  return children.map((c, i) => ({
    key: i,
    childId: c.child_id,
    include: Boolean(c.child_id),
    note: buildNote(c),
    domains: (c.domains ?? []).filter((d): d is DevDomain =>
      Object.prototype.hasOwnProperty.call(DOMAIN_CONFIG, d)
    ),
    socialTag:
      ((c.social_moments ?? [])
        .map((m) => m.type)
        .find((t) => Object.prototype.hasOwnProperty.call(SOCIAL_TAG_CONFIG, t)) as
        | SocialTag
        | undefined) ?? null,
  }));
}

export function InboxReview({ reviewerProfileId }: { reviewerProfileId: string }) {
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/inbox");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load the inbox");
      setItems(data.items);
      setRoster(data.roster ?? []);
      setUnavailable(Boolean(data.unavailable));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the inbox");
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = (id: string) =>
    setItems((prev) => (prev ? prev.filter((i) => i.id !== id) : prev));

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 rounded-xl text-sm text-red-700">{error}</div>
      )}
      {unavailable && !error && (
        <div className="mb-4 p-3 bg-golden/10 rounded-xl text-xs text-espresso">
          The inbox isn&apos;t set up yet — run scripts/pivot/10-inbox-digest.sql in
          Supabase, then come back.
        </div>
      )}

      {items === null ? (
        <div className="space-y-3">
          <div className="animate-pulse bg-sand-dark/40 rounded-2xl h-28" />
          <div className="animate-pulse bg-sand-dark/40 rounded-2xl h-28" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-sand rounded-2xl px-6 py-10 text-center">
          <span className="text-3xl">📥</span>
          <p className="text-sm font-semibold text-espresso mt-3">Nothing waiting</p>
          <p className="text-xs text-warm-gray mt-1.5 leading-relaxed max-w-[340px] mx-auto">
            Anything you jot from the shortcut, reply by email, or save for later in
            the app lands here for a quick OK before it joins the boys&apos; story.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {items.map((item) => (
            <InboxCard
              key={item.id}
              item={item}
              roster={roster}
              reviewerProfileId={reviewerProfileId}
              onDone={() => remove(item.id)}
              onUpdated={(children, status) =>
                setItems((prev) =>
                  prev
                    ? prev.map((i) => (i.id === item.id ? { ...i, children, status } : i))
                    : prev
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InboxCard({
  item,
  roster,
  reviewerProfileId,
  onDone,
  onUpdated,
}: {
  item: InboxItem;
  roster: RosterEntry[];
  reviewerProfileId: string;
  onDone: () => void;
  onUpdated: (children: ExtractedChild[], status: InboxItem["status"]) => void;
}) {
  const [cards, setCards] = useState<CardState[]>(() => buildCards(item.children));
  const [showWords, setShowWords] = useState(item.children.length === 0);
  const [busy, setBusy] = useState<"save" | "dismiss" | "extract" | null>(null);
  const [error, setError] = useState("");

  const updateCard = (key: number, patch: Partial<CardState>) =>
    setCards((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));

  const toggleDomain = (key: number, domain: DevDomain) =>
    setCards((prev) =>
      prev.map((c) =>
        c.key === key
          ? {
              ...c,
              domains: c.domains.includes(domain)
                ? c.domains.filter((d) => d !== domain)
                : [...c.domains, domain],
            }
          : c
      )
    );

  const confirmable = cards.filter((c) => c.include && c.childId && c.note.trim());

  const save = async () => {
    if (confirmable.length === 0 || busy) return;
    setBusy("save");
    setError("");
    try {
      const res = await fetch("/api/capture/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          captureId: item.id,
          source: "parent",
          // The words stay attributed to whoever said them.
          authorProfileId: item.author_profile_id ?? reviewerProfileId,
          classroomId: null,
          observations: confirmable.map((c) => ({
            child_id: c.childId,
            note: c.note,
            domains: c.domains,
            social_tag: c.socialTag,
            other_children_ids: [],
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
      setBusy(null);
    }
  };

  const dismiss = async () => {
    if (busy) return;
    setBusy("dismiss");
    setError("");
    try {
      const res = await fetch("/api/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, status: "dismissed" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't dismiss");
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't dismiss");
      setBusy(null);
    }
  };

  const extract = async () => {
    if (busy) return;
    setBusy("extract");
    setError("");
    try {
      const res = await fetch("/api/inbox/reprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't extract");
      const children = (data.children ?? []) as ExtractedChild[];
      setCards(buildCards(children));
      setShowWords(children.length === 0);
      onUpdated(children, "processed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't extract");
    } finally {
      setBusy(null);
    }
  };

  const meta = CHANNEL_META[item.channel] ?? CHANNEL_META.later;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-sand-dark/40">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-lavender/40 text-espresso">
          {meta.emoji} {meta.label}
        </span>
        <span className="text-[11px] text-warm-gray">
          {familyFormatDate(item.created_at, { weekday: "short", month: "short", day: "numeric" })}
        </span>
      </div>

      {item.context_note && (
        <p className="text-[11px] text-warm-gray leading-relaxed mb-2 whitespace-pre-line">
          {item.context_note}
        </p>
      )}

      <button
        onClick={() => setShowWords((v) => !v)}
        className="text-[11px] font-medium text-rust underline underline-offset-2 mb-2"
      >
        {showWords ? "Hide your words" : "Your words"}
      </button>
      {showWords && (
        <p className="text-sm text-espresso/85 leading-relaxed bg-cream rounded-xl px-3 py-2.5 mb-3 whitespace-pre-line">
          {item.transcript}
        </p>
      )}

      {error && (
        <div className="mb-3 p-3 bg-red-50 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {item.status === "draft" ? (
        <div className="bg-golden/10 rounded-xl p-3 text-xs text-espresso">
          Your words are saved; Orbit couldn&apos;t sort them when they arrived.
          <button
            onClick={extract}
            disabled={busy !== null}
            className="block mt-2 text-xs font-semibold text-rust disabled:opacity-40"
          >
            {busy === "extract" ? "🧠 Sorting…" : "Sort them now →"}
          </button>
        </div>
      ) : cards.length === 0 ? (
        <div className="bg-sand rounded-xl p-3 text-xs text-espresso">
          Nothing specific was picked out of these words.
          <button
            onClick={extract}
            disabled={busy !== null}
            className="ml-2 text-xs font-semibold text-rust disabled:opacity-40"
          >
            {busy === "extract" ? "🧠 Trying again…" : "Try again"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((card) => (
            <div key={card.key} className="rounded-xl border border-sand-dark/50 p-3">
              <div className="flex items-center justify-between mb-2">
                <select
                  value={card.childId ?? ""}
                  onChange={(e) =>
                    updateCard(card.key, {
                      childId: e.target.value || null,
                      include: Boolean(e.target.value),
                    })
                  }
                  className="text-sm font-semibold text-espresso bg-sand rounded-lg px-3 py-1.5 outline-none"
                >
                  <option value="">Assign to…</option>
                  {roster.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-xs text-warm-gray">
                  <input
                    type="checkbox"
                    checked={card.include}
                    onChange={(e) => updateCard(card.key, { include: e.target.checked })}
                  />
                  Save this
                </label>
              </div>
              {!card.childId && (
                <p className="text-xs text-rust mb-2">
                  Couldn&apos;t match this to a kid — pick one above or leave it unsaved.
                </p>
              )}
              <textarea
                value={card.note}
                onChange={(e) => updateCard(card.key, { note: e.target.value })}
                rows={3}
                className="w-full bg-cream rounded-xl p-3 text-sm text-espresso leading-relaxed resize-none outline-none border border-sand-dark/50 focus:border-rust/50 transition-colors"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(Object.keys(DOMAIN_CONFIG) as DevDomain[]).map((domain) => (
                  <button
                    key={domain}
                    onClick={() => toggleDomain(card.key, domain)}
                    className={`text-[11px] px-2.5 py-1 rounded-full transition-all ${
                      card.domains.includes(domain) ? "bg-rust text-white" : "bg-sand text-warm-gray"
                    }`}
                  >
                    {DOMAIN_CONFIG[domain].emoji} {DOMAIN_CONFIG[domain].label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {(Object.keys(SOCIAL_TAG_CONFIG) as SocialTag[]).map((tag) => (
                  <button
                    key={tag}
                    onClick={() =>
                      updateCard(card.key, { socialTag: card.socialTag === tag ? null : tag })
                    }
                    className={`text-[11px] px-2.5 py-1 rounded-full transition-all ${
                      card.socialTag === tag ? "bg-espresso text-white" : "bg-sand text-warm-gray"
                    }`}
                  >
                    {SOCIAL_TAG_CONFIG[tag].emoji} {SOCIAL_TAG_CONFIG[tag].label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-sand-dark/30">
        {item.status === "processed" && cards.length > 0 && (
          <button
            onClick={save}
            disabled={confirmable.length === 0 || busy !== null}
            className="px-5 py-2 bg-rust text-white rounded-full text-xs font-semibold shadow-sm disabled:opacity-40"
          >
            {busy === "save"
              ? "Saving…"
              : `✓ Save ${confirmable.length || ""} moment${confirmable.length === 1 ? "" : "s"}`}
          </button>
        )}
        <button
          onClick={dismiss}
          disabled={busy !== null}
          className="text-xs text-warm-gray/80 ml-auto disabled:opacity-40"
        >
          {busy === "dismiss" ? "Removing…" : "Not a moment"}
        </button>
      </div>
      {item.status === "processed" && cards.length > 0 && (
        <p className="text-[11px] text-warm-gray mt-2">
          Want to add detail first?{" "}
          <Link href="/capture" className="text-rust underline underline-offset-2">
            Capture it fully instead →
          </Link>
        </p>
      )}
    </div>
  );
}
