export const dynamic = "force-dynamic";

import { getSessionProfile } from "@/lib/session";
import { SectionHead } from "@/components/ui/section-head";
import { InboxReview } from "@/components/inbox/inbox-review";
import { CaptureAnywhere } from "@/components/inbox/capture-anywhere";

// The inbox: words that arrived without a review — Siri shortcut, email
// reply, in-app "save for later" — waiting for a parent's OK. Nothing here
// is an observation yet.
export default async function InboxPage() {
  const { profileId } = await getSessionProfile();
  return (
    <div className="fade-up">
      <SectionHead
        emoji="📥"
        title="Inbox"
        subtitle="Moments you jotted from anywhere — give each a quick OK"
      />
      <InboxReview reviewerProfileId={profileId} />
      <div id="anywhere" className="mt-10">
        <SectionHead
          emoji="🎙️"
          title="Capture from anywhere"
          subtitle="Siri, a shortcut, or just reply to the email"
        />
        <CaptureAnywhere />
      </div>
    </div>
  );
}
