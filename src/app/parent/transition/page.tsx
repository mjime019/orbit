export const dynamic = "force-dynamic";

import {
  getChildWithProfile,
  getTransitionSchools,
  getRecentObservations,
} from "@/lib/queries";
import { getActiveChildId } from "@/lib/active-child";
import { NoKidsState } from "@/components/ui/no-kids-state";
import { SectionHead } from "@/components/ui/section-head";
import { EmptyState } from "@/components/ui/empty-state";
import { TransitionNavigator } from "./transition-navigator";

export default async function TransitionPage() {
  const childId = await getActiveChildId();
  if (!childId) return <NoKidsState />;
  const { child, profile } = await getChildWithProfile(childId);

  if (!child) {
    return (
      <EmptyState
        emoji="🧭"
        title="We couldn't find this child"
        action={{ href: "/parent", label: "Back home" }}
      />
    );
  }

  const [schools, observations] = await Promise.all([
    getTransitionSchools(child.id),
    getRecentObservations(child.id, 10),
  ]);

  return (
    <div className="fade-up">
      <SectionHead
        emoji="🧭"
        title="School Transition"
        subtitle={`Kindergarten navigator for ${child.name}`}
      />
      <div className="mt-4">
        <TransitionNavigator
          schools={schools}
          childName={child.name}
          interests={profile?.interests ?? []}
          parentGoals={profile?.parent_goals ?? []}
          playStyle={profile?.play_style ?? null}
          observations={observations}
        />
      </div>
    </div>
  );
}
