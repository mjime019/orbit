"use client";

import { useState } from "react";
import type { ExtracurricularProvider } from "@/lib/types";
import { DOMAIN_CONFIG } from "@/lib/types";

interface Props {
  providers: ExtracurricularProvider[];
  childName: string;
  interests: string[];
}

const FILTERS = [
  { key: "on_campus", label: "\u{1F3EB} On campus" },
  { key: "has_perk", label: "\u{1F381} Orbit perks" },
  { key: "movement", label: "\u{1F3C3} Movement" },
  { key: "creative", label: "\u{1F3A8} Creative" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  STEM: { bg: "bg-sky/10", text: "text-sky" },
  Movement: { bg: "bg-sage/10", text: "text-sage" },
  Art: { bg: "bg-golden/10", text: "text-golden" },
  Music: { bg: "bg-domain-cognitive-bg", text: "text-domain-cognitive-text" },
  Language: { bg: "bg-domain-language-bg", text: "text-domain-language-text" },
};

export function ProviderList({ providers, childName }: Props) {
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(
    new Set()
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Record<string, string>>({});

  function toggleFilter(key: FilterKey) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Apply filters
  const filtered = providers.filter((p) => {
    if (activeFilters.has("on_campus") && !p.on_campus) return false;
    if (activeFilters.has("has_perk") && !p.orbit_perk) return false;
    if (
      activeFilters.has("movement") &&
      p.category.toLowerCase() !== "movement"
    )
      return false;
    if (activeFilters.has("creative") && p.category.toLowerCase() !== "art")
      return false;
    return true;
  });

  // Group by category
  const grouped = filtered.reduce<
    Record<string, ExtracurricularProvider[]>
  >((acc, p) => {
    const cat = p.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

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

      {/* Provider cards grouped by category */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([category, categoryProviders]) => (
          <div key={category}>
            <h2 className="text-xs font-semibold text-warm-gray uppercase tracking-wider mb-3">
              {category}
            </h2>
            <div className="space-y-4">
              {categoryProviders.map((provider, i) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  childName={childName}
                  expanded={expandedId === provider.id}
                  onToggle={() =>
                    setExpandedId(
                      expandedId === provider.id ? null : provider.id
                    )
                  }
                  activeTab={activeTab[provider.id] ?? "fit"}
                  onTabChange={(tab) =>
                    setActiveTab((prev) => ({
                      ...prev,
                      [provider.id]: tab,
                    }))
                  }
                  delay={i}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-3xl mb-2">{"\u{1F50D}"}</p>
          <p className="text-warm-gray text-sm">
            No providers match your filters. Try removing some.
          </p>
        </div>
      )}
    </div>
  );
}

function ProviderCard({
  provider,
  childName,
  expanded,
  onToggle,
  activeTab,
  onTabChange,
  delay,
}: {
  provider: ExtracurricularProvider;
  childName: string;
  expanded: boolean;
  onToggle: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  delay: number;
}) {
  const catColor = CATEGORY_COLORS[provider.category] ?? {
    bg: "bg-sand",
    text: "text-warm-gray",
  };

  const schedule = Array.isArray(provider.schedule) ? provider.schedule : [];

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-all fade-up delay-${Math.min(delay + 1, 6)}`}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          {/* Emoji */}
          <div className="text-2xl shrink-0 mt-0.5">
            {provider.emoji || "\u{1F3AF}"}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-[family-name:var(--font-playfair)] text-lg font-bold text-espresso leading-tight">
              {provider.name}
            </h3>
            {provider.provider && (
              <p className="text-warm-gray text-xs mt-0.5">
                {provider.provider}
              </p>
            )}
          </div>
          {/* Badges */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            {provider.on_campus && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sage/15 text-sage font-medium">
                {"\u{1F3EB}"} On campus
              </span>
            )}
            {provider.orbit_perk && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-golden/15 text-golden font-medium">
                {"\u{1F381}"} {provider.orbit_perk.label}
              </span>
            )}
          </div>
        </div>

        {/* Info pills */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full ${catColor.bg} ${catColor.text}`}
          >
            {provider.category}
          </span>
          {provider.distance && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-sand text-warm-gray">
              {"\u{1F4CD}"} {provider.distance}
            </span>
          )}
          {provider.price && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-sand text-warm-gray">
              {provider.price}
            </span>
          )}
          {provider.ages && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-sand text-warm-gray">
              Ages {provider.ages}
            </span>
          )}
          {provider.group_size && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-sand text-warm-gray">
              {"\u{1F465}"} {provider.group_size}
            </span>
          )}
        </div>

        {/* Domain pills */}
        {provider.domains.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {provider.domains.map((domain) => {
              const cfg = DOMAIN_CONFIG[domain];
              if (!cfg) return null;
              return (
                <span
                  key={domain}
                  className={`text-[10px] px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}
                >
                  {cfg.emoji} {cfg.label}
                </span>
              );
            })}
          </div>
        )}

        {/* Quick fit summary (first item from why_good_fit) */}
        {provider.why_good_fit.length > 0 && (
          <div className="mt-3 bg-sage/8 rounded-xl px-3 py-2.5">
            <p className="text-[11px] font-semibold text-sage mb-0.5">
              {"\u2728"} Why it fits {childName}
            </p>
            <p className="text-xs text-espresso/80 leading-relaxed">
              {provider.why_good_fit[0]}
            </p>
          </div>
        )}

        {/* Next available */}
        {schedule.length > 0 && (
          <p className="text-[11px] text-warm-gray mt-2">
            {"\u{1F4C5}"} Next: {schedule[0].day} {schedule[0].time}
            {schedule[0].spots_left != null && (
              <span className="text-rust ml-1">
                ({schedule[0].spots_left} spots left)
              </span>
            )}
          </p>
        )}

        {/* Toggle */}
        <button
          onClick={onToggle}
          className="text-xs text-sky hover:text-sky/80 transition-colors mt-3"
        >
          {expanded ? "Less \u2191" : "Details \u2193"}
        </button>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-sand">
          {/* Tab bar */}
          <div className="flex border-b border-sand">
            {[
              { key: "fit", label: "\u{1F3AF} Fit" },
              { key: "schedule", label: "\u{1F4C5} Schedule" },
              { key: "trial", label: "\u{1F4DD} Trial Prep" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={`flex-1 text-xs py-2.5 transition-colors ${
                  activeTab === tab.key
                    ? "text-rust border-b-2 border-rust font-semibold"
                    : "text-warm-gray hover:text-espresso"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {activeTab === "fit" && (
              <FitTab provider={provider} childName={childName} />
            )}
            {activeTab === "schedule" && (
              <ScheduleTab provider={provider} />
            )}
            {activeTab === "trial" && <TrialTab provider={provider} />}
          </div>
        </div>
      )}
    </div>
  );
}

function FitTab({
  provider,
  childName,
}: {
  provider: ExtracurricularProvider;
  childName: string;
}) {
  return (
    <div className="space-y-4">
      {/* Why good fit */}
      {provider.why_good_fit.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-sage mb-2">
            {"\u2705"} Why it&apos;s a good fit for {childName}
          </p>
          <ul className="space-y-1.5">
            {provider.why_good_fit.map((reason, i) => (
              <li
                key={i}
                className="text-xs text-espresso/80 leading-relaxed pl-4 relative"
              >
                <span className="absolute left-0 text-sage">&bull;</span>
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Why might not fit */}
      {provider.why_might_not_fit.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-rust/80 mb-2">
            {"\u{1F914}"} Things to consider
          </p>
          <ul className="space-y-1.5">
            {provider.why_might_not_fit.map((reason, i) => (
              <li
                key={i}
                className="text-xs text-espresso/80 leading-relaxed pl-4 relative"
              >
                <span className="absolute left-0 text-rust/60">&bull;</span>
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Price note */}
      {provider.price_note && (
        <p className="text-[11px] text-warm-gray bg-sand/50 rounded-lg px-3 py-2">
          {"\u{1F4B0}"} {provider.price_note}
        </p>
      )}

      {/* Orbit perk detail */}
      {provider.orbit_perk && (
        <div className="bg-golden/8 rounded-xl px-3 py-2.5">
          <p className="text-[11px] font-semibold text-golden mb-0.5">
            {"\u{1F381}"} Orbit Perk
          </p>
          <p className="text-xs text-espresso/80">
            {provider.orbit_perk.detail}
          </p>
        </div>
      )}
    </div>
  );
}

function ScheduleTab({
  provider,
}: {
  provider: ExtracurricularProvider;
}) {
  const schedule = Array.isArray(provider.schedule) ? provider.schedule : [];

  if (schedule.length === 0) {
    return (
      <p className="text-xs text-warm-gray">
        No schedule information available yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {schedule.map((slot, i) => (
        <div
          key={i}
          className="flex items-center justify-between bg-sand/50 rounded-lg px-3 py-2.5"
        >
          <div>
            <p className="text-xs font-semibold text-espresso">{slot.day}</p>
            <p className="text-[11px] text-warm-gray">{slot.time}</p>
          </div>
          {slot.spots_left != null && (
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full ${
                slot.spots_left <= 2
                  ? "bg-rust/10 text-rust"
                  : "bg-sage/10 text-sage"
              }`}
            >
              {slot.spots_left} spot{slot.spots_left !== 1 ? "s" : ""} left
            </span>
          )}
        </div>
      ))}

      {provider.location && (
        <p className="text-[11px] text-warm-gray mt-2">
          {"\u{1F4CD}"} {provider.location}
        </p>
      )}
    </div>
  );
}

function TrialTab({
  provider,
}: {
  provider: ExtracurricularProvider;
}) {
  return (
    <div className="space-y-4">
      {/* What to look for */}
      {provider.what_to_look_for.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-espresso mb-2">
            {"\u{1F440}"} What to look for
          </p>
          <ul className="space-y-1.5">
            {provider.what_to_look_for.map((item, i) => (
              <li
                key={i}
                className="text-xs text-espresso/80 leading-relaxed pl-4 relative"
              >
                <span className="absolute left-0 text-sky">&bull;</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Questions to ask */}
      {provider.trial_questions.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-espresso mb-2">
            {"\u2753"} Questions to ask
          </p>
          <ul className="space-y-1.5">
            {provider.trial_questions.map((q, i) => (
              <li
                key={i}
                className="text-xs text-espresso/80 leading-relaxed pl-4 relative"
              >
                <span className="absolute left-0 text-golden">{i + 1}.</span>
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Description */}
      {provider.description && (
        <div className="bg-sand/50 rounded-lg px-3 py-2.5">
          <p className="text-[11px] text-warm-gray leading-relaxed">
            {provider.description}
          </p>
        </div>
      )}
    </div>
  );
}
