export const dynamic = "force-dynamic";

import {
  getChildWithProfile,
  getActivityRecommendations,
  getRecentObservations,
} from "@/lib/queries";
import { getActiveChild } from "@/lib/active-child";
import { NoKidsState } from "@/components/ui/no-kids-state";
import { SectionHead } from "@/components/ui/section-head";
import { EmptyState } from "@/components/ui/empty-state";
import { KidScopePills } from "@/components/shell/kid-scope-pills";
import { ActivityList } from "./activity-list";

export default async function ActivitiesPage() {
  const { children: kids, activeChildId: childId } = await getActiveChild();
  if (!childId) return <NoKidsState />;
  const { child, profile, classroom } = await getChildWithProfile(childId);

  if (!child) {
    return (
      <EmptyState
        emoji="🏠"
        title="We couldn't find this child"
        action={{ href: "/parent", label: "Back home" }}
      />
    );
  }

  const [recommendations, observations] = await Promise.all([
    getActivityRecommendations(child.id, 10),
    getRecentObservations(child.id, 6),
  ]);

  return (
    <div className="fade-up">
      <KidScopePills kids={kids} activeChildId={child.id} />
      <SectionHead
        emoji="🏠"
        title={`Activities for ${child.name}`}
        subtitle="Personalized to their interests and recent observations"
      />
      <div className="mt-4">
        <ActivityList
          childId={child.id}
          childName={child.name}
          recommendations={recommendations}
          observations={observations}
          classroomTheme={classroom?.lesson_theme ?? ""}
          interests={profile?.interests ?? []}
        />
      </div>
    </div>
  );
}
