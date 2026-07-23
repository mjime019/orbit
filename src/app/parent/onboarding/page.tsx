export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getChildWithProfile, getParentChildren } from "@/lib/queries";
import { getSessionProfile } from "@/lib/session";
import { OnboardingFlow } from "./onboarding-flow";

// "Seed the file" — always for an explicit child (?child=<id>), validated
// against the session parent's own kids. ?mode=refresh runs the short
// "what's changed" pass instead of the full seed.
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string; mode?: string }>;
}) {
  const { child: childParam, mode } = await searchParams;
  const { profileId } = await getSessionProfile();
  const kids = await getParentChildren(profileId);

  const target = kids.find((k) => k.id === childParam);
  if (!target) redirect("/parent");

  const { child, profile } = await getChildWithProfile(target.id);
  if (!child) redirect("/parent");

  return (
    <OnboardingFlow
      childId={child.id}
      childName={child.name}
      dateOfBirth={child.date_of_birth}
      alreadyComplete={profile?.onboarding_complete ?? false}
      mode={mode === "refresh" ? "refresh" : "seed"}
    />
  );
}
