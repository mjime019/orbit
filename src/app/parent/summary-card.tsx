"use client";

import { useEffect, useState } from "react";

interface SummaryCardProps {
  childId: string;
  childName: string;
  initialContent: string | null;
  hasObservations: boolean;
}

// Renders the cached "what this means" text instantly (server-provided),
// then refreshes it in the background — the API only calls the AI when the
// observation set actually changed.
export function SummaryCard({
  childId,
  childName,
  initialContent,
  hasObservations,
}: SummaryCardProps) {
  const [content, setContent] = useState(initialContent);
  const [loading, setLoading] = useState(!initialContent && hasObservations);

  useEffect(() => {
    if (!hasObservations) return;
    let cancelled = false;
    fetch("/api/parent/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childId }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.content) setContent(data.content);
      })
      .catch(() => {
        // keep whatever we have — a stale summary beats an error here
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [childId, hasObservations]);

  if (!hasObservations) return null;

  return (
    <div className="bg-gradient-to-br from-lavender/25 to-sand rounded-2xl p-5 border border-lavender/40">
      <p className="text-xs font-bold uppercase tracking-wider text-espresso/60 mb-2">
        💡 What this means
      </p>
      {content ? (
        <p className="text-[15px] text-espresso leading-relaxed font-[family-name:var(--font-chat)]">
          {content}
        </p>
      ) : loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-3.5 bg-espresso/10 rounded w-full" />
          <div className="h-3.5 bg-espresso/10 rounded w-5/6" />
          <div className="h-3.5 bg-espresso/10 rounded w-2/3" />
        </div>
      ) : (
        <p className="text-sm text-warm-gray leading-relaxed">
          As more moments are captured, Orbit will pull together what they say
          about {childName}.
        </p>
      )}
    </div>
  );
}
