export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  getChildWithProfile,
  getRecentHighlights,
  getRecentObservations,
  getChildSummary,
} from "@/lib/queries";
import { getActiveChild } from "@/lib/active-child";
import { NoKidsState } from "@/components/ui/no-kids-state";
import { DomainPill } from "@/components/ui/domain-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { SummaryCard } from "./summary-card";

const MODULE_CARDS = [
  { href: "/parent/understand", emoji: "🌱", title: "Understand your kid" },
  { href: "/parent/highlights", emoji: "✨", title: "Highlights" },
  { href: "/parent/activities", emoji: "🏠", title: "Activity planner" },
  { href: "/parent/weekends", emoji: "🌳", title: "Weekend planner" },
  { href: "/parent/extras", emoji: "⚽", title: "Extracurriculars" },
  { href: "/parent/transition", emoji: "🎒", title: "School transition" },
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

interface FeedItem {
  kind: "highlight" | "observation";
  createdAt: string;
  title?: string;
  text: string;
  domains: string[];
  source: "school" | "parent";
  author?: string;
}

export default async function ParentHomePage() {
  const { activeChildId, activeChild } = await getActiveChild();
  if (!activeChildId) return <NoKidsState />;
  const [{ child, profile }, highlights, observations, summaryRow] =
    await Promise.all([
      getChildWithProfile(activeChildId),
      getRecentHighlights(activeChildId, 5),
      getRecentObservations(activeChildId, 10),
      getChildSummary(activeChildId),
    ]);

  const childName = activeChild?.name ?? child?.name ?? "your child";

  const feed: FeedItem[] = [
    ...highlights.map(
      (h: {
        created_at: string;
        title: string;
        content: string;
        domains: string[] | null;
      }) => ({
        kind: "highlight" as const,
        createdAt: h.created_at,
        title: h.title,
        text: h.content,
        domains: h.domains ?? [],
        source: "school" as const,
      })
    ),
    ...observations.map(
      (o: {
        created_at: string;
        note: string;
        domains: string[] | null;
        source?: string;
        profiles?: { name: string } | null;
      }) => ({
        kind: "observation" as const,
        createdAt: o.created_at,
        text: o.note,
        domains: o.domains ?? [],
        source: o.source === "parent" ? ("parent" as const) : ("school" as const),
        author: o.profiles?.name,
      })
    ),
  ]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 8);

  return (
    <div className="fade-up">
      {/* Hero */}
      <div className="mb-5">
        <h1 className="font-[family-name:var(--font-playfair)] text-[26px] leading-tight font-semibold text-espresso">
          {greeting()} — here&apos;s {childName}&apos;s world
        </h1>
        <p className="text-sm text-warm-gray mt-1">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* What this means */}
      <div className="mb-5">
        <SummaryCard
          childId={activeChildId}
          childName={childName}
          initialContent={summaryRow?.content ?? null}
          hasObservations={observations.length > 0}
        />
      </div>

      {/* Story feed */}
      {feed.length === 0 ? (
        <div className="mb-6">
          <EmptyState
            emoji="🌟"
            title={`${childName}'s story starts here`}
            body="Capture a moment — a weekend adventure, something they said, a small win — and Orbit starts weaving it together."
            action={{ href: "/capture", label: "Capture the first moment" }}
          />
        </div>
      ) : (
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-warm-gray mb-3">
            Recent moments
          </p>
          <div className="space-y-3">
            {feed.map((item, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-4 shadow-sm border border-sand-dark/40"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      item.source === "parent"
                        ? "bg-lavender/40 text-espresso"
                        : "bg-sky/10 text-sky"
                    }`}
                  >
                    {item.source === "parent" ? "You noticed" : "From school"}
                  </span>
                  <span className="text-[11px] text-warm-gray">
                    {shortDate(item.createdAt)}
                  </span>
                </div>
                {item.title && (
                  <p className="text-sm font-semibold text-espresso mb-1">
                    ✨ {item.title}
                  </p>
                )}
                <p className="text-sm text-espresso/90 leading-relaxed">
                  {item.text}
                </p>
                {(item.domains.length > 0 || item.author) && (
                  <div className="flex items-center justify-between mt-2.5">
                    <div className="flex flex-wrap gap-1">
                      {item.domains.slice(0, 3).map((d) => (
                        <DomainPill key={d} domain={d} />
                      ))}
                    </div>
                    {item.author && (
                      <span className="text-[11px] text-warm-gray">
                        {item.author}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modules */}
      <p className="text-xs font-bold uppercase tracking-wider text-warm-gray mb-3">
        Explore
      </p>
      <div className="grid grid-cols-2 gap-3">
        {MODULE_CARDS.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="bg-white rounded-2xl p-4 shadow-sm border border-sand-dark/40 hover:shadow-md transition-shadow flex items-center gap-3"
          >
            <span className="text-xl">{m.emoji}</span>
            <span className="text-[13px] font-semibold text-espresso leading-snug">
              {m.title}
            </span>
          </Link>
        ))}
      </div>

      {/* Refine profile nudge */}
      {profile && !profile.interests?.length && (
        <div className="mt-5">
          <Link
            href="/parent/onboarding"
            className="block text-center text-xs text-warm-gray underline underline-offset-2"
          >
            Tell Orbit more about {childName} →
          </Link>
        </div>
      )}
    </div>
  );
}
