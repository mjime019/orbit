export const dynamic = "force-dynamic";

import { getChildWithProfile, getAllJourneyChapters } from "@/lib/queries";
import { getActiveChildId } from "@/lib/active-child";
import { NoKidsState } from "@/components/ui/no-kids-state";
import { GrowthTimeline } from "@/components/growth/growth-timeline";
import { SectionHead } from "@/components/ui/section-head";
import { EmptyState } from "@/components/ui/empty-state";

// Parent-facing growth journey — parents never enter /teacher for this.
export default async function ParentGrowthPage() {
  const childId = await getActiveChildId();
  if (!childId) return <NoKidsState />;
  const [{ child }, chapters] = await Promise.all([
    getChildWithProfile(childId),
    getAllJourneyChapters(childId),
  ]);

  const childName = child?.name ?? "your child";

  return (
    <div className="fade-up">
      <SectionHead
        emoji="🌱"
        title={`${childName}'s Journey`}
        subtitle="Chapters of growth, written from real moments"
      />
      <div className="mt-4">
        {chapters.length === 0 ? (
          <EmptyState
            emoji="📖"
            title="The first chapter is still being written"
            body={`As observations build up, ${childName}'s story takes shape here.`}
            action={{ href: "/capture", label: "Capture a moment" }}
          />
        ) : (
          <GrowthTimeline chapters={chapters} childName={childName} />
        )}
      </div>
    </div>
  );
}
