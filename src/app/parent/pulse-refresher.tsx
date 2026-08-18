"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Invisible: asks the summary API to (re)generate every kid's pulse in the
// background. The API is cache-keyed on the observation set, so unchanged
// kids cost zero AI calls — but a kid with NEW moments gets a fresh pulse
// without anyone having to visit their page first. Refreshes the page only
// when something actually regenerated.
export function PulseRefresher({ kidIds }: { kidIds: string[] }) {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || kidIds.length === 0) return;
    ran.current = true;
    let cancelled = false;

    (async () => {
      let regenerated = false;
      for (const childId of kidIds) {
        try {
          const res = await fetch("/api/parent/summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ childId }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.pulse && data.cached === false) regenerated = true;
          }
        } catch {
          // quiet — the fallback line on the card is fine
        }
      }
      if (regenerated && !cancelled) router.refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [kidIds, router]);

  return null;
}
