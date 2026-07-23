export const dynamic = "force-dynamic";

import { getChildWithProfile } from "@/lib/queries";
import { getActiveChild } from "@/lib/active-child";
import { NoKidsState } from "@/components/ui/no-kids-state";
import { SectionHead } from "@/components/ui/section-head";
import { EmptyState } from "@/components/ui/empty-state";
import { KidScopePills } from "@/components/shell/kid-scope-pills";
import { TransitionNavigator } from "./transition-navigator";

// Parked module: only the kindergarten timeline checklist is live — see
// TransitionNavigator for what was cut and why.
export default async function TransitionPage() {
  const { children: kids, activeChildId: childId } = await getActiveChild();
  if (!childId) return <NoKidsState />;
  const { child } = await getChildWithProfile(childId);

  if (!child) {
    return (
      <EmptyState
        emoji="🧭"
        title="We couldn't find this child"
        action={{ href: "/parent", label: "Back home" }}
      />
    );
  }

  return (
    <div className="fade-up">
      <KidScopePills kids={kids} activeChildId={child.id} />
      <SectionHead
        emoji="🧭"
        title="School Transition"
        subtitle="The kindergarten timeline — the rest is parked for now"
      />
      <div className="mt-4">
        <TransitionNavigator childName={child.name} />
      </div>
    </div>
  );
}
