export const dynamic = "force-dynamic";

import { getChildWithProfile } from "@/lib/queries";
import { OnboardingFlow } from "./onboarding-flow";

export default async function OnboardingPage() {
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

  return (
    <OnboardingFlow
      childId={child.id}
      childName={child.name}
      alreadyComplete={profile?.onboarding_complete ?? false}
      existingProfile={profile}
    />
  );
}
