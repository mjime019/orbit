"use client";

import { useState } from "react";
import { DomainPill } from "@/components/ui/domain-pill";
import type { ActivityRecommendation, Observation } from "@/lib/types";

interface Props {
  childId: string;
  childName: string;
  recommendations: (ActivityRecommendation & {
    activities: {
      id: string;
      title: string;
      description: string | null;
      instructions: string | null;
      domains: string[];
      materials: string[];
      time_minutes: number | null;
      energy_level: string;
    } | null;
  })[];
  observations: Observation[];
  classroomTheme: string;
  interests: string[];
}

const ENERGY_EMOJI: Record<string, string> = {
  low: "\u{1F9D8}",
  medium: "\u26A1",
  high: "\u{1F525}",
};

export function ActivityList({
  childId,
  childName,
  recommendations,
  classroomTheme,
  interests,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [personalizations, setPersonalizations] = useState<
    Record<string, string>
  >({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function fetchPersonalization(
    activityId: string,
    recommendationId: string
  ) {
    if (personalizations[recommendationId]) return;
    setLoadingId(recommendationId);

    try {
      const res = await fetch("/api/parent/activities/personalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId, activityId, recommendationId }),
      });

      if (res.ok) {
        const data = await res.json();
        setPersonalizations((prev) => ({
          ...prev,
          [recommendationId]: data.why_it_fits,
        }));
      }
    } catch {
      // Silently fail — personalization is nice-to-have
    } finally {
      setLoadingId(null);
    }
  }

  if (recommendations.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
        <div className="text-4xl mb-3">{"\u{1F3E0}"}</div>
        <p className="text-espresso font-semibold mb-1">No activities yet</p>
        <p className="text-warm-gray text-sm">
          Activities will appear here as {childName}&apos;s profile grows.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {recommendations.map((rec, idx) => {
        const activity = rec.activities;
        if (!activity) return null;

        const isExpanded = expandedId === rec.id;
        const whyItFits = personalizations[rec.id] ?? rec.why_it_fits;
        const isLoading = loadingId === rec.id;

        return (
          <div
            key={rec.id}
            className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-all duration-300 fade-up delay-${Math.min(idx + 1, 6)}`}
          >
            {/* Card Header */}
            <div className="p-5">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-[family-name:var(--font-playfair)] text-lg font-bold text-espresso">
                  {activity.title}
                </h3>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {activity.time_minutes && (
                    <span className="text-xs text-warm-gray bg-sand px-2 py-0.5 rounded-full">
                      {activity.time_minutes}min
                    </span>
                  )}
                  {activity.energy_level && (
                    <span className="text-xs text-warm-gray bg-sand px-2 py-0.5 rounded-full">
                      {ENERGY_EMOJI[activity.energy_level] ?? "\u26A1"}{" "}
                      {activity.energy_level}
                    </span>
                  )}
                </div>
              </div>

              {/* Domain Pills */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {activity.domains?.map((d) => (
                  <DomainPill key={d} domain={d} />
                ))}
              </div>

              {/* Description */}
              {activity.description && (
                <p className="text-warm-gray text-sm mb-3 leading-relaxed">
                  {activity.description}
                </p>
              )}

              {/* Why It Fits */}
              <div className="bg-cream rounded-xl p-3.5 mb-3">
                <p className="text-xs text-warm-gray font-semibold uppercase tracking-wider mb-1.5">
                  {"\u2728"} Why it fits {childName}
                </p>
                {whyItFits ? (
                  <p className="text-espresso text-sm italic leading-relaxed">
                    {whyItFits}
                  </p>
                ) : (
                  <button
                    onClick={() =>
                      fetchPersonalization(activity.id, rec.id)
                    }
                    disabled={isLoading}
                    className="text-rust text-sm hover:text-rust/80 transition-colors"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-1.5">
                        <span className="animate-spin text-xs">
                          {"\u{1F300}"}
                        </span>
                        Personalizing...
                      </span>
                    ) : (
                      "Generate personalized recommendation \u2192"
                    )}
                  </button>
                )}
              </div>

              {/* Expand/Collapse Toggle */}
              <button
                onClick={() =>
                  setExpandedId(isExpanded ? null : rec.id)
                }
                className="text-sky text-sm hover:text-sky/80 transition-colors"
              >
                {isExpanded
                  ? "Hide details \u2191"
                  : "Show materials & instructions \u2193"}
              </button>
            </div>

            {/* Expanded Section */}
            {isExpanded && (
              <div className="border-t border-sand-dark px-5 py-4 bg-cream/50">
                {/* Materials */}
                {activity.materials?.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs text-warm-gray font-semibold uppercase tracking-wider mb-2">
                      Materials
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {activity.materials.map((m, i) => (
                        <span
                          key={i}
                          className="bg-white text-espresso text-sm px-3 py-1 rounded-full border border-sand-dark"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Instructions */}
                {activity.instructions && (
                  <div>
                    <h4 className="text-xs text-warm-gray font-semibold uppercase tracking-wider mb-2">
                      How to do it
                    </h4>
                    <p className="text-espresso text-sm leading-relaxed whitespace-pre-line">
                      {activity.instructions}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Theme note */}
      {classroomTheme && (
        <div className="text-center mt-6 fade-up">
          <p className="text-warm-gray/60 text-xs">
            Activities aligned with the classroom theme:{" "}
            <span className="text-warm-gray font-medium">
              {classroomTheme}
            </span>
          </p>
        </div>
      )}

      {/* Interests note */}
      {interests.length > 0 && (
        <div className="text-center mt-2 fade-up">
          <p className="text-warm-gray/60 text-xs">
            Based on {childName}&apos;s interests:{" "}
            <span className="text-warm-gray font-medium">
              {interests.join(", ")}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
