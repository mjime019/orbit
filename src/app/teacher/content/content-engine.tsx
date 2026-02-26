"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { DomainPill } from "@/components/ui/domain-pill";
import { SectionHead } from "@/components/ui/section-head";
import { supabase } from "@/lib/supabase";
import {
  SOCIAL_TAG_CONFIG,
  type DevDomain,
  type SocialTag,
  type Observation,
  type Highlight,
} from "@/lib/types";

type Screen = "select" | "dashboard" | "highlight" | "digest";

interface ContentEngineProps {
  roster: { id: string; name: string; date_of_birth: string | null }[];
  classroomName: string;
  classroomTheme: string | null;
}

interface DigestDraft {
  id: string;
  title: string | null;
  content: string;
  domains_covered: DevDomain[];
  period_start: string;
  period_end: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getCurrentWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return {
    start: monday.toISOString().split("T")[0],
    end: friday.toISOString().split("T")[0],
    label: `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${friday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
  };
}

export function ContentEngine({
  roster,
  classroomName,
  classroomTheme,
}: ContentEngineProps) {
  const [screen, setScreen] = useState<Screen>("select");
  const [selectedChild, setSelectedChild] = useState<
    (typeof roster)[0] | null
  >(null);

  // Dashboard data
  const [pendingObs, setPendingObs] = useState<Observation[]>([]);
  const [draftHighlights, setDraftHighlights] = useState<Highlight[]>([]);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Highlight editor
  const [currentHighlight, setCurrentHighlight] = useState<Highlight | null>(
    null
  );
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editSummary, setEditSummary] = useState("");

  // Digest editor
  const [currentDigest, setCurrentDigest] = useState<DigestDraft | null>(null);
  const [editDigestTitle, setEditDigestTitle] = useState("");
  const [editDigestContent, setEditDigestContent] = useState("");

  // Shared
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadChildData = useCallback(async (childId: string) => {
    setIsLoadingDashboard(true);
    setError(null);

    const [obsRes, hlRes] = await Promise.all([
      supabase
        .from("observations")
        .select("*")
        .eq("child_id", childId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("highlights")
        .select("*")
        .eq("child_id", childId)
        .order("created_at", { ascending: false }),
    ]);

    const allHighlights = (hlRes.data ?? []) as Highlight[];
    const usedObsIds = allHighlights.flatMap(
      (h) => (h as Highlight & { observation_ids?: string[] }).observation_ids ?? []
    );
    const allObs = (obsRes.data ?? []) as Observation[];
    const pending = allObs.filter((o) => !usedObsIds.includes(o.id));
    const drafts = allHighlights.filter((h) => h.status === "draft");

    setPendingObs(pending);
    setDraftHighlights(drafts);
    setIsLoadingDashboard(false);
  }, []);

  const selectChild = async (child: (typeof roster)[0]) => {
    setSelectedChild(child);
    setSelectedIds(new Set());
    setError(null);
    setSuccessMessage(null);
    setScreen("dashboard");
    await loadChildData(child.id);
  };

  const toggleObservation = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 3) {
        next.add(id);
      }
      return next;
    });
  };

  const handleGenerateHighlight = async () => {
    if (!selectedChild || selectedIds.size === 0) return;
    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/teacher/highlight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childId: selectedChild.id,
          observationIds: Array.from(selectedIds),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      setCurrentHighlight(data);
      setEditTitle(data.title ?? "");
      setEditContent(data.content ?? "");
      setEditSummary(data.summary ?? "");
      setScreen("highlight");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not generate highlight"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditDraft = (highlight: Highlight) => {
    setCurrentHighlight(highlight);
    setEditTitle(highlight.title ?? "");
    setEditContent(highlight.content ?? "");
    setEditSummary(highlight.summary ?? "");
    setScreen("highlight");
  };

  const handleSendHighlight = async () => {
    if (!currentHighlight) return;
    setIsSending(true);
    setError(null);

    try {
      const res = await fetch("/api/teacher/highlight/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          highlightId: currentHighlight.id,
          title: editTitle,
          content: editContent,
          summary: editSummary,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");

      setSuccessMessage("Highlight sent to parents!");
      setCurrentHighlight(null);
      setSelectedIds(new Set());
      setScreen("dashboard");
      if (selectedChild) await loadChildData(selectedChild.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setIsSending(false);
    }
  };

  const handleGenerateDigest = async () => {
    if (!selectedChild) return;
    setIsGenerating(true);
    setError(null);

    const week = getCurrentWeekBounds();

    try {
      const res = await fetch("/api/teacher/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childId: selectedChild.id,
          periodStart: periodStart(),
          periodEnd: periodEnd(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      setCurrentDigest(data);
      setEditDigestTitle(data.title ?? "");
      setEditDigestContent(data.content ?? "");
      setScreen("digest");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not generate digest"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendDigest = async () => {
    if (!currentDigest) return;
    setIsSending(true);
    setError(null);

    try {
      const res = await fetch("/api/teacher/digest/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          digestId: currentDigest.id,
          title: editDigestTitle,
          content: editDigestContent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");

      setSuccessMessage("Weekly digest sent to parents!");
      setCurrentDigest(null);
      setScreen("dashboard");
      if (selectedChild) await loadChildData(selectedChild.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setIsSending(false);
    }
  };

  // Helper: week bounds for the digest button
  const week = getCurrentWeekBounds();
  const periodStart = () => week.start;
  const periodEnd = () => week.end;

  // ─── SELECT CHILD ────────────────────────────────────────
  if (screen === "select") {
    return (
      <div className="min-h-screen bg-cream">
        <div className="mx-auto max-w-[520px] px-6 pt-7 pb-24">
          <div className="fade-up flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rust" />
                <span className="text-xs font-bold tracking-widest uppercase text-rust">
                  Orbit
                </span>
              </div>
              <h1 className="font-[family-name:var(--font-playfair)] text-[26px] font-semibold leading-tight text-espresso">
                Content Engine
              </h1>
              <p className="text-sm text-warm-gray mt-1">
                {classroomName}
                {classroomTheme && (
                  <span className="text-rust"> &middot; {classroomTheme}</span>
                )}
              </p>
            </div>
            <Link
              href="/teacher"
              className="w-10 h-10 rounded-full border-2 border-sand-dark bg-white text-sm flex items-center justify-center hover:shadow-md transition-shadow"
            >
              &larr;
            </Link>
          </div>

          <SectionHead emoji={"\u{1F466}"} title="Select a Child" />

          {roster.length === 0 ? (
            <Card>
              <p className="text-sm text-warm-gray text-center">
                No children found in this classroom.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {roster.map((child, i) => (
                <button
                  key={child.id}
                  onClick={() => selectChild(child)}
                  className={`fade-up delay-${Math.min(i + 1, 6)} flex flex-col items-center gap-2 p-4 rounded-2xl bg-white shadow-sm hover:shadow-md transition-all active:scale-95`}
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rust to-[#E8945A] text-white text-lg font-bold flex items-center justify-center font-[family-name:var(--font-playfair)]">
                    {child.name.charAt(0)}
                  </div>
                  <span className="text-xs font-semibold text-espresso">
                    {child.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── DASHBOARD ───────────────────────────────────────────
  if (screen === "dashboard") {
    return (
      <div className="min-h-screen bg-cream">
        <div className="mx-auto max-w-[520px] px-6 pt-7 pb-24">
          {/* Header */}
          <div className="fade-up flex items-center gap-3 mb-6">
            <button
              onClick={() => {
                setScreen("select");
                setSuccessMessage(null);
              }}
              className="w-10 h-10 rounded-full border-2 border-sand-dark bg-white text-sm flex items-center justify-center hover:shadow-md transition-shadow"
            >
              &larr;
            </button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rust to-[#E8945A] text-white text-sm font-bold flex items-center justify-center font-[family-name:var(--font-playfair)]">
              {selectedChild?.name.charAt(0)}
            </div>
            <div className="flex-1">
              <h2 className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-espresso">
                {selectedChild?.name}
              </h2>
              <p className="text-xs text-warm-gray">Content Engine</p>
            </div>
          </div>

          {/* Success message */}
          {successMessage && (
            <div className="fade-up mb-4 px-4 py-2.5 rounded-xl bg-sage/10 text-sage text-sm font-semibold text-center">
              {successMessage}
            </div>
          )}

          {isLoadingDashboard ? (
            <div className="flex items-center justify-center py-16">
              <span className="w-6 h-6 border-2 border-rust/30 border-t-rust rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Pending Observations */}
              <SectionHead
                emoji={"\u{1F4DD}"}
                title="Needs Highlights"
                subtitle={
                  pendingObs.length > 0
                    ? `${pendingObs.length} observation${pendingObs.length !== 1 ? "s" : ""} — select 1-3`
                    : undefined
                }
              />

              {pendingObs.length === 0 ? (
                <Card className="fade-up delay-1 mb-6">
                  <p className="text-sm text-warm-gray text-center">
                    All observations have highlights. Nice work!
                  </p>
                </Card>
              ) : (
                <div className="fade-up delay-1 space-y-2 mb-4">
                  {pendingObs.map((obs) => {
                    const isSelected = selectedIds.has(obs.id);
                    return (
                      <button
                        key={obs.id}
                        onClick={() => toggleObservation(obs.id)}
                        className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                          isSelected
                            ? "border-rust bg-rust/5 shadow-sm"
                            : "border-sand-dark bg-white hover:border-warm-gray/30"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center text-xs transition-colors flex-shrink-0 ${
                              isSelected
                                ? "border-rust bg-rust text-white"
                                : "border-sand-dark"
                            }`}
                          >
                            {isSelected && "\u2713"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] leading-relaxed text-espresso line-clamp-2">
                              {obs.note}
                            </p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {obs.domains?.map((d) => (
                                <DomainPill key={d} domain={d} />
                              ))}
                              {obs.social_tag && (
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-sand font-semibold text-warm-gray">
                                  {SOCIAL_TAG_CONFIG[obs.social_tag]?.emoji}{" "}
                                  {SOCIAL_TAG_CONFIG[obs.social_tag]?.label}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-warm-gray mt-1.5">
                              {formatDate(obs.created_at)}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Generate Highlight button */}
              {pendingObs.length > 0 && (
                <button
                  onClick={handleGenerateHighlight}
                  disabled={selectedIds.size === 0 || isGenerating}
                  className="fade-up delay-2 mb-8 w-full py-4 rounded-2xl font-semibold text-white transition-all disabled:opacity-40 bg-rust hover:bg-rust/90 active:scale-[0.98]"
                >
                  {isGenerating ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Generating...
                    </span>
                  ) : (
                    `Generate Highlight (${selectedIds.size} selected)`
                  )}
                </button>
              )}

