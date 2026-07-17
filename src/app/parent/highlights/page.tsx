export const dynamic = "force-dynamic";

import { getChildWithProfile, getAllSentHighlights } from "@/lib/queries";
import { getActiveChildId } from "@/lib/active-child";
import { SectionHead } from "@/components/ui/section-head";
import { EmptyState } from "@/components/ui/empty-state";
import { HighlightFeed } from "./highlight-feed";

export default async function HighlightsPage() {
  const childId = await getActiveChildId();
  const { child } = await getChildWithProfile(childId);

  if (!child) {
    return (
      <EmptyState
        emoji="✨"
        title="We couldn't find this child"
        action={{ href: "/parent", label: "Back home" }}
      />
    );
  }

  const highlights = await getAllSentHighlights(child.id);

  return (
    <div className="fade-up">
      <SectionHead
        emoji="✨"
        title="Highlights"
        subtitle={`${child.name}'s moments, from their teachers`}
      />
      <div className="mt-4">
        <HighlightFeed highlights={highlights} childName={child.name} />
      </div>
    </div>
  );
}
