"use client";

import { useCallback, useEffect, useState } from "react";

interface Activity {
  id: string;
  name: string;
  category: "sport" | "music" | "art" | "stem" | "other";
  schedule_note: string | null;
  status: "active" | "paused" | "past";
  started_on: string | null;
  notes: string | null;
}

const CATEGORY_META: Record<Activity["category"], { emoji: string; label: string }> = {
  sport: { emoji: "⚽", label: "Sport" },
  music: { emoji: "🎵", label: "Music" },
  art: { emoji: "🎨", label: "Art" },
  stem: { emoji: "🧩", label: "STEM" },
  other: { emoji: "🌟", label: "Other" },
};

const STATUS_LABEL: Record<Activity["status"], string> = {
  active: "Active",
  paused: "Paused",
  past: "Past",
};

export function ActivitiesTab({
  childId,
  childName,
}: {
  childId: string;
  childName: string;
}) {
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "sport",
    scheduleNote: "",
    notes: "",
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/parent/kid/activities?childId=${childId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load activities");
      setActivities(data.activities);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load activities");
      setActivities([]);
    }
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!form.name.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/parent/kid/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save");
      setForm({ name: "", category: "sport", scheduleNote: "", notes: "" });
      setAdding(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: string, status: Activity["status"]) => {
    setError("");
    try {
      const res = await fetch("/api/parent/kid/activities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't update");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update");
    }
  };

  const groups: { status: Activity["status"]; items: Activity[] }[] = (
    ["active", "paused", "past"] as const
  )
    .map((status) => ({
      status,
      items: (activities ?? []).filter((a) => a.status === status),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {!adding ? (
        <button
          onClick={() => setAdding(true)}
          className="w-full mb-4 py-3 bg-rust text-white rounded-2xl text-sm font-medium shadow-sm hover:bg-rust/90 active:scale-[0.99] transition-all"
        >
          + Add an activity
        </button>
      ) : (
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4 space-y-3">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={`e.g. Soccer, piano, swim class…`}
            autoFocus
            className="w-full bg-cream rounded-xl px-3 py-2.5 text-sm text-espresso outline-none border border-sand-dark/50 focus:border-rust/50"
          />
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(CATEGORY_META) as Activity["category"][]).map((c) => (
              <button
                key={c}
                onClick={() => setForm({ ...form, category: c })}
                className={`text-xs px-2.5 py-1 rounded-full transition-all ${
                  form.category === c
                    ? "bg-espresso text-white"
                    : "bg-sand text-warm-gray"
                }`}
              >
                {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
              </button>
            ))}
          </div>
          <input
            value={form.scheduleNote}
            onChange={(e) => setForm({ ...form, scheduleNote: e.target.value })}
            placeholder="Schedule — e.g. Saturday mornings"
            className="w-full bg-cream rounded-xl px-3 py-2.5 text-sm text-espresso outline-none border border-sand-dark/50 focus:border-rust/50"
          />
          <input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Notes — coach, level, how it's going (optional)"
            className="w-full bg-cream rounded-xl px-3 py-2.5 text-sm text-espresso outline-none border border-sand-dark/50 focus:border-rust/50"
          />
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={!form.name.trim() || busy}
              className="flex-1 py-2.5 bg-rust text-white rounded-full text-sm font-medium disabled:opacity-40"
            >
              {busy ? "Saving…" : "Save"}
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

      {activities === null ? (
        <div className="space-y-3">
          <div className="animate-pulse bg-sand-dark/40 rounded-2xl h-20" />
          <div className="animate-pulse bg-sand-dark/40 rounded-2xl h-20" />
        </div>
      ) : activities.length === 0 ? (
        <div className="bg-sand rounded-2xl px-6 py-10 text-center">
          <span className="text-3xl">⚽</span>
          <p className="text-sm font-semibold text-espresso mt-3">
            Nothing tracked yet
          </p>
          <p className="text-xs text-warm-gray mt-1.5">
            Add {childName}&apos;s sports, classes, and pursuits — they become part
            of his story.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.status}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-warm-gray mb-2">
                {STATUS_LABEL[g.status]}
              </p>
              <div className="space-y-2">
                {g.items.map((a) => (
                  <div
                    key={a.id}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-sand-dark/40"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{CATEGORY_META[a.category].emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-espresso">{a.name}</p>
                        {a.schedule_note && (
                          <p className="text-[11px] text-warm-gray">{a.schedule_note}</p>
                        )}
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {a.status !== "active" && (
                          <button
                            onClick={() => setStatus(a.id, "active")}
                            className="text-[11px] text-sage underline underline-offset-2"
                          >
                            Resume
                          </button>
                        )}
                        {a.status === "active" && (
                          <button
                            onClick={() => setStatus(a.id, "paused")}
                            className="text-[11px] text-warm-gray underline underline-offset-2"
                          >
                            Pause
                          </button>
                        )}
                        {a.status !== "past" && (
                          <button
                            onClick={() => setStatus(a.id, "past")}
                            className="text-[11px] text-warm-gray underline underline-offset-2"
                          >
                            End
                          </button>
                        )}
                      </div>
                    </div>
                    {a.notes && (
                      <p className="text-xs text-espresso/75 mt-2 leading-relaxed">{a.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
