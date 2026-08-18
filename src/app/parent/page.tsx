export const dynamic = "force-dynamic";

import Link from "next/link";
import { getHomeKidRows } from "@/lib/queries";
import { getSessionProfile } from "@/lib/session";
import { familyFormatDate, familyGreeting } from "@/lib/tz";
import { NoKidsState } from "@/components/ui/no-kids-state";
import { KidCard } from "./kid-card";
import { PulseRefresher } from "./pulse-refresher";

const QUICK_ACTIONS = [
  {
    href: "/parent/activities",
    emoji: "🏠",
    title: "Find an activity",
    body: "At-home ideas from his file",
  },
  {
    href: "/parent/weekends",
    emoji: "🌳",
    title: "Find a place to go",
    body: "Outings that work for the whole crew",
  },
];

// Home = capture first (the one daily action), then the family at a glance,
// then doors into the planners. Depth lives on each kid's page.
export default async function ParentHomePage() {
  const { profileId, displayName } = await getSessionProfile();
  const kidRows = await getHomeKidRows(profileId);

  if (kidRows.length === 0) return <NoKidsState />;

  const kidsNeedingPulse = kidRows
    .filter((r) => !r.pulse && r.lastMoment)
    .map((r) => r.child.id);

  return (
    <div className="fade-up">
      <PulseRefresher kidIds={kidsNeedingPulse} />
      <div className="mb-4">
        <h1 className="font-[family-name:var(--font-playfair)] text-[22px] leading-tight font-semibold text-espresso">
          {familyGreeting()}, {displayName}
        </h1>
        <p className="text-sm text-warm-gray mt-0.5">
          {familyFormatDate(new Date(), {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      <Link
        href="/capture"
        className="block mb-5 py-4 bg-rust text-white rounded-2xl text-base font-semibold text-center shadow-md hover:bg-rust/90 active:scale-[0.99] transition-all"
      >
        ✏️ Capture a moment
      </Link>

      <div className="space-y-3">
        {kidRows.map((row, i) => (
          <KidCard
            key={row.child.id}
            index={i}
            id={row.child.id}
            name={row.child.name}
            dateOfBirth={row.child.date_of_birth}
            pulse={row.pulse}
            lastMoment={row.lastMoment}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-5">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="bg-white rounded-2xl p-4 shadow-sm border border-sand-dark/40 hover:shadow-md active:scale-[0.99] transition-all"
          >
            <span className="text-xl">{a.emoji}</span>
            <p className="text-sm font-semibold text-espresso mt-1.5">{a.title}</p>
            <p className="text-[11px] text-warm-gray mt-0.5 leading-relaxed">{a.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
