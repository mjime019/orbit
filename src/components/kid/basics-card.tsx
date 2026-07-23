"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatAge, ageBand } from "@/lib/age";

const BAND_LABELS: Record<string, string> = {
  infant: "Infant",
  toddler: "Toddler",
  preschool: "Preschool",
  "school-age": "School age",
};

// The editable top of the About tab: name + date of birth, the two facts
// every age computation hangs off. Everything else in the file comes from
// seeding/refresh; these are corrected here.
export function BasicsCard({
  childId,
  initialName,
  initialDob,
}: {
  childId: string;
  initialName: string;
  initialDob: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [dob, setDob] = useState(initialDob ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const dirty = name.trim() !== initialName || (dob || null) !== initialDob;

  const save = async () => {
    if (busy || !dirty) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/parent/kid/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childId,
          name: name.trim(),
          dateOfBirth: dob || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save.");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">🪪</span>
        <h3 className="text-[11px] font-bold text-espresso uppercase tracking-wider">
          Basics
        </h3>
        {dob && (
          <span className="text-[11px] text-warm-gray ml-auto">
            {formatAge(dob)} · {BAND_LABELS[ageBand(dob)]}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[10px] font-semibold text-warm-gray uppercase tracking-wide">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-sand-dark/60 text-sm text-espresso bg-white focus:outline-none focus:border-rust"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold text-warm-gray uppercase tracking-wide">
            Date of birth
          </span>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-sand-dark/60 text-sm text-espresso bg-white focus:outline-none focus:border-rust"
          />
        </label>
      </div>

      {(dirty || error || saved) && (
        <div className="flex items-center gap-3 mt-3">
          {dirty && (
            <button
              onClick={save}
              disabled={busy || !name.trim()}
              className="px-4 py-1.5 bg-espresso text-white rounded-full text-xs font-medium disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          )}
          {saved && !dirty && (
            <span className="text-xs text-sage font-medium">Saved ✓</span>
          )}
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      )}
    </div>
  );
}
