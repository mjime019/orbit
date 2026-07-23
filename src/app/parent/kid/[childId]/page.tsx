export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getChildWithProfile,
  getParentChildren,
  getRecentHighlights,
  getRecentObservations,
  getChildSummary,
  getAllJourneyChapters,
  getLatestJourneyChapter,
  countObservationsSince,
} from "@/lib/queries";
import { getSessionProfile } from "@/lib/session";
import { formatAge } from "@/lib/age";
import { familyFormatDate } from "@/lib/tz";
import { DomainPill } from "@/components/ui/domain-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { GrowthTimeline } from "@/components/growth/growth-timeline";
import { ProfileSections } from "@/components/kid/profile-sections";
import { BasicsCard } from "@/components/kid/basics-card";
import { ActivitiesTab } from "@/components/kid/activities-tab";
import { ReportsTab } from "@/components/kid/reports-tab";
import { GenerateChapterButton } from "@/components/kid/generate-chapter-button";
import { SummaryCard } from "../../summary-card";

type Tab = "story" | "journey" | "activities" | "reports" | "about";
const TABS: { key: Tab; label: string; emoji: string }[] = [
  { key: "story", label: "Story", emoji: "🌟" },
  { key: "journey", label: "Journey", emoji: "🌱" },
  { key: "activities", label: "Activities", emoji: "⚽" },
  { key: "reports", label: "Reports", emoji: "📄" },
  { key: "about", label: "About", emoji: "💛" },
];

// What each tab IS — one line, so the names carry meaning.
const TAB_EXPLAINERS: Record<Tab, string> = {
  story: "The living feed — every moment you or school captures, plus what it means.",
  journey:
    "Every stretch of life becomes a chapter — written by Orbit from the moments you capture.",
  activities:
    "What he's actually doing — it becomes part of his file and his chapters.",
  reports: "School's paper trail, read and remembered by Orbit.",
  about: "His file — everything Orbit knows, and where you correct it.",
};

function shortDate(iso: string): string {
  return familyFormatDate(iso, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

interface FeedItem {
  createdAt: string;
  title?: string;
  text: string;
  domains: string[];
  source: "school" | "parent";
  author?: string;
}

export default async function KidPage({
  params,
  searchParams,
}: {
  params: Promise<{ childId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { childId } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: Tab = (TABS.find((t) => t.key === rawTab)?.key ?? "story") as Tab;

  // Only the session parent's own kids are reachable here.
  const { profileId } = await getSessionProfile();
  const kids = await getParentChildren(profileId);
  if (!kids.some((k) => k.id === childId)) notFound();

  const { child, profile } = await getChildWithProfile(childId);
  if (!child) notFound();

  return (
    <div className="fade-up">
      {/* Hero */}
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/parent"
          className="w-9 h-9 rounded-full border border-sand-dark/60 bg-white text-sm flex items-center justify-center text-warm-gray hover:text-espresso transition-colors shrink-0"
        >
          ←
        </Link>
        <div className="flex-1">
          <h1 className="font-[family-name:var(--font-playfair)] text-xl font-semibold text-espresso leading-tight">
            {child.name}
          </h1>
          <p className="text-xs text-warm-gray">{formatAge(child.date_of_birth)} old</p>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 mb-5 overflow-x-auto orbit-scroll -mx-1 px-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/parent/kid/${childId}?tab=${t.key}`}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              tab === t.key
                ? "bg-espresso text-white"
                : "bg-white text-warm-gray border border-sand-dark/50 hover:text-espresso"
            }`}
          >
            {t.emoji} {t.label}
          </Link>
        ))}
      </div>
      <p className="text-[11px] text-warm-gray -mt-3 mb-4 px-1">
        {TAB_EXPLAINERS[tab]}
      </p>

      {tab === "story" && (
        <>
          {!profile?.onboarding_complete && (
            <Link
              href={`/parent/onboarding?child=${childId}`}
              className="block mb-4 bg-lavender/25 border border-lavender/50 rounded-2xl px-4 py-3 text-[13px] text-espresso hover:bg-lavender/35 transition-colors"
            >
              🌱 <span className="font-semibold">Seed {child.name}&apos;s file</span> — a few
              questions tuned to his age make everything smarter.
            </Link>
          )}
          <StoryTab childId={childId} childName={child.name} />
        </>
      )}
      {tab === "journey" && <JourneyTab childId={childId} childName={child.name} />}
      {tab === "activities" && (
        <ActivitiesTab childId={childId} childName={child.name} />
      )}
      {tab === "reports" && (
        <ReportsTab childId={childId} childName={child.name} />
      )}
      {tab === "about" && (
        <div>
          <div className="flex justify-end mb-3">
            <Link
              href={`/parent/onboarding?child=${childId}`}
              className="text-[11px] font-medium text-rust underline underline-offset-2"
            >
              Seed {child.name}&apos;s file →
            </Link>
          </div>
          <BasicsCard
            childId={childId}
            initialName={child.name}
            initialDob={child.date_of_birth ?? null}
          />
          <ProfileSections profile={profile} />
        </div>
      )}
    </div>
  );
}

async function StoryTab({
  childId,
  childName,
}: {
  childId: string;
  childName: string;
}) {
  const [highlights, observations, summaryRow] = await Promise.all([
    getRecentHighlights(childId, 5),
    getRecentObservations(childId, 12),
    getChildSummary(childId),
  ]);

  const feed: FeedItem[] = [
    ...highlights.map(
      (h: { created_at: string; title: string; content: string; domains: string[] | null }) => ({
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
        createdAt: o.created_at,
        text: o.note,
        domains: o.domains ?? [],
        source: o.source === "parent" ? ("parent" as const) : ("school" as const),
        author: o.profiles?.name,
      })
    ),
  ]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 12);

  return (
    <div>
      <div className="mb-5">
        <SummaryCard
          childId={childId}
          childName={childName}
          initialContent={summaryRow?.content ?? null}
          hasObservations={observations.length > 0}
        />
      </div>

      {feed.length === 0 ? (
        <EmptyState
          emoji="🌟"
          title={`${childName}'s story starts here`}
          body="Capture a moment — something they said, a small win, a hard afternoon."
          action={{ href: "/capture", label: "Capture the first moment" }}
        />
      ) : (
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
              <p className="text-sm text-espresso/90 leading-relaxed">{item.text}</p>
              {(item.domains.length > 0 || item.author) && (
                <div className="flex items-center justify-between mt-2.5">
                  <div className="flex flex-wrap gap-1">
                    {item.domains.slice(0, 3).map((d) => (
                      <DomainPill key={d} domain={d} />
                    ))}
                  </div>
                  {item.author && (
                    <span className="text-[11px] text-warm-gray">{item.author}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

async function JourneyTab({
  childId,
  childName,
}: {
  childId: string;
  childName: string;
}) {
  const [chapters, latest] = await Promise.all([
    getAllJourneyChapters(childId),
    getLatestJourneyChapter(childId),
  ]);
  const newMomentCount = await countObservationsSince(
    childId,
    latest?.created_at ?? null
  );

  return (
    <div>
      <GenerateChapterButton
        childId={childId}
        childName={childName}
        newMomentCount={newMomentCount}
      />
      {chapters.length === 0 ? (
        <EmptyState
          emoji="📖"
          title="The first chapter is still being written"
          body={`Capture a few moments, then tap the button above — Orbit writes ${childName}'s chapter from what you saw.`}
          action={{ href: "/capture", label: "Capture a moment" }}
        />
      ) : (
        <GrowthTimeline chapters={chapters} childName={childName} />
      )}
    </div>
  );
}
