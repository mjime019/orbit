"use client";

import { useState } from "react";
import type { WeekendPlace, WeekendRecommendation } from "@/lib/types";

interface PlaceWithRec extends WeekendPlace {
  recommendation: Pick<
    WeekendRecommendation,
    "id" | "fit_score" | "fit_reason"
  > | null;
}

interface Props {
  places: PlaceWithRec[];
  childName: string;
  interests: string[];
}

const COST_LABELS: Record<string, string> = {
  free: "Free",
  low: "$",
  medium: "$$",
  high: "$$$",
};

const FILTERS = [
  { key: "low_noise", label: "\u{1F54A}\uFE0F Low noise", icon: "" },
  { key: "free", label: "Free", icon: "" },
  { key: "indoor", label: "Indoor", icon: "" },
  { key: "outdoor", label: "Outdoor", icon: "" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

export function WeekendList({ places, childName, interests }: Props) {
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(
    new Set()
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  function toggleFilter(key: FilterKey) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSaved(id: string) {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Apply filters
  const filtered = places.filter((place) => {
    if (activeFilters.has("low_noise") && place.noise_level !== "low")
      return false;
    if (activeFilters.has("free") && place.cost_tier !== "free") return false;
    if (
      activeFilters.has("indoor") &&
      !place.tags.some((t) => t.toLowerCase().includes("indoor"))
    )
      return false;
    if (
      activeFilters.has("outdoor") &&
      !place.tags.some(
        (t) =>
          t.toLowerCase().includes("outdoor") ||
          t.toLowerCase().includes("nature") ||
          t.toLowerCase().includes("park") ||
          t.toLowerCase().includes("beach")
      )
    )
      return false;
    return true;
  });

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto orbit-scroll pb-3 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => toggleFilter(f.key)}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              activeFilters.has(f.key)
                ? "bg-rust text-white border-rust"
                : "bg-white text-espresso border-sand-dark hover:bg-sand"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-warm-gray text-xs mb-4">
        {filtered.length} place{filtered.length !== 1 ? "s" : ""} found
      </p>

      {/* Place cards */}
      <div className="space-y-4">
        {filtered.map((place, i) => (
          <PlaceCard
            key={place.id}
            place={place}
            childName={childName}
            expanded={expandedId === place.id}
            onToggle={() =>
              setExpandedId(expandedId === place.id ? null : place.id)
            }
            isSaved={saved.has(place.id)}
            onToggleSave={() => toggleSaved(place.id)}
            delay={i}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-3xl mb-2">{"\u{1F50D}"}</p>
          <p className="text-warm-gray text-sm">
            No places match your filters. Try removing some.
          </p>
        </div>
      )}
    </div>
  );
}

function PlaceCard({
  place,
  childName,
  expanded,
  onToggle,
  isSaved,
  onToggleSave,
  delay,
}: {
  place: PlaceWithRec;
  childName: string;
  expanded: boolean;
  onToggle: () => void;
  isSaved: boolean;
  onToggleSave: () => void;
  delay: number;
}) {
  const rec = place.recommendation;
  const costLabel = COST_LABELS[place.cost_tier] ?? place.cost_tier;

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-all fade-up delay-${Math.min(delay + 1, 6)}`}
    >
      {/* Card header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-[family-name:var(--font-playfair)] text-lg font-bold text-espresso leading-tight">
              {place.name}
            </h3>
            {place.location && (
              <p className="text-warm-gray text-xs mt-1">{place.location}</p>
            )}
          </div>
          {rec && rec.fit_score != null && (
            <ScoreBadge score={rec.fit_score} />
          )}
        </div>

        {/* Info pills */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-sand text-warm-gray">
            {costLabel}
          </span>
          {place.rating && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-sand text-warm-gray">
              {"\u2B50"} {place.rating}
            </span>
          )}
          {place.noise_level && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-sand text-warm-gray">
              {place.noise_level === "low"
                ? "\u{1F54A}\uFE0F Quiet"
                : place.noise_level === "high"
                  ? "\u{1F50A} Lively"
                  : "\u{1F3B5} Moderate"}
            </span>
          )}
          {place.age_min != null && place.age_max != null && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-sand text-warm-gray">
              Ages {place.age_min}&ndash;{place.age_max}
            </span>
          )}
        </div>

        {/* Tags */}
        {place.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {place.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-2 py-0.5 rounded-full bg-sky/10 text-sky"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Fit reason */}
        {rec?.fit_reason && (
          <div className="mt-3 bg-sage/8 rounded-xl px-3 py-2.5">
            <p className="text-[11px] font-semibold text-sage mb-1">
              {"\u2728"} Why it fits {childName}
            </p>
            <p className="text-xs text-espresso/80 leading-relaxed">
              {rec.fit_reason}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={onToggle}
            className="text-xs text-sky hover:text-sky/80 transition-colors"
          >
            {expanded ? "Less \u2191" : "More \u2193"}
          </button>
          <span className="text-sand-dark">|</span>
          <button
            onClick={onToggleSave}
            className={`text-xs transition-colors ${
              isSaved
                ? "text-golden"
                : "text-warm-gray hover:text-golden"
            }`}
          >
            {isSaved ? "\u{1F4CC} Saved" : "\u{1F4CC} Save"}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-sand px-4 py-4 space-y-3">
          {place.description && (
            <div>
              <p className="text-xs font-semibold text-espresso mb-1">
                About
              </p>
              <p className="text-xs text-warm-gray leading-relaxed">
                {place.description}
              </p>
            </div>
          )}

          {place.hours && (
            <div className="flex gap-2">
              <span className="text-xs">{"\u{1F552}"}</span>
              <p className="text-xs text-warm-gray">{place.hours}</p>
            </div>
          )}

          {place.parking && (
            <div className="flex gap-2">
              <span className="text-xs">{"\u{1F697}"}</span>
              <p className="text-xs text-warm-gray">{place.parking}</p>
            </div>
          )}

          {place.phone && (
            <div className="flex gap-2">
              <span className="text-xs">{"\u{1F4DE}"}</span>
              <p className="text-xs text-warm-gray">{place.phone}</p>
            </div>
          )}

          {place.sensory_notes && (
            <div className="bg-domain-sel-bg/50 rounded-lg px-3 py-2">
              <p className="text-[11px] font-semibold text-domain-sel-text mb-0.5">
                {"\u{1F9E0}"} Sensory Notes
              </p>
              <p className="text-xs text-domain-sel-text/80">
                {place.sensory_notes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-sage text-white"
      : score >= 60
        ? "bg-golden text-white"
        : "bg-rust/70 text-white";

  return (
    <div
      className={`shrink-0 w-11 h-11 rounded-full ${color} flex items-center justify-center`}
    >
      <span className="text-sm font-bold">{score}</span>
    </div>
  );
}
