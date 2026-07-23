export const dynamic = "force-dynamic";

import { getActiveChild } from "@/lib/active-child";
import { NoKidsState } from "@/components/ui/no-kids-state";
import { SectionHead } from "@/components/ui/section-head";
import { IdeaCards } from "@/components/planner/idea-cards";

// Family-wide: one plan that works for every kid at once, from all their
// files. No per-kid switcher here on purpose.
export default async function WeekendsPage() {
  const { children: kids } = await getActiveChild();
  if (kids.length === 0) return <NoKidsState />;

  const names = kids.map((k) => k.name);
  const crew =
    names.length > 1
      ? `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`
      : names[0];

  return (
    <div className="fade-up">
      <SectionHead
        emoji="🌊"
        title="Weekend planner"
        subtitle={`One plan for the whole crew — ${crew}`}
      />
      <div className="mt-4">
        <IdeaCards kind="weekend" />
      </div>
    </div>
  );
}
