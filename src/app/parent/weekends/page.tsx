export const dynamic = "force-dynamic";

import {
  getChildWithProfile,
  getAllWeekendPlaces,
  getWeekendRecommendations,
} from "@/lib/queries";
import { getActiveChild } from "@/lib/active-child";
import { NoKidsState } from "@/components/ui/no-kids-state";
import { SectionHead } from "@/components/ui/section-head";
import { EmptyState } from "@/components/ui/empty-state";
import { KidScopePills } from "@/components/shell/kid-scope-pills";
import { WeekendList } from "./weekend-list";

export default async function WeekendsPage() {
  const { children: kids, activeChildId: childId } = await getActiveChild();
  if (!childId) return <NoKidsState />;
  const { child, profile } = await getChildWithProfile(childId);

  if (!child) {
    return (
      <EmptyState
        emoji="🌊"
        title="We couldn't find this child"
        action={{ href: "/parent", label: "Back home" }}
      />
    );
  }

  const [places, recommendations] = await Promise.all([
    getAllWeekendPlaces(),
    getWeekendRecommendations(child.id, 10),
  ]);

  // Build a map of place_id -> recommendation for quick lookup
  const recMap = new Map(recommendations.map((r) => [r.place_id, r]));

  // Merge recommendations onto places; recommended first by fit score
  const placesWithRecs = places.map((place) => ({
    ...place,
    recommendation: recMap.get(place.id) ?? null,
  }));
  placesWithRecs.sort((a, b) => {
    const aScore = a.recommendation?.fit_score ?? -1;
    const bScore = b.recommendation?.fit_score ?? -1;
    return bScore - aScore;
  });

  return (
    <div className="fade-up">
      <KidScopePills kids={kids} activeChildId={child.id} />
      <SectionHead
        emoji="🌊"
        title="Weekend Picks"
        subtitle={`Places perfect for ${child.name} this weekend`}
      />
      <div className="mt-4">
        <WeekendList
          places={placesWithRecs}
          childName={child.name}
          interests={profile?.interests ?? []}
        />
      </div>
    </div>
  );
}
