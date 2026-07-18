"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Invisible: asks the summary API to (re)generate pulses for kids missing
// one, then refreshes the page once so the cards fill in. The API is
// cache-aware, so kids with fresh pulses cost zero AI calls.
export function PulseRefresher({ kidIds }: { kidIds: string[] }) {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || kidIds.length === 0) return;
    ran.current = true;
    let cancelled = false;

    (async () => {
      let gotNew = false;
      for (const childId of kidIds) {
        try {
          const res = await fetch("/api/parent/summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ childId }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.pulse) gotNew = true;
          }
        } catch {
          // quiet — the fallback line on the card is fine
        }
      }
      if (gotNew && !cancelled) router.refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [kidIds, router]);

  return null;
}
