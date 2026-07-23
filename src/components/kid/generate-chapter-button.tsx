"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GenerateChapterButton({
  childId,
  childName,
  newMomentCount,
}: {
  childId: string;
  childName: string;
  newMomentCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/chapters/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't write the chapter.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't write the chapter.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-5">
      <button
        onClick={generate}
        disabled={busy}
        className="w-full py-3 bg-espresso text-white rounded-2xl text-sm font-medium shadow-sm hover:bg-espresso/90 active:scale-[0.99] transition-all disabled:opacity-60"
      >
        {busy
          ? "✍️ Writing the chapter…"
          : `📖 Write ${childName}'s next chapter`}
      </button>
      <p className="text-[11px] text-warm-gray text-center mt-1.5">
        Orbit reads the {newMomentCount} moment{newMomentCount === 1 ? "" : "s"} since
        the last chapter and writes what changed.
      </p>
      {error && (
        <p className="text-xs text-red-600 text-center mt-2">{error}</p>
      )}
    </div>
  );
}
