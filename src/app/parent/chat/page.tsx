export const dynamic = "force-dynamic";

import {
  getChildWithProfile,
  getOrCreateConversation,
  getConversationMessages,
  DEMO_PARENT_ID,
} from "@/lib/queries";
import { getActiveChildId } from "@/lib/active-child";
import { ConciergeChat } from "./concierge-chat";

export default async function ChatPage() {
  const activeChildId = await getActiveChildId();
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

  const conversation = await getOrCreateConversation(
    child.id,
    DEMO_PARENT_ID
  );
  const messages = conversation
    ? await getConversationMessages(conversation.id, 30)
    : [];

  return (
    <ConciergeChat
      childId={child.id}
      childName={child.name}
      conversationId={conversation?.id ?? ""}
      initialMessages={messages}
      interests={profile?.interests ?? []}
    />
  );
}
