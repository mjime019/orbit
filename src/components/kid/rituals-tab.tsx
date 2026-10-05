"use client";

import { useCallback, useEffect, useState } from "react";
import { kidBorder, kidText } from "@/lib/kid-colors";
import {
  RITUAL_AREAS,
  RITUAL_AREA_META,
  SETUP_SQL,
  fmtDay,
  type Ritual,
  type RitualArea,
  type RitualStatus,
} from "@/lib/rituals-goals";

// Rituals: the real jobs a kid owns, added one at a time as he grows.
// Orbit only ever OFFERS — a ritual is his once a parent taps Start, and
// "his now" once a parent says so.
export function RitualsTab({
  childId,
  childName,
  kidIndex,
}: {
  childId: string;
  childName: string;
  kidIndex: number;
}) {
  const [rituals, setRituals] = useState<Ritual[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ title: string; area: RitualArea; cadence: string }>({
    title: "",
    area: "home",
    cadence: "",
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/parent/kid/rituals?childId=${childId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load rituals");
      setRituals(data.rituals);
      setUnavailable(Boolean(data.unavailable));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load rituals");
      setRituals([]);
    }
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  const suggest = async () => {
    if (suggesting) return;
    setSuggesting(true);
    setError("");
    try {
      const res = await fetch("/api/parent/kid/rituals/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't get suggestions");
      setRituals(data.rituals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't get suggestions");
    } finally {
      setSuggesting(false);
    }
  };

  const setStatus = async (id: string, status: RitualStatus) => {
    setError("");
    // Optimistic — dismissed disappears, the rest move between sections.
    setRituals((prev) =>
      prev
        ? status === "dismissed"
          ? prev.filter((r) => r.id !== id)
          : prev.map((r) => (r.id === id ? { ...r, status } : r))
        : prev
    );
    try {
      const res = await fetch("/api/parent/kid/rituals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't update");
      if (data.ritual) {
        setRituals((prev) =>
          prev ? prev.map((r) => (r.id === id ? (data.ritual as Ritual) : r)) : prev
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update");
      await load();
    }
  };

  const add = async () => {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/parent/kid/rituals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save");
      setRituals((prev) => [...(prev ?? []), data.ritual as Ritual]);
      setForm({ title: "", area: "home", cadence: "" });
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  const owns = (rituals ?? []).filter((r) => r.status === "mastered");
  const learning = (rituals ?? []).filter((r) => r.status === "active");
  const offered = (rituals ?? []).filter((r) => r.status === "suggested");
  const empty = owns.length + learning.length + offered.length === 0;

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 rounded-xl text-sm text-red-700">{error}</div>
      )}
      {unavailable && !error && (
        <div className="mb-4 p-3 bg-golden/10 rounded-xl text-xs text-espresso">
          Rituals aren&apos;t set up yet — run {SETUP_SQL} in Supabase, then come
          back.
        </div>
      )}

      {rituals === null ? (
        <div className="space-y-3">
          <div className="animate-pulse bg-sand-dark/40 rounded-2xl h-24" />
          <div className="animate-pulse bg-sand-dark/40 rounded-2xl h-24" />
        </div>
      ) : (
        <>
          {/* What he owns — the record that grows with him. */}
          {owns.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-sand-dark/40 mb-5 relative overflow-hidden">
              <div
                className="absolute inset-x-0 top-0 h-1"
                style={{ background: "var(--gradient-orbit)" }}
              />
              <p
                className={`text-xs font-bold uppercase tracking-wider mb-3 ${kidText(kidIndex)}`}
              >
                🔑 What {childName} owns
              </p>
              <div className="grid gap-2.5 lg:grid-cols-2">
                {owns.map((r) => (
                  <div
                    key={r.id}
                    className={`border-l-[3px] pl-3 py-0.5 ${kidBorder(kidIndex)}`}
                  >
                    <p className="text-sm font-semibold text-espresso">
                      {RITUAL_AREA_META[r.area].emoji} {r.title}
                    </p>
                    <p className="text-[11px] text-warm-gray">
                      {r.mastered_on ? `His since ${fmtDay(r.mastered_on)}` : "His"}
                      {r.cadence ? ` · ${r.cadence}` : ""}
                      {" · "}
                      <button
                        onClick={() => setStatus(r.id, "active")}
                        className="underline underline-offset-2 hover:text-espresso"
                      >
                        still learning
                      </button>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {learning.length > 0 && (
            <div className="mb-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-warm-gray mb-2">
                Learning now
              </p>
              <div className="grid gap-3 lg:grid-cols-2">
                {learning.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-sand-dark/40"
                  >
                    <RitualBody ritual={r} />
                    <div className="flex items-center gap-4 mt-3 pt-2.5 border-t border-sand-dark/30">
                      <button
                        onClick={() => setStatus(r.id, "mastered")}
                        className="text-xs font-semibold text-sage"
                      >
                        ✓ It&apos;s his now
                      </button>
                      <button
                        onClick={() => setStatus(r.id, "dismissed")}
                        className="text-xs text-warm-gray/80 ml-auto"
                      >
                        Shelve it
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {offered.length > 0 && (
            <div className="mb-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-warm-gray mb-2">
                What could be next
              </p>
              <div className="grid gap-3 lg:grid-cols-2">
                {offered.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white rounded-2xl p-4 border border-dashed border-sand-dark"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <RitualBody ritual={r} showWhy />
                      </div>
                      <button
                        onClick={() => setStatus(r.id, "dismissed")}
                        className="text-warm-gray/50 hover:text-warm-gray text-sm shrink-0"
                        title="Not for us"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-sand-dark/30">
                      <button
                        onClick={() => setStatus(r.id, "active")}
                        className="text-xs font-semibold text-rust"
                      >
                        Start this one →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {empty && !unavailable && (
            <div className="bg-sand rounded-2xl px-6 py-10 text-center mb-4">
              <span className="text-3xl">🔑</span>
              <p className="text-sm font-semibold text-espresso mt-3">
                {childName}&apos;s first real jobs
              </p>
              <p className="text-xs text-warm-gray mt-1.5 leading-relaxed max-w-[340px] mx-auto">
                Tap below and Orbit suggests responsibilities sized to his age and
                built from his file. Start one, hand it over, and when it&apos;s truly
                his, it joins the list of what he owns.
              </p>
            </div>
          )}

          <button
            onClick={suggest}
            disabled={suggesting || unavailable}
            className="w-full py-3 bg-espresso text-white rounded-2xl text-sm font-medium shadow-sm hover:bg-espresso/90 active:scale-[0.99] transition-all disabled:opacity-60"
          >
            {suggesting
              ? `🧠 Thinking about what ${childName} is ready for…`
              : offered.length > 0
                ? "✨ Suggest different ones"
                : "✨ Suggest what's next"}
          </button>

          {!adding ? (
            <button
              onClick={() => setAdding(true)}
              disabled={unavailable}
              className="w-full mt-2 py-2.5 text-sm font-medium text-rust disabled:opacity-40"
            >
              + Add one of our own
            </button>
          ) : (
            <div className="bg-white rounded-2xl p-4 shadow-sm mt-3 space-y-3">
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Feeds the dog breakfast"
                autoFocus
                className="w-full bg-cream rounded-xl px-3 py-2.5 text-sm text-espresso outline-none border border-sand-dark/50 focus:border-rust/50"
              />
              <div className="flex flex-wrap gap-1.5">
                {RITUAL_AREAS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setForm({ ...form, area: a })}
                    className={`text-xs px-2.5 py-1 rounded-full transition-all ${
                      form.area === a ? "bg-espresso text-white" : "bg-sand text-warm-gray"
                    }`}
                  >
                    {RITUAL_AREA_META[a].emoji} {RITUAL_AREA_META[a].label}
                  </button>
                ))}
              </div>
              <input
                value={form.cadence}
                onChange={(e) => setForm({ ...form, cadence: e.target.value })}
                placeholder="When — e.g. every morning (optional)"
                className="w-full bg-cream rounded-xl px-3 py-2.5 text-sm text-espresso outline-none border border-sand-dark/50 focus:border-rust/50"
              />
              <div className="flex gap-2">
                <button
                  onClick={add}
                  disabled={!form.title.trim() || saving}
                  className="flex-1 py-2.5 bg-rust text-white rounded-full text-sm font-medium disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => setAdding(false)}
                  className="px-4 text-sm text-warm-gray underline underline-offset-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <p className="text-[11px] text-warm-gray leading-relaxed mt-5 px-1">
            How rituals work here: a real job the family counts on, shown once or
            twice, then his. No nagging, no rescuing, no pay — a forgotten job and
            what follows from it is part of how it sticks.
          </p>
        </>
      )}
    </div>
  );
}

function RitualBody({ ritual, showWhy }: { ritual: Ritual; showWhy?: boolean }) {
  const meta = RITUAL_AREA_META[ritual.area];
  return (
    <>
      <p className="text-sm font-semibold text-espresso">
        {meta.emoji} {ritual.title}
      </p>
      <p className="text-[11px] text-warm-gray mt-0.5">
        {meta.label}
        {ritual.cadence ? ` · ${ritual.cadence}` : ""}
        {ritual.status === "active" && ritual.started_on
          ? ` · since ${fmtDay(ritual.started_on)}`
          : ""}
      </p>
      {showWhy && ritual.why_now && (
        <p className="text-xs text-espresso/80 leading-relaxed mt-2">{ritual.why_now}</p>
      )}
      {ritual.how_to_start && (
        <p className="text-xs text-espresso/80 leading-relaxed mt-2">
          <span className="font-semibold text-espresso">Handing it over: </span>
          {ritual.how_to_start}
        </p>
      )}
      {ritual.looks_like_owning_it && (
        <p className="text-xs text-espresso/80 leading-relaxed mt-1.5">
          <span className="font-semibold text-espresso">You&apos;ll know it&apos;s his when: </span>
          {ritual.looks_like_owning_it}
        </p>
      )}
    </>
  );
}
