"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Report {
  id: string;
  title: string;
  kind: "school_report" | "assessment" | "artwork" | "other";
  period_label: string | null;
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
  const [periodLabel, setPeriodLabel] = useState("");
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
      if (periodLabel.trim()) form.set("periodLabel", periodLabel.trim());
      const res = await fetch("/api/parent/kid/reports", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setTitle("");
      setPeriodLabel("");
      setShowForm(false);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

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
          <input
            value={periodLabel}
            onChange={(e) => setPeriodLabel(e.target.value)}
            placeholder="Period — e.g. Spring 2026 (optional)"
            className="w-full bg-cream rounded-xl px-3 py-2.5 text-sm text-espresso outline-none border border-sand-dark/50 focus:border-rust/50"
          />
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
            trail lives here, privately.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <a
              key={r.id}
              href={r.url ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm border border-sand-dark/40 hover:shadow-md transition-shadow"
            >
              <span className="text-xl shrink-0">{KIND_META[r.kind].emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-espresso truncate">{r.title}</p>
                <p className="text-[11px] text-warm-gray">
                  {r.period_label ?? KIND_META[r.kind].label} ·{" "}
                  {new Date(r.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              <span className="text-warm-gray/60 text-sm shrink-0">↗</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
