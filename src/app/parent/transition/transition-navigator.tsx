"use client";

import { useState, useEffect } from "react";
import type { TransitionSchool, Observation } from "@/lib/types";
import { DOMAIN_CONFIG } from "@/lib/types";

type Tab = "compare" | "timeline" | "readiness" | "insights";

interface Props {
  schools: TransitionSchool[];
  childName: string;
  interests: string[];
  parentGoals: string[];
  playStyle: string | null;
  observations: Observation[];
}

const TABS: { key: Tab; label: string; emoji: string }[] = [
  { key: "compare", label: "Compare", emoji: "\u{1F3EB}" },
  { key: "timeline", label: "Timeline", emoji: "\u{1F4C5}" },
  { key: "readiness", label: "Readiness", emoji: "\u{1F331}" },
  { key: "insights", label: "Insights", emoji: "\u{1F4A1}" },
];

// Timeline items for kindergarten application
const TIMELINE_ITEMS = [
  {
    id: "t1",
    month: "Jan",
    label: "Research local school options",
    category: "research",
    emoji: "\u{1F50D}",
  },
  {
    id: "t2",
    month: "Jan",
    label: "Submit magnet/charter lottery applications",
    category: "apply",
    emoji: "\u{1F4E8}",
  },
  {
    id: "t3",
    month: "Feb",
    label: "Submit private school applications",
    category: "apply",
    emoji: "\u{1F4DD}",
  },
  {
    id: "t4",
    month: "Feb",
    label: "Schedule school visits and tours",
    category: "visit",
    emoji: "\u{1F3EB}",
  },
  {
    id: "t5",
    month: "Mar",
    label: "Attend open houses and observe classrooms",
    category: "visit",
    emoji: "\u{1F440}",
  },
  {
    id: "t6",
    month: "Mar",
    label: "Gather and organize required documents",
    category: "docs",
    emoji: "\u{1F4C1}",
  },
  {
    id: "t7",
    month: "Apr",
    label: "Register for zoned public school",
    category: "apply",
    emoji: "\u2705",
  },
  {
    id: "t8",
    month: "Apr",
    label: "Receive lottery/admission results",
    category: "decide",
    emoji: "\u{1F4EC}",
  },
  {
    id: "t9",
    month: "May",
    label: "Make final school decision",
    category: "decide",
    emoji: "\u{1F3AF}",
  },
  {
    id: "t10",
    month: "Jun",
    label: "Attend orientation or transition events",
    category: "prep",
    emoji: "\u{1F91D}",
  },
  {
    id: "t11",
    month: "Jul",
    label: "Practice new routines (wake time, lunch, etc.)",
    category: "prep",
    emoji: "\u{1F570}\uFE0F",
  },
  {
    id: "t12",
    month: "Aug",
    label: "First day prep and celebration!",
    category: "prep",
    emoji: "\u{1F389}",
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  research: "bg-sky/10 text-sky",
  apply: "bg-rust/10 text-rust",
  visit: "bg-sage/10 text-sage",
  docs: "bg-golden/10 text-golden",
  decide: "bg-domain-cognitive-bg text-domain-cognitive-text",
  prep: "bg-domain-creative-bg text-domain-creative-text",
};

function readSavedChecks(): Set<string> {
  try {
    return new Set<string>(
      JSON.parse(localStorage.getItem("orbit-timeline-checks") ?? "[]")
    );
  } catch {
    return new Set();
  }
}

export function TransitionNavigator({
  schools,
  childName,
  interests,
  parentGoals,
  playStyle,
  observations,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("compare");
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [expandedSchool, setExpandedSchool] = useState<string | null>(null);

  // Load checked items from localStorage. Must run in an effect (not a
  // useState initializer) so the SSR HTML matches the first client render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCheckedItems(readSavedChecks());
  }, []);

  function toggleCheck(id: string) {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(
          "orbit-timeline-checks",
          JSON.stringify([...next])
        );
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="flex bg-white rounded-xl shadow-sm mb-5 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 text-xs py-2.5 rounded-lg transition-colors ${
              activeTab === tab.key
                ? "bg-rust text-white font-semibold shadow-sm"
                : "text-warm-gray hover:text-espresso"
            }`}
          >
            {tab.emoji} {tab.label}
          </button>
        ))}
      </div>

      {/* Upcoming deadline banner */}
      {activeTab === "compare" && <DeadlineBanner schools={schools} />}

      {/* Tab content */}
      {activeTab === "compare" && (
        <CompareTab
          schools={schools}
          childName={childName}
          expandedSchool={expandedSchool}
          onToggleSchool={(id) =>
            setExpandedSchool(expandedSchool === id ? null : id)
          }
        />
      )}
      {activeTab === "timeline" && (
        <TimelineTab
          checkedItems={checkedItems}
          onToggleCheck={toggleCheck}
        />
      )}
      {activeTab === "readiness" && (
        <ReadinessTab
          childName={childName}
          interests={interests}
          playStyle={playStyle}
          observations={observations}
        />
      )}
      {activeTab === "insights" && (
        <InsightsTab
          childName={childName}
          interests={interests}
          parentGoals={parentGoals}
          playStyle={playStyle}
        />
      )}
    </div>
  );
}

// ─── Compare Tab ──────────────────────────────────────────────

function DeadlineBanner({ schools }: { schools: TransitionSchool[] }) {
  const now = new Date();
  const upcoming = schools
    .filter((s) => s.deadline && new Date(s.deadline) > now)
    .sort(
      (a, b) =>
        new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime()
    );

  if (upcoming.length === 0) return null;
  const nearest = upcoming[0];
  const daysLeft = Math.ceil(
    (new Date(nearest.deadline!).getTime() - now.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (daysLeft > 30) return null;

  return (
    <div className="bg-rust/10 rounded-xl px-4 py-3 mb-4">
      <p className="text-xs font-semibold text-rust">
        {"\u{1F6A8}"} {nearest.deadline_label || nearest.name} deadline in{" "}
        {daysLeft} day{daysLeft !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

function CompareTab({
  schools,
  childName,
  expandedSchool,
  onToggleSchool,
}: {
  schools: TransitionSchool[];
  childName: string;
  expandedSchool: string | null;
  onToggleSchool: (id: string) => void;
}) {
  if (schools.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-3xl mb-2">{"\u{1F3EB}"}</p>
        <p className="text-warm-gray text-sm">
          No schools added yet. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {schools.map((school, i) => (
        <SchoolCard
          key={school.id}
          school={school}
          rank={i + 1}
          childName={childName}
          expanded={expandedSchool === school.id}
          onToggle={() => onToggleSchool(school.id)}
        />
      ))}

      {/* Comparison table if 2+ schools */}
      {schools.length >= 2 && (
        <div className="bg-white rounded-2xl shadow-sm p-4 mt-6">
          <h3 className="font-[family-name:var(--font-playfair)] text-sm font-bold text-espresso mb-3">
            {"\u{1F4CA}"} Side-by-Side
          </h3>
          <div className="overflow-x-auto orbit-scroll">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-sand">
                  <th className="text-left py-2 pr-3 text-warm-gray font-normal w-24">
                    &nbsp;
                  </th>
                  {schools.map((s) => (
                    <th
                      key={s.id}
                      className="text-left py-2 px-2 text-espresso font-semibold min-w-[120px]"
                    >
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <CompareRow
                  label="Type"
                  values={schools.map((s) => s.school_type ?? "—")}
                />
                <CompareRow
                  label="Distance"
                  values={schools.map((s) => s.distance ?? "—")}
                />
                <CompareRow
                  label="Tuition"
                  values={schools.map((s) => s.tuition ?? "—")}
                />
                <CompareRow
                  label="Class Size"
                  values={schools.map((s) =>
                    s.class_size ? `${s.class_size} students` : "—"
                  )}
                />
                <CompareRow
                  label="Style"
                  values={schools.map((s) => s.style ?? "—")}
                />
                <CompareRow
                  label="Languages"
                  values={schools.map((s) =>
                    s.languages.length > 0 ? s.languages.join(", ") : "—"
                  )}
                />
                <CompareRow
                  label="Fit Rating"
                  values={schools.map((s) =>
                    s.rating_fit != null
                      ? `${s.rating_fit}/5`
                      : "—"
                  )}
                />
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function CompareRow({
  label,
  values,
}: {
  label: string;
  values: string[];
}) {
  return (
    <tr className="border-b border-sand/50">
      <td className="py-2 pr-3 text-warm-gray">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="py-2 px-2 text-espresso">
          {v}
        </td>
      ))}
    </tr>
  );
}

function SchoolCard({
  school,
  rank,
  childName,
  expanded,
  onToggle,
}: {
  school: TransitionSchool;
  rank: number;
  childName: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const now = new Date();
  const deadline = school.deadline ? new Date(school.deadline) : null;
  const isPast = deadline && deadline < now;
  const daysLeft = deadline
    ? Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const rankColors = ["bg-golden text-white", "bg-sky text-white", "bg-sage text-white"];

  return (
    <div className={`bg-white rounded-2xl shadow-sm overflow-hidden fade-up delay-${Math.min(rank, 6)}`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-[family-name:var(--font-playfair)] text-lg font-bold text-espresso leading-tight">
              {school.name}
            </h3>
            {school.style && (
              <p className="text-warm-gray text-xs italic mt-0.5">
                {school.style}
              </p>
            )}
          </div>
          {/* Rank badge */}
          <div
            className={`shrink-0 w-10 h-10 rounded-full ${rankColors[rank - 1] || "bg-sand text-warm-gray"} flex items-center justify-center`}
          >
            <span className="text-xs font-bold">#{rank}</span>
          </div>
        </div>

        {/* Info pills */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {school.school_type && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-sand text-warm-gray">
              {school.school_type}
            </span>
          )}
          {school.distance && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-sand text-warm-gray">
              {"\u{1F4CD}"} {school.distance}
            </span>
          )}
          {school.tuition && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-sand text-warm-gray">
              {school.tuition}
            </span>
          )}
          {school.class_size && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-sand text-warm-gray">
              {"\u{1F465}"} {school.class_size} students
            </span>
          )}
        </div>

        {/* Deadline */}
        {deadline && (
          <div
            className={`mt-3 inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full ${
              isPast
                ? "bg-sage/10 text-sage"
                : daysLeft != null && daysLeft <= 30
                  ? "bg-rust/10 text-rust"
                  : "bg-sky/10 text-sky"
            }`}
          >
            {isPast ? "\u2705" : "\u{1F4C5}"}{" "}
            {school.deadline_label ||
              deadline.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            {!isPast && daysLeft != null && ` (${daysLeft}d)`}
          </div>
        )}

        {/* Rating bars */}
        {(school.rating_academics != null || school.rating_fit != null) && (
          <div className="mt-3 space-y-1.5">
            {school.rating_fit != null && (
              <RatingBar label="Fit" value={school.rating_fit} color="bg-golden" />
            )}
            {school.rating_academics != null && (
              <RatingBar
                label="Academics"
                value={school.rating_academics}
                color="bg-sky"
              />
            )}
            {school.rating_community != null && (
              <RatingBar
                label="Community"
                value={school.rating_community}
                color="bg-sage"
              />
            )}
          </div>
        )}

        {/* Toggle */}
        <button
          onClick={onToggle}
          className="text-xs text-sky hover:text-sky/80 transition-colors mt-3"
        >
          {expanded ? "Less \u2191" : "Details \u2193"}
        </button>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-sand px-4 py-4 space-y-4">
          {/* Features */}
          {school.features.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-espresso mb-2">
                Features
              </p>
              <div className="flex flex-wrap gap-1.5">
                {school.features.map((f) => (
                  <span
                    key={f}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-sky/10 text-sky"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Strengths */}
          {school.strengths.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-sage mb-2">
                {"\u2705"} Strengths for {childName}
              </p>
              <ul className="space-y-1.5">
                {school.strengths.map((s, i) => (
                  <li
                    key={i}
                    className="text-xs text-espresso/80 leading-relaxed pl-4 relative"
                  >
                    <span className="absolute left-0 text-sage">&bull;</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Considerations */}
          {school.considerations.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-rust/80 mb-2">
                {"\u{1F914}"} Considerations
              </p>
              <ul className="space-y-1.5">
                {school.considerations.map((c, i) => (
                  <li
                    key={i}
                    className="text-xs text-espresso/80 leading-relaxed pl-4 relative"
                  >
                    <span className="absolute left-0 text-rust/60">&bull;</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Languages */}
          {school.languages.length > 0 && (
            <div className="flex gap-1.5">
              <span className="text-xs text-warm-gray">Languages:</span>
              {school.languages.map((l) => (
                <span
                  key={l}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-domain-language-bg text-domain-language-text"
                >
                  {l}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RatingBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const pct = (value / 5) * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-warm-gray w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-sand rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-warm-gray w-6 text-right">
        {value}
      </span>
    </div>
  );
}

// ─── Timeline Tab ──────────────────────────────────────────────

function TimelineTab({
  checkedItems,
  onToggleCheck,
}: {
  checkedItems: Set<string>;
  onToggleCheck: (id: string) => void;
}) {
  const completed = TIMELINE_ITEMS.filter((t) => checkedItems.has(t.id)).length;
  const total = TIMELINE_ITEMS.length;
  const pct = Math.round((completed / total) * 100);

  return (
    <div>
      {/* Progress bar */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-espresso">
            {"\u{1F4CA}"} Progress
          </p>
          <p className="text-xs text-warm-gray">
            {completed} of {total} complete ({pct}%)
          </p>
        </div>
        <div className="h-2 bg-sand rounded-full overflow-hidden">
          <div
            className="h-full bg-sage rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Timeline items */}
      <div className="space-y-1">
        {TIMELINE_ITEMS.map((item, i) => {
          const isChecked = checkedItems.has(item.id);
          const catColor = CATEGORY_COLORS[item.category] || "bg-sand text-warm-gray";
          const prevMonth = i > 0 ? TIMELINE_ITEMS[i - 1].month : null;
          const showMonth = item.month !== prevMonth;

          return (
            <div key={item.id}>
              {showMonth && (
                <p className="text-[10px] font-semibold text-warm-gray uppercase tracking-wider mt-4 mb-2 ml-10">
                  {item.month}
                </p>
              )}
              <div className="flex items-start gap-3">
                {/* Check circle */}
                <button
                  onClick={() => onToggleCheck(item.id)}
                  className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors mt-0.5 ${
                    isChecked
                      ? "bg-sage border-sage text-white"
                      : "border-sand-dark hover:border-rust"
                  }`}
                >
                  {isChecked && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>

                {/* Content */}
                <div
                  className={`flex-1 bg-white rounded-xl px-3 py-2.5 shadow-sm ${
                    isChecked ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{item.emoji}</span>
                    <p
                      className={`text-xs text-espresso leading-relaxed ${
                        isChecked ? "line-through" : ""
                      }`}
                    >
                      {item.label}
                    </p>
                  </div>
                  <span
                    className={`inline-block text-[9px] px-1.5 py-0.5 rounded mt-1 ${catColor}`}
                  >
                    {item.category}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Readiness Tab ──────────────────────────────────────────────

function ReadinessTab({
  childName,
  interests,
  playStyle,
  observations,
}: {
  childName: string;
  interests: string[];
  playStyle: string | null;
  observations: Observation[];
}) {
  // Compute domain counts from observations
  const domainCounts: Record<string, number> = {};
  observations.forEach((obs) => {
    obs.domains.forEach((d) => {
      domainCounts[d] = (domainCounts[d] || 0) + 1;
    });
  });

  const topDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  // Recent social moments
  const socialObs = observations.filter((o) => o.social_tag);

  return (
    <div className="space-y-4">
      {/* Profile snapshot */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <h3 className="font-[family-name:var(--font-playfair)] text-sm font-bold text-espresso mb-3">
          {"\u{1F31F}"} {childName}&apos;s Snapshot
        </h3>

        {/* Interests */}
        {interests.length > 0 && (
          <div className="mb-3">
            <p className="text-[11px] text-warm-gray mb-1.5">Interests</p>
            <div className="flex flex-wrap gap-1.5">
              {interests.map((i) => (
                <span
                  key={i}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-golden/10 text-golden"
                >
                  {i}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Play style */}
        {playStyle && (
          <div className="mb-3">
            <p className="text-[11px] text-warm-gray mb-1">Play Style</p>
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-sky/10 text-sky">
              {playStyle}
            </span>
          </div>
        )}
      </div>

      {/* Domain strengths */}
      {topDomains.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h3 className="font-[family-name:var(--font-playfair)] text-sm font-bold text-espresso mb-3">
            {"\u{1F4CA}"} Growth Areas (from {observations.length} observations)
          </h3>
          <div className="space-y-2">
            {topDomains.map(([domain, count]) => {
              const cfg = DOMAIN_CONFIG[domain];
              if (!cfg) return null;
              const pct = Math.round(
                (count / observations.length) * 100
              );
              return (
                <div key={domain} className="flex items-center gap-2">
                  <span className={`text-[11px] w-20 shrink-0 ${cfg.text}`}>
                    {cfg.emoji} {cfg.label}
                  </span>
                  <div className="flex-1 h-2 bg-sand rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${cfg.bg.replace("bg-", "bg-")}`}
                      style={{
                        width: `${pct}%`,
                        backgroundColor:
                          cfg.text
                            .replace("text-domain-", "")
                            .includes("language")
                            ? "#0068B0"
                            : cfg.text.includes("motor")
                              ? "#1B7D2E"
                              : cfg.text.includes("social")
                                ? "#6B4FA0"
                                : cfg.text.includes("cognitive")
                                  ? "#9E8600"
                                  : cfg.text.includes("creative")
                                    ? "#C62828"
                                    : "#6B7280",
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-warm-gray w-8 text-right">
                    {count}x
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Social moments */}
      {socialObs.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h3 className="font-[family-name:var(--font-playfair)] text-sm font-bold text-espresso mb-3">
            {"\u{1F91D}"} Social Moments
          </h3>
          <div className="space-y-2">
            {socialObs.slice(0, 4).map((obs) => (
              <div
                key={obs.id}
                className="bg-sand/50 rounded-lg px-3 py-2"
              >
                <p className="text-xs text-espresso/80 leading-relaxed">
                  {obs.note.length > 120
                    ? obs.note.slice(0, 120) + "..."
                    : obs.note}
                </p>
                <p className="text-[10px] text-warm-gray mt-1">
                  {new Date(obs.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {observations.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
          <p className="text-warm-gray text-sm">
            No observations yet. As teachers record moments, {childName}
            &apos;s readiness snapshot will grow.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Insights Tab ──────────────────────────────────────────────

interface InsightCard {
  emoji: string;
  title: string;
  text: string;
  priority: "high" | "medium" | "low";
}

function generateInsights(
  childName: string,
  interests: string[],
  parentGoals: string[],
  playStyle: string | null
): InsightCard[] {
  const cards: InsightCard[] = [];

  // Bilingual
  if (
    parentGoals.some(
      (g) =>
        g.toLowerCase().includes("bilingual") ||
        g.toLowerCase().includes("language") ||
        g.toLowerCase().includes("spanish")
    )
  ) {
    cards.push({
      emoji: "\u{1F30D}",
      title: "Bilingual Advantage",
      text: `${childName}'s bilingual home is a superpower. Dual-language programs can accelerate cognitive flexibility and give a strong foundation in both languages. Look for schools with at least 50% immersion time.`,
      priority: "high",
    });
  }

  // Builder / STEM
  if (
    interests.some(
      (i) =>
        i.toLowerCase().includes("build") ||
        i.toLowerCase().includes("lego") ||
        i.toLowerCase().includes("construct") ||
        i.toLowerCase().includes("engineer")
    )
  ) {
    cards.push({
      emoji: "\u{1F9F1}",
      title: "Builder's Brain",
      text: `${childName}'s love of building shows strong spatial reasoning and engineering thinking. Prioritize schools with maker spaces, block areas, and hands-on STEM — not just worksheets.`,
      priority: "high",
    });
  }

  // Collaborative play style
  if (
    playStyle &&
    (playStyle.toLowerCase().includes("collaborat") ||
      playStyle.toLowerCase().includes("social") ||
      playStyle.toLowerCase().includes("group"))
  ) {
    cards.push({
      emoji: "\u{1F465}",
      title: "Social Learner",
      text: `${childName} thrives in collaborative settings. Look for schools emphasizing group projects, partner work, and cooperative learning — not just independent desk work.`,
      priority: "medium",
    });
  }

  // Creative interests
  if (
    interests.some(
      (i) =>
        i.toLowerCase().includes("paint") ||
        i.toLowerCase().includes("art") ||
        i.toLowerCase().includes("draw") ||
        i.toLowerCase().includes("creat") ||
        i.toLowerCase().includes("color")
    )
  ) {
    cards.push({
      emoji: "\u{1F3A8}",
      title: "Creative Spirit",
      text: `${childName}'s creative interests are developing beautifully. Ensure the school values process art and open-ended exploration, not just coloring sheets and templates.`,
      priority: "medium",
    });
  }

  // General transition support
  cards.push({
    emoji: "\u{1F331}",
    title: "Transition Support",
    text: `Big school transitions work best when children feel safe and prepared. Ask about buddy systems, gradual entry, and how the school handles the first weeks. Visit in advance so ${childName} can picture the space.`,
    priority: "medium",
  });

  // Confidence
  if (
    parentGoals.some(
      (g) =>
        g.toLowerCase().includes("confiden") ||
        g.toLowerCase().includes("independen")
    )
  ) {
    cards.push({
      emoji: "\u{1F4AA}",
      title: "Building Confidence",
      text: `You've mentioned wanting ${childName} to build confidence. Smaller class sizes (under 18) and schools with responsive teachers tend to support this best. Ask how teachers encourage voice in the classroom.`,
      priority: "medium",
    });
  }

  return cards;
}

function InsightsTab({
  childName,
  interests,
  parentGoals,
  playStyle,
}: {
  childName: string;
  interests: string[];
  parentGoals: string[];
  playStyle: string | null;
}) {
  const insights = generateInsights(childName, interests, parentGoals, playStyle);

  const VISIT_QUESTIONS = [
    "How do you handle the first week for new kindergartners?",
    "What does a typical day look like — how much is structured vs. free?",
    "How do you communicate with parents about their child's day?",
    "How are conflicts between children handled?",
    "What support is available if a child is struggling with the transition?",
  ];

  return (
    <div className="space-y-4">
      {/* Insight cards */}
      {insights.map((card, i) => (
        <div
          key={i}
          className={`bg-white rounded-2xl shadow-sm p-4 fade-up delay-${Math.min(i + 1, 6)} ${
            card.priority === "high"
              ? "border-l-4 border-golden"
              : ""
          }`}
        >
          <div className="flex items-start gap-2">
            <span className="text-xl">{card.emoji}</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-espresso">
                  {card.title}
                </h3>
                {card.priority === "high" && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-golden/15 text-golden font-semibold">
                    Key Factor
                  </span>
                )}
              </div>
              <p className="text-xs text-espresso/80 leading-relaxed mt-1.5">
                {card.text}
              </p>
            </div>
          </div>
        </div>
      ))}

      {/* Visit questions */}
      <div className="bg-domain-cognitive-bg/50 rounded-2xl p-4">
        <h3 className="font-[family-name:var(--font-playfair)] text-sm font-bold text-domain-cognitive-text mb-3">
          {"\u2753"} Questions to Ask on Visits
        </h3>
        <ol className="space-y-2">
          {VISIT_QUESTIONS.map((q, i) => (
            <li
              key={i}
              className="text-xs text-domain-cognitive-text/80 leading-relaxed pl-5 relative"
            >
              <span className="absolute left-0 font-semibold text-domain-cognitive-text">
                {i + 1}.
              </span>
              {q}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
