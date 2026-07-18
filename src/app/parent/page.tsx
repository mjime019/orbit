export const dynamic = "force-dynamic";

import Link from "next/link";
import { getHomeKidRows } from "@/lib/queries";
import { getSessionProfile } from "@/lib/session";
import { NoKidsState } from "@/components/ui/no-kids-state";
import { KidCard } from "./kid-card";
import { PulseRefresher } from "./pulse-refresher";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// Home = the whole family at a glance: one card per kid, one fresh sentence
// each, capture front and center. Depth lives on each kid's page.
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
      <div className="mb-5">
        <h1 className="font-[family-name:var(--font-playfair)] text-[24px] leading-tight font-semibold text-espresso">
          {greeting()}, {displayName}
        </h1>
        <p className="text-sm text-warm-gray mt-0.5">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

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

      <div className="mt-6 flex justify-center">
        <Link
          href="/capture"
          className="px-6 py-3 bg-rust text-white rounded-full text-sm font-medium shadow-md hover:bg-rust/90 active:scale-95 transition-all"
        >
          🎤 Capture a moment
        </Link>
      </div>
    </div>
  );
}
