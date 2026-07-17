export const dynamic = "force-dynamic";

import Link from "next/link";
import { getChildWithProfile } from "@/lib/queries";
import { getActiveChildId } from "@/lib/active-child";
import { SectionHead } from "@/components/ui/section-head";

const PLANNERS = [
  {
    href: "/parent/activities",
    emoji: "🏠",
    title: "Activity planner",
    body: "At-home activities matched to what's lighting them up right now",
  },
  {
    href: "/parent/weekends",
    emoji: "🌳",
    title: "Weekend planner",
    body: "Places around Miami scored for your kid's fit",
  },
  {
    href: "/parent/extras",
    emoji: "⚽",
    title: "Extracurriculars",
    body: "Classes and programs, matched by readiness",
  },
  {
    href: "/parent/transition",
    emoji: "🎒",
    title: "School transition",
    body: "The road to kindergarten, one step at a time",
  },
];

export default async function PlannersPage() {
  const childId = await getActiveChildId();
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
