"use client";

import { useState, useEffect } from "react";

type Tab = "timeline" | "parked";

const TABS: { key: Tab; label: string; emoji: string }[] = [
  { key: "timeline", label: "Timeline", emoji: "\u{1F4C5}" },
  { key: "parked", label: "The rest", emoji: "\u{1F6A7}" },
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
    emoji: "✅",
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
    emoji: "\u{1F570}️",
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

// Parked module (Round 3): the old Compare/Readiness/Insights tabs rendered
// demo-school content that had nothing to do with this family, so they're
// gone until there's a real engine. The kindergarten timeline checklist is
// genuinely useful and stays.
export function TransitionNavigator({ childName }: { childName: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("timeline");
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

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

      {activeTab === "timeline" && (
        <TimelineTab checkedItems={checkedItems} onToggleCheck={toggleCheck} />
      )}
      {activeTab === "parked" && (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <p className="text-3xl mb-3">🚧</p>
          <p className="text-sm font-semibold text-espresso mb-2">
            Not built for your family yet
          </p>
          <p className="text-xs text-warm-gray leading-relaxed max-w-[320px] mx-auto">
            School comparisons, readiness signals, and transition insights are
            parked — the old versions showed demo content that had nothing to
            do with {childName}. When it&apos;s time to pick a school for real,
            this is where it&apos;ll live.
          </p>
        </div>
      )}
    </div>
  );
}

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
