export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  getChildWithProfile,
  getAllWeekendPlaces,
  getWeekendRecommendations,
} from "@/lib/queries";
import { WeekendList } from "./weekend-list";

export default async function WeekendsPage() {
  const { child, profile } = await getChildWithProfile();

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

  const [places, recommendations] = await Promise.all([
    getAllWeekendPlaces(),
    getWeekendRecommendations(child.id, 10),
  ]);

  // Build a map of place_id -> recommendation for quick lookup
  const recMap = new Map(
    recommendations.map((r) => [r.place_id, r])
  );

  // Merge recommendations onto places
  const placesWithRecs = places.map((place) => ({
    ...place,
    recommendation: recMap.get(place.id) ?? null,
  }));

  // Sort: recommended places first (by fit_score desc), then others
  placesWithRecs.sort((a, b) => {
    const aScore = a.recommendation?.fit_score ?? -1;
    const bScore = b.recommendation?.fit_score ?? -1;
    return bScore - aScore;
  });

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-[640px] px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/parent"
            className="text-warm-gray hover:text-espresso transition-colors text-lg"
          >
            {"\u2190"}
          </Link>
          <div>
            <h1 className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-espresso">
              {"\u{1F30A}"} Weekend Picks
            </h1>
            <p className="text-warm-gray text-sm mt-0.5">
              Places perfect for {child.name} this weekend
            </p>
          </div>
        </div>

        <WeekendList
          places={placesWithRecs}
          childName={child.name}
          interests={profile?.interests ?? []}
        />
      </div>
    </div>
  );
}
