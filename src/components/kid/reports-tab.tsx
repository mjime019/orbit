"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EXTRA_REGISTRY, titleCaseKey, displayPills, displayValue } from "@/lib/extra-registry";

interface ReportExtracted {
  strengths?: string[];
  growth_areas?: string[];
  notable_quotes?: string[];
  suggested_file_updates?: Record<string, unknown>;
  applied_at?: string;
}

interface Report {
  id: string;
  title: string;
  kind: "school_report" | "assessment" | "artwork" | "other";
  period_label: string | null;
  report_date?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  ai_summary?: string | null;
  ai_extracted?: ReportExtracted | null;
  ai_processed_at?: string | null;
  notes: string | null;
  created_at: string;
  url: string | null;
}

const KIND_META: Record<Report["kind"], { emoji: string; label: string }> = {
  school_report: { emoji: "📄", label: "School report" },
  assessment: { emoji: "📋", label: "Assessment" },
  artwork: { emoji: "🎨", label: "Artwork" },
  other: { emoji: "📎", label: "Other" },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-03-15" → "Mar 15, 2026" without Date() (avoids the UTC day shift).
function fmtDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}, ${y}`;
}

function dateLine(r: Report): string {
  if (r.report_date) return fmtDay(r.report_date);
  if (r.period_start && r.period_end)
    return `${fmtDay(r.period_start)} – ${fmtDay(r.period_end)}`;
  if (r.period_start) return `from ${fmtDay(r.period_start)}`;
  return r.period_label ?? KIND_META[r.kind].label;
}

function suggestionLabel(key: string): string {
  return EXTRA_REGISTRY[key]?.label ?? titleCaseKey(key);
}

export function ReportsTab({
  childId,
  childName,
}: {
  childId: string;
  childName: string;
}) {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Report["kind"]>("school_report");
  const [dateMode, setDateMode] = useState<"single" | "period">("single");
  const [reportDate, setReportDate] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [processErrors, setProcessErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/parent/kid/reports?childId=${childId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load reports");
      setReports(data.reports);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load reports");
      setReports([]);
    }
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  const processReport = useCallback(
    async (reportId: string) => {
      setProcessingIds((prev) => new Set(prev).add(reportId));
      setProcessErrors((prev) => ({ ...prev, [reportId]: "" }));
      try {
        const res = await fetch("/api/parent/kid/reports/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't read the report");
        await load();
      } catch (err) {
        setProcessErrors((prev) => ({
          ...prev,
          [reportId]: err instanceof Error ? err.message : "Couldn't read the report",
        }));
      } finally {
        setProcessingIds((prev) => {
          const next = new Set(prev);
          next.delete(reportId);
          return next;
        });
      }
    },
    [load]
  );

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !title.trim() || uploading) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("childId", childId);
      form.set("title", title.trim());
      form.set("kind", kind);
      if (dateMode === "single" && reportDate) form.set("reportDate", reportDate);
      if (dateMode === "period") {
        if (periodStart) form.set("periodStart", periodStart);
        if (periodEnd) form.set("periodEnd", periodEnd);
      }
      const res = await fetch("/api/parent/kid/reports", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setTitle("");
      setReportDate("");
      setPeriodStart("");
      setPeriodEnd("");
      setShowForm(false);
      if (fileRef.current) fileRef.current.value = "";
      await load();
      // Orbit reads the report right away — visible on the card.
      if (data.report?.id) processReport(data.report.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const dateInputClass =
    "flex-1 bg-cream rounded-xl px-3 py-2 text-sm text-espresso outline-none border border-sand-dark/50 focus:border-rust/50";

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full mb-4 py-3 bg-rust text-white rounded-2xl text-sm font-medium shadow-sm hover:bg-rust/90 active:scale-[0.99] transition-all"
        >
          ⬆️ Upload a report
        </button>
      ) : (
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4 space-y-3">
          <input
            type="file"
            ref={fileRef}
            accept="application/pdf,image/*"
            className="w-full text-xs text-warm-gray file:mr-3 file:px-3 file:py-2 file:rounded-full file:border-0 file:bg-sand file:text-espresso file:text-xs file:font-medium"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title — e.g. Spring progress report"
            className="w-full bg-cream rounded-xl px-3 py-2.5 text-sm text-espresso outline-none border border-sand-dark/50 focus:border-rust/50"
          />
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(KIND_META) as Report["kind"][]).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`text-xs px-2.5 py-1 rounded-full transition-all ${
                  kind === k ? "bg-espresso text-white" : "bg-sand text-warm-gray"
                }`}
              >
                {KIND_META[k].emoji} {KIND_META[k].label}
              </button>
            ))}
          </div>
          <div>
            <div className="flex gap-1.5 mb-2">
              <button
                onClick={() => setDateMode("single")}
                className={`text-xs px-2.5 py-1 rounded-full transition-all ${
                  dateMode === "single" ? "bg-espresso text-white" : "bg-sand text-warm-gray"
                }`}
              >
                One day
              </button>
              <button
                onClick={() => setDateMode("period")}
                className={`text-xs px-2.5 py-1 rounded-full transition-all ${
                  dateMode === "period" ? "bg-espresso text-white" : "bg-sand text-warm-gray"
                }`}
              >
                A period
              </button>
            </div>
            {dateMode === "single" ? (
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className={dateInputClass + " w-full"}
              />
            ) : (
              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className={dateInputClass}
                />
                <span className="text-warm-gray text-xs">to</span>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className={dateInputClass}
                />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={upload}
              disabled={!title.trim() || uploading}
              className="flex-1 py-2.5 bg-rust text-white rounded-full text-sm font-medium disabled:opacity-40"
            >
              {uploading ? "Uploading…" : "Upload"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 text-sm text-warm-gray underline underline-offset-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {reports === null ? (
        <div className="space-y-3">
          <div className="animate-pulse bg-sand-dark/40 rounded-2xl h-16" />
          <div className="animate-pulse bg-sand-dark/40 rounded-2xl h-16" />
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-sand rounded-2xl px-6 py-10 text-center">
          <span className="text-3xl">📄</span>
          <p className="text-sm font-semibold text-espresso mt-3">No reports yet</p>
          <p className="text-xs text-warm-gray mt-1.5">
            School reports, assessments, even artwork — {childName}&apos;s paper
            trail lives here, privately. Orbit reads each one and remembers it.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              childName={childName}
              processing={processingIds.has(r.id)}
              processError={processErrors[r.id] ?? ""}
              onProcess={() => processReport(r.id)}
              onApplied={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportCard({
  report: r,
  childName,
  processing,
  processError,
  onProcess,
  onApplied,
}: {
  report: Report;
  childName: string;
  processing: boolean;
  processError: string;
  onProcess: () => void;
  onApplied: () => void;
}) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");

  const suggestions = r.ai_extracted?.suggested_file_updates ?? {};
  const suggestionKeys = Object.keys(suggestions);
  const alreadyApplied = Boolean(r.ai_extracted?.applied_at);

  // Everything starts accepted; the parent unchecks what they disagree with.
  useEffect(() => {
    setAccepted(new Set(suggestionKeys));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.id, r.ai_processed_at]);

  const toggle = (key: string) => {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const apply = async () => {
    if (applying || accepted.size === 0) return;
    setApplying(true);
    setApplyError("");
    try {
      const updates: Record<string, unknown> = {};
      for (const key of accepted) updates[key] = suggestions[key];
      const res = await fetch("/api/parent/kid/reports/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: r.id, updates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't update the file");
      setReviewOpen(false);
      onApplied();
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : "Couldn't update the file");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-sand-dark/40">
      <div className="flex items-center gap-3">
        <span className="text-xl shrink-0">{KIND_META[r.kind].emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-espresso truncate">{r.title}</p>
          <p className="text-[11px] text-warm-gray">{dateLine(r)}</p>
        </div>
        {r.url && (
          <a
            href={r.url}
            target="_blank"
            rel="noreferrer"
            className="text-warm-gray/60 text-sm shrink-0 hover:text-espresso"
            title="Open the file"
          >
            ↗
          </a>
        )}
      </div>

      {processing && (
        <p className="mt-3 text-xs text-warm-gray flex items-center gap-1.5">
          <span className="animate-pulse">🔍</span> Reading the report…
        </p>
      )}

      {processError && !processing && (
        <div className="mt-3 flex items-center gap-2">
          <p className="text-xs text-red-600 flex-1">{processError}</p>
          <button
            onClick={onProcess}
            className="text-xs text-rust font-medium underline underline-offset-2 shrink-0"
          >
            Try again
          </button>
        </div>
      )}

      {!processing && !processError && !r.ai_processed_at && (
        <button
          onClick={onProcess}
          className="mt-3 text-xs text-rust font-medium underline underline-offset-2"
        >
          🔍 Have Orbit read this report
        </button>
      )}

      {r.ai_summary && !processing && (
        <div className="mt-3 pt-3 border-t border-sand-dark/30">
          <p className="text-[10px] font-semibold text-warm-gray uppercase tracking-wide mb-1">
            What it says
          </p>
          <p className="text-xs text-espresso/85 leading-relaxed">{r.ai_summary}</p>

          {alreadyApplied ? (
            <p className="mt-2 text-[11px] text-sage font-medium">
              ✓ Added to {childName}&apos;s file
            </p>
          ) : suggestionKeys.length > 0 ? (
            <div className="mt-2.5">
              {!reviewOpen ? (
                <button
                  onClick={() => setReviewOpen(true)}
                  className="text-xs text-rust font-medium underline underline-offset-2"
                >
                  Review what Orbit noticed →
                </button>
              ) : (
                <div className="bg-cream rounded-xl p-3 space-y-2">
                  <p className="text-[11px] text-warm-gray">
                    Orbit suggests adding this to {childName}&apos;s file. Uncheck
                    anything that doesn&apos;t ring true — nothing lands without
                    your OK.
                  </p>
                  {suggestionKeys.map((key) => {
                    const value = suggestions[key];
                    const text = Array.isArray(value)
                      ? displayPills(value).join(", ")
                      : displayValue(value);
                    return (
                      <label
                        key={key}
                        className="flex items-start gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={accepted.has(key)}
                          onChange={() => toggle(key)}
                          className="mt-0.5 accent-[#0090F3]"
                        />
                        <span className="text-xs leading-relaxed">
                          <span className="font-semibold text-espresso">
                            {suggestionLabel(key)}:
                          </span>{" "}
                          <span className="text-espresso/80">{text}</span>
                        </span>
                      </label>
                    );
                  })}
                  {applyError && (
                    <p className="text-xs text-red-600">{applyError}</p>
                  )}
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={apply}
                      disabled={applying || accepted.size === 0}
                      className="px-4 py-1.5 bg-espresso text-white rounded-full text-xs font-medium disabled:opacity-50"
                    >
                      {applying
                        ? "Adding…"
                        : `Add ${accepted.size} to the file`}
                    </button>
                    <button
                      onClick={() => setReviewOpen(false)}
                      className="text-xs text-warm-gray underline underline-offset-2"
                    >
                      Not now
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
