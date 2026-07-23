export const dynamic = "force-dynamic";

import { getChildWithProfile } from "@/lib/queries";
import { getActiveChild } from "@/lib/active-child";
import { NoKidsState } from "@/components/ui/no-kids-state";
import { SectionHead } from "@/components/ui/section-head";
import { EmptyState } from "@/components/ui/empty-state";
import { KidScopePills } from "@/components/shell/kid-scope-pills";
import { IdeaCards } from "@/components/planner/idea-cards";

export default async function ExtrasPage() {
  const { children: kids, activeChildId: childId } = await getActiveChild();
  if (!childId) return <NoKidsState />;
  const { child } = await getChildWithProfile(childId);

  if (!child) {
    return (
      <EmptyState
        emoji="⭐"
        title="We couldn't find this child"
        action={{ href: "/parent", label: "Back home" }}
      />
    );
  }

  return (
    <div className="fade-up">
      <KidScopePills kids={kids} activeChildId={child.id} />
      <SectionHead
        emoji="⭐"
        title={`Extracurriculars for ${child.name}`}
        subtitle="What he's ready for — categories, not sales pitches"
      />
      <div className="mt-4">
        <IdeaCards
          kind="extracurricular"
          childId={child.id}
          childName={child.name}
        />
      </div>
    </div>
  );
}
