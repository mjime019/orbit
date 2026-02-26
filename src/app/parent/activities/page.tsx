export const dynamic = "force-dynamic";

import {
  getChildWithProfile,
  getActivityRecommendations,
  getRecentObservations,
} from "@/lib/queries";
import { ActivityList } from "./activity-list";
import Link from "next/link";

export default async function ActivitiesPage() {
  const { child, profile, classroom } = await getChildWithProfile();

  if (!child) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center max-w-md">
          <p className="text-espresso text-lg font-semibold mb-2">
            Supabase not configured
          </p>
          <p className="text-warm-gray text-sm">
            Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in
            your .env.local file.
          </p>
        </div>
      </div>
    );
  }

  const [recommendations, observations] = await Promise.all([
    getActivityRecommendations(child.id, 10),
    getRecentObservations(child.id, 6),
  ]);

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-[640px] px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/parent"
            className="text-warm-gray hover:text-espresso transition-colors text-sm"
          >
            {"\u2190"} Back
          </Link>
        </div>

        <div className="mb-8 fade-up">
          <h1 className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-espresso mb-1">
            {"\u{1F3E0}"} Activities for {child.name}
          </h1>
          <p className="text-warm-gray text-sm">
            Personalized to {child.name}&apos;s interests and recent classroom
            observations.
          </p>
        </div>

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
