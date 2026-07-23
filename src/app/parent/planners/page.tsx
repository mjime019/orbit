export const dynamic = "force-dynamic";

import Link from "next/link";
import { getChildWithProfile } from "@/lib/queries";
import { getActiveChildId } from "@/lib/active-child";
import { NoKidsState } from "@/components/ui/no-kids-state";
import { SectionHead } from "@/components/ui/section-head";

const PLANNERS = [
  {
    href: "/parent/activities",
    emoji: "🏠",
    title: "Activity planner",
    body: "At-home ideas generated from his file — interests, growing edges, energy",
  },
  {
    href: "/parent/weekends",
    emoji: "🌳",
    title: "Weekend planner",
    body: "Miami outings that work for all three boys at once",
  },
  {
    href: "/parent/extras",
    emoji: "⚽",
    title: "Extracurriculars",
    body: "What he's ready for — categories, readiness signs, questions to ask",
  },
  {
    href: "/parent/transition",
    emoji: "🎒",
    title: "School transition",
    body: "Parked · kindergarten timeline checklist only",
  },
];

export default async function PlannersPage() {
  const childId = await getActiveChildId();
  if (!childId) return <NoKidsState />;
  const { child } = await getChildWithProfile(childId);

  return (
    <div className="fade-up">
      <SectionHead
        emoji="🗺️"
        title="Planners"
        subtitle={child?.name ? `Built around ${child.name}` : undefined}
      />
      <div className="grid gap-3 mt-4">
        {PLANNERS.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="bg-white rounded-2xl p-5 shadow-sm border border-sand-dark/40 hover:shadow-md transition-shadow flex items-start gap-4"
          >
            <span className="text-2xl mt-0.5">{p.emoji}</span>
            <span>
              <span className="block text-sm font-semibold text-espresso">
                {p.title}
              </span>
              <span className="block text-xs text-warm-gray mt-1 leading-relaxed">
                {p.body}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