              {/* Error */}
              {error && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Draft Highlights */}
              {draftHighlights.length > 0 && (
                <>
                  <SectionHead
                    emoji={"\u270F\uFE0F"}
                    title="Draft Highlights"
                    subtitle="Tap to edit and send"
                  />
                  <div className="fade-up delay-3 space-y-2 mb-8">
                    {draftHighlights.map((hl) => (
                      <button
                        key={hl.id}
                        onClick={() => handleEditDraft(hl)}
                        className="w-full text-left p-4 rounded-2xl bg-white border-2 border-golden/30 hover:border-golden/60 transition-all"
                      >
                        <p className="text-xs font-bold text-golden uppercase tracking-wider mb-1">
                          Draft
                        </p>
                        <p className="font-[family-name:var(--font-playfair)] text-[15px] font-semibold text-espresso">
                          {hl.title || "Untitled Highlight"}
                        </p>
                        <p className="text-[13px] text-warm-gray mt-1 line-clamp-2">
                          {hl.content}
                        </p>
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {hl.domains?.map((d) => (
                            <DomainPill key={d} domain={d} />
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Weekly Digest */}
              <SectionHead
                emoji={"\u{1F4E8}"}
                title="Weekly Digest"
                subtitle={week.label}
              />
              <button
                onClick={handleGenerateDigest}
                disabled={isGenerating}
                className="fade-up delay-4 w-full py-4 rounded-2xl font-semibold text-espresso border-2 border-sand-dark bg-white hover:border-rust/30 hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-40"
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-rust/30 border-t-rust rounded-full animate-spin" />
                    Generating...
                  </span>
                ) : (
                  "Generate Weekly Digest"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── HIGHLIGHT EDITOR ────────────────────────────────────
  if (screen === "highlight" && currentHighlight) {
    return (
      <div className="min-h-screen bg-cream">
        <div className="mx-auto max-w-[520px] px-6 pt-7 pb-24">
          {/* Header */}
          <div className="fade-up flex items-center gap-3 mb-6">
            <button
              onClick={() => {
                setScreen("dashboard");
                setError(null);
              }}
              className="w-10 h-10 rounded-full border-2 border-sand-dark bg-white text-sm flex items-center justify-center hover:shadow-md transition-shadow"
            >
              &larr;
            </button>
            <div className="flex-1">
              <h2 className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-espresso">
                Review Highlight
              </h2>
              <p className="text-xs text-warm-gray">{selectedChild?.name}</p>
            </div>
          </div>

          {/* Source observations */}
          {selectedIds.size > 0 && (
            <Card className="fade-up delay-1 mb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-warm-gray mb-2">
                Source Observations
              </p>
              <div className="space-y-2">
                {pendingObs
                  .filter((o) => selectedIds.has(o.id))
                  .map((obs) => (
                    <p
                      key={obs.id}
                      className="text-[13px] text-warm-gray leading-relaxed line-clamp-2"
                    >
                      {obs.note}
                    </p>
                  ))}
              </div>
            </Card>
          )}

          {/* Editable highlight */}
          <Card className="fade-up delay-2 mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-warm-gray mb-3">
              Highlight for Parents
            </p>

            <label className="text-[11px] font-semibold text-warm-gray uppercase tracking-wider mb-1 block">
              Title
            </label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border-2 border-sand-dark bg-cream text-[15px] text-espresso focus:outline-none focus:border-rust/40 transition-colors mb-3"
            />

            <label className="text-[11px] font-semibold text-warm-gray uppercase tracking-wider mb-1 block">
              Content
            </label>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full min-h-[120px] px-3 py-2 rounded-xl border-2 border-sand-dark bg-cream text-[15px] leading-relaxed text-espresso focus:outline-none focus:border-rust/40 transition-colors resize-none mb-3"
            />

            <label className="text-[11px] font-semibold text-warm-gray uppercase tracking-wider mb-1 block">
              Summary (one line)
            </label>
            <input
              type="text"
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border-2 border-sand-dark bg-cream text-[14px] text-espresso focus:outline-none focus:border-rust/40 transition-colors"
            />
          </Card>

          {/* Domains + social tags (read-only from AI) */}
          <Card className="fade-up delay-3 mb-4">
            <div className="flex flex-wrap gap-2 mb-3">
              {currentHighlight.domains?.map((d) => (
                <DomainPill key={d} domain={d} />
              ))}
            </div>
            {currentHighlight.social_tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {currentHighlight.social_tags.map((tag: SocialTag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rust/10 text-rust"
                  >
                    {SOCIAL_TAG_CONFIG[tag]?.emoji}{" "}
                    {SOCIAL_TAG_CONFIG[tag]?.label}
                  </span>
                ))}
              </div>
            )}
          </Card>

          {/* Error */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Send button */}
          <button
            onClick={handleSendHighlight}
            disabled={isSending || !editContent.trim()}
            className="fade-up delay-4 w-full py-4 rounded-2xl font-semibold text-white transition-all disabled:opacity-40 bg-rust hover:bg-rust/90 active:scale-[0.98]"
          >
            {isSending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sending...
              </span>
            ) : (
              "Send to Parents"
            )}
          </button>
        </div>
      </div>
    );
  }

  // ─── DIGEST EDITOR ───────────────────────────────────────
  if (screen === "digest" && currentDigest) {
    return (
      <div className="min-h-screen bg-cream">
        <div className="mx-auto max-w-[520px] px-6 pt-7 pb-24">
          {/* Header */}
          <div className="fade-up flex items-center gap-3 mb-6">
            <button
              onClick={() => {
                setScreen("dashboard");
                setError(null);
              }}
              className="w-10 h-10 rounded-full border-2 border-sand-dark bg-white text-sm flex items-center justify-center hover:shadow-md transition-shadow"
            >
              &larr;
            </button>
            <div className="flex-1">
              <h2 className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-espresso">
                Review Weekly Digest
              </h2>
              <p className="text-xs text-warm-gray">
                {selectedChild?.name} &middot; {week.label}
              </p>
            </div>
          </div>

          {/* Editable digest */}
          <Card className="fade-up delay-1 mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-warm-gray mb-3">
              Weekly Digest for Parents
            </p>

            <label className="text-[11px] font-semibold text-warm-gray uppercase tracking-wider mb-1 block">
              Title
            </label>
            <input
              type="text"
              value={editDigestTitle}
              onChange={(e) => setEditDigestTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border-2 border-sand-dark bg-cream text-[15px] text-espresso focus:outline-none focus:border-rust/40 transition-colors mb-3"
            />

            <label className="text-[11px] font-semibold text-warm-gray uppercase tracking-wider mb-1 block">
              Content
            </label>
            <textarea
              value={editDigestContent}
              onChange={(e) => setEditDigestContent(e.target.value)}
              className="w-full min-h-[180px] px-3 py-2 rounded-xl border-2 border-sand-dark bg-cream text-[15px] leading-relaxed text-espresso focus:outline-none focus:border-rust/40 transition-colors resize-none"
            />
          </Card>

          {/* Domains covered */}
          {currentDigest.domains_covered?.length > 0 && (
            <Card className="fade-up delay-2 mb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-warm-gray mb-2">
                Domains Covered
              </p>
              <div className="flex flex-wrap gap-2">
                {currentDigest.domains_covered.map((d) => (
                  <DomainPill key={d} domain={d} />
                ))}
              </div>
            </Card>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Send button */}
          <button
            onClick={handleSendDigest}
            disabled={isSending || !editDigestContent.trim()}
            className="fade-up delay-3 w-full py-4 rounded-2xl font-semibold text-white transition-all disabled:opacity-40 bg-rust hover:bg-rust/90 active:scale-[0.98]"
          >
            {isSending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sending...
              </span>
            ) : (
              "Send to Parents"
            )}
          </button>
        </div>
      </div>
    );
  }

  // Fallback (shouldn't reach here)
  return null;
}
