export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  getChildWithProfile,
  getTransitionSchools,
  getRecentObservations,
} from "@/lib/queries";
import { TransitionNavigator } from "./transition-navigator";

export default async function TransitionPage() {
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

  const [schools, observations] = await Promise.all([
    getTransitionSchools(child.id),
    getRecentObservations(child.id, 10),
  ]);

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
              {"\u{1F9ED}"} School Transition
            </h1>
            <p className="text-warm-gray text-sm mt-0.5">
              Kindergarten navigator for {child.name}
            </p>
          </div>
        </div>

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
