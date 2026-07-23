"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DomainPill } from "@/components/ui/domain-pill";

type Kind = "activity" | "weekend" | "extracurricular";
type Status = "suggested" | "saved" | "done" | "dismissed";

interface Idea {
  id: string;
  kind: Kind;
  title: string;
  payload: Record<string, unknown>;
  status: Status;
  created_at: string;
}

const GENERATE_LABEL: Record<Kind, string> = {
  activity: "✨ Fresh activity ideas",
  weekend: "✨ Plan this weekend",
  extracurricular: "✨ What's worth exploring",
};

const EMPTY_COPY: Record<Kind, string> = {
  activity:
    "Tap the button and Orbit builds at-home ideas from his file — his interests, his growing edges, his energy.",
  weekend:
    "Tap the button and Orbit plans Miami weekends that work for all three boys at once — naps, strollers, and all.",
  extracurricular:
    "Tap the button and Orbit suggests program categories he's ready for, with questions to ask providers.",
};

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
}

export function IdeaCards({
  kind,
  childId,
  childName,
}: {
  kind: Kind;
  childId?: string;
  childName?: string;
}) {
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ kind });
      if (childId) params.set("childId", childId);
      const res = await fetch(`/api/planner/ideas?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load ideas");
      setIdeas(data.ideas);
      setUnavailable(Boolean(data.unavailable));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load ideas");
      setIdeas([]);
    }
  }, [kind, childId]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    if (generating) return;
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/planner/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, childId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't generate ideas");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate ideas");
    } finally {
      setGenerating(false);
    }
  };

  const setStatus = async (id: string, status: Status) => {
    // Optimistic — dismissed disappears, others update in place.
    setIdeas((prev) =>
      prev
        ? status === "dismissed"
          ? prev.filter((i) => i.id !== id)
          : prev.map((i) => (i.id === id ? { ...i, status } : i))
        : prev
    );
    try {
      const res = await fetch("/api/planner/ideas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) await load();
    } catch {
      await load();
    }
  };

  const kept = (ideas ?? []).filter((i) => i.status === "saved" || i.status === "done");
  const suggested = (ideas ?? []).filter((i) => i.status === "suggested");

  return (
    <div>
      <button
        onClick={generate}
        disabled={generating}
        className="w-full py-3 bg-espresso text-white rounded-2xl text-sm font-medium shadow-sm hover:bg-espresso/90 active:scale-[0.99] transition-all disabled:opacity-60 mb-4"
      >
        {generating ? "🧠 Thinking about " + (childName ?? "the crew") + "…" : GENERATE_LABEL[kind]}
      </button>

      {error && (
        <div className="mb-4 p-3 bg-red-50 rounded-xl text-sm text-red-700">{error}</div>
      )}
      {unavailable && !error && (
        <div className="mb-4 p-3 bg-golden/10 rounded-xl text-xs text-espresso">
          The planner table isn&apos;t set up yet — run scripts/pivot/08-round3.sql
          in Supabase, then generate.
        </div>
      )}

      {ideas === null ? (
        <div className="space-y-3">
          <div className="animate-pulse bg-sand-dark/40 rounded-2xl h-24" />
          <div className="animate-pulse bg-sand-dark/40 rounded-2xl h-24" />
        </div>
      ) : kept.length === 0 && suggested.length === 0 ? (
        <div className="bg-sand rounded-2xl px-6 py-10 text-center">
          <span className="text-3xl">💡</span>
          <p className="text-xs text-warm-gray mt-3 leading-relaxed max-w-[300px] mx-auto">
            {EMPTY_COPY[kind]}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {kept.length > 0 && (
            <p className="text-[10px] font-semibold text-warm-gray uppercase tracking-wide">
              Keeping
            </p>
          )}
          {kept.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} onStatus={setStatus} />
          ))}
          {suggested.length > 0 && (
            <p className="text-[10px] font-semibold text-warm-gray uppercase tracking-wide pt-1">
              Fresh ideas
            </p>
          )}
          {suggested.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} onStatus={setStatus} />
          ))}
        </div>
      )}
    </div>
  );
}

function IdeaCard({
  idea,
  onStatus,
}: {
  idea: Idea;
  onStatus: (id: string, status: Status) => void;
}) {
  const p = idea.payload;
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-sand-dark/40">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-espresso">
          {idea.status === "done" && "✅ "}
          {idea.status === "saved" && "★ "}
          {idea.title}
        </p>
        {idea.status === "suggested" && (
          <button
            onClick={() => onStatus(idea.id, "dismissed")}
            className="text-warm-gray/50 hover:text-warm-gray text-sm shrink-0"
            title="Not for us"
          >
            ✕
          </button>
        )}
      </div>

      {idea.kind === "activity" && (
        <>
          <p className="text-xs text-espresso/80 leading-relaxed mt-1.5">
            {str(p.why_it_fits)}
          </p>
          <div className="flex items-center gap-3 mt-2 text-[11px] text-warm-gray">
            {typeof p.time_minutes === "number" && <span>⏱ {p.time_minutes} min</span>}
            {str(p.energy) && <span>🔋 {str(p.energy)}</span>}
          </div>
          {arr(p.materials).length > 0 && (
            <p className="text-[11px] text-warm-gray mt-1.5">
              🧺 {arr(p.materials).join(" · ")}
            </p>
          )}
          {arr(p.domains).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {arr(p.domains)
                .slice(0, 3)
                .map((d) => (
                  <DomainPill key={d} domain={d} />
                ))}
            </div>
          )}
        </>
      )}

      {idea.kind === "weekend" && (
        <>
          {str(p.where) && (
            <p className="text-[11px] text-warm-gray mt-0.5">📍 {str(p.where)}</p>
          )}
          <p className="text-xs text-espresso/80 leading-relaxed mt-1.5">
            {str(p.why_it_works_for_the_crew)}
          </p>
          {str(p.timing_tip) && (
            <p className="text-[11px] text-warm-gray mt-1.5">🕐 {str(p.timing_tip)}</p>
          )}
          {str(p.backup_if_rains) && (
            <p className="text-[11px] text-warm-gray mt-1">🌧️ {str(p.backup_if_rains)}</p>
          )}
        </>
      )}

      {idea.kind === "extracurricular" && (
        <>
          <p className="text-xs text-espresso/80 leading-relaxed mt-1.5">
            {str(p.why_now)}
          </p>
          {arr(p.readiness_signs).length > 0 && (
            <p className="text-[11px] text-warm-gray mt-1.5">
              🌱 Already showing: {arr(p.readiness_signs).join(" · ")}
            </p>
          )}
          {arr(p.questions_to_ask_providers).length > 0 && (
            <div className="mt-2 bg-cream rounded-xl p-2.5">
              <p className="text-[10px] font-semibold text-warm-gray uppercase tracking-wide mb-1">
                Ask providers
              </p>
              {arr(p.questions_to_ask_providers).map((q) => (
                <p key={q} className="text-[11px] text-espresso/80 leading-relaxed">
                  • {q}
                </p>
              ))}
            </div>
          )}
          {str(p.try_before_committing) && (
            <p className="text-[11px] text-warm-gray mt-1.5">
              🧪 Try first: {str(p.try_before_committing)}
            </p>
          )}
        </>
      )}

      <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-sand-dark/30">
        {idea.status === "suggested" && (
          <>
            <button
              onClick={() => onStatus(idea.id, "saved")}
              className="text-xs font-medium text-rust"
            >
              ★ Keep
            </button>
            <button
              onClick={() => onStatus(idea.id, "done")}
              className="text-xs font-medium text-sage"
            >
              ✓ We did it
            </button>
          </>
        )}
        {idea.status === "saved" && (
          <button
            onClick={() => onStatus(idea.id, "done")}
            className="text-xs font-medium text-sage"
          >
            ✓ We did it
          </button>
        )}
        {idea.status === "done" && idea.kind !== "extracurricular" && (
          <Link href="/capture" className="text-xs font-medium text-rust">
            🎤 Capture how it went →
          </Link>
        )}
        {idea.status !== "suggested" && (
          <button
            onClick={() => onStatus(idea.id, "dismissed")}
            className="text-xs text-warm-gray/70 ml-auto"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
