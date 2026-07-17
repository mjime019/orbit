export const dynamic = "force-dynamic";

import { getChildWithProfile, getExtracurricularProviders } from "@/lib/queries";
import { getActiveChildId } from "@/lib/active-child";
import { NoKidsState } from "@/components/ui/no-kids-state";
import { SectionHead } from "@/components/ui/section-head";
import { EmptyState } from "@/components/ui/empty-state";
import { ProviderList } from "./provider-list";

export default async function ExtrasPage() {
  const childId = await getActiveChildId();
  if (!childId) return <NoKidsState />;
  const { child, profile } = await getChildWithProfile(childId);

  if (!child) {
    return (
      <EmptyState
        emoji="⭐"
        title="We couldn't find this child"
        action={{ href: "/parent", label: "Back home" }}
      />
    );
  }

  const providers = await getExtracurricularProviders(
    child.school_id ?? undefined
  );

  return (
    <div className="fade-up">
      <SectionHead
        emoji="⭐"
        title="Extracurriculars"
        subtitle={`Curated programs for ${child.name}`}
      />
      <div className="mt-4">
        <ProviderList
          providers={providers}
          childName={child.name}
          interests={profile?.interests ?? []}
        />
      </div>
    </div>
  );
}
