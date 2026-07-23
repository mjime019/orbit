export const dynamic = "force-dynamic";

import {
  getChildWithProfile,
  getOrCreateConversation,
  getConversationMessages,
} from "@/lib/queries";
import { getActiveChild } from "@/lib/active-child";
import { getSessionProfile } from "@/lib/session";
import { NoKidsState } from "@/components/ui/no-kids-state";
import { KidScopePills } from "@/components/shell/kid-scope-pills";
import { ConciergeChat } from "./concierge-chat";

export default async function ChatPage() {
  const { children: kids, activeChildId } = await getActiveChild();
  if (!activeChildId) return <NoKidsState />;
  const { child, profile } = await getChildWithProfile(activeChildId);

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

  const { profileId } = await getSessionProfile();
  const conversation = await getOrCreateConversation(child.id, profileId);
  const messages = conversation
    ? await getConversationMessages(conversation.id, 30)
    : [];

  return (
    <div>
      <KidScopePills kids={kids} activeChildId={child.id} />
      <ConciergeChat
        childId={child.id}
        childName={child.name}
        conversationId={conversation?.id ?? ""}
        initialMessages={messages}
        interests={profile?.interests ?? []}
      />
    </div>
  );
}
