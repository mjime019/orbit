import { NextRequest, NextResponse } from "next/server";
import { callAI, AIUnavailableError } from "@/lib/ai";
import { buildConciergePrompt } from "@/lib/prompts";
import { createServerSupabase } from "@/lib/supabase-server";
import {
  getChildContext,
  getRecentObservations,
  getSchoolKnowledge,
  getConversationMessages,
} from "@/lib/queries";
import { getSessionProfile } from "@/lib/session";

export async function POST(request: NextRequest) {
  const { conversationId, childId, message } = await request.json();

  if (!conversationId || !childId || !message) {
    return NextResponse.json(
      { error: "Missing conversationId, childId, or message" },
      { status: 400 }
    );
  }

  const sb = await createServerSupabase();

  // 1. Insert user message
  const { error: insertError } = await sb.from("messages").insert({
    conversation_id: conversationId,
    role: "parent",
    content: message,
  });

  if (insertError) {
    console.error("[Chat] Insert user message error:", insertError);
    return NextResponse.json(
      { error: "Failed to save message" },
      { status: 500 }
    );
  }

  // 2. Fetch all context in parallel
  const [context, observations, schoolKnowledge, history] = await Promise.all([
    getChildContext(childId),
    getRecentObservations(childId, 15),
    getSchoolKnowledge(),
    getConversationMessages(conversationId, 20),
  ]);

  // 3. The logged-in parent
  const sessionProfile = await getSessionProfile();

  // 4. Build child profile summary
  const profileSummary = [
    `Name: ${context.childName}, Age: ${context.childAge}`,
    `Classroom: ${context.classroomName}`,
    context.classroomTheme
      ? `Current theme: ${context.classroomTheme}`
      : null,
    context.interests.length > 0
      ? `Interests: ${context.interests.join(", ")}`
      : null,
    context.parentGoals.length > 0
      ? `Parent goals: ${context.parentGoals.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  // 5. Build observations summary
  const obsSummary = observations
    .slice(0, 10)
    .map(
      (o) =>
        `[${new Date(o.created_at).toLocaleDateString()}] ${o.note}${
          o.social_tag ? ` (${o.social_tag})` : ""
        }`
    )
    .join("\n");

  // 6. Build conversation history (exclude the message we just inserted —
  // it is passed separately as the user turn)
  const priorHistory = history.filter(
    (m, i) =>
      !(i === history.length - 1 && m.role === "parent" && m.content === message)
  );
  const conversationHistory = priorHistory
    .slice(-18)
    .map((m) => `${m.role === "parent" ? "Parent" : "Orbit"}: ${m.content}`)
    .join("\n\n");

  // 7. Build prompt and call AI
  const systemPrompt = buildConciergePrompt({
    parentName: sessionProfile.displayName,
    childName: context.childName,
    childAge: context.childAge,
    childProfile: profileSummary,
    recentObservations: obsSummary || "No recent observations.",
    schoolKnowledge: schoolKnowledge,
    conversationHistory: conversationHistory || "No previous messages.",
  });

  let aiResponse: string;
  try {
    ({ text: aiResponse } = await callAI(systemPrompt, message));
    // Strip any wrapping quotes
    aiResponse = aiResponse.replace(/^["']|["']$/g, "").trim();
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "AI service unavailable";
    const status = err instanceof AIUnavailableError ? err.status : 502;
    return NextResponse.json({ error: errMsg }, { status });
  }

  // 8. Insert AI response
  const { data: aiMessage, error: aiInsertError } = await sb
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role: "assistant",
      content: aiResponse,
    })
    .select("*")
    .single();

  if (aiInsertError) {
    console.error("[Chat] Insert AI message error:", aiInsertError);
    return NextResponse.json(
      { error: "Failed to save AI response" },
      { status: 500 }
    );
  }

  // 9. Update conversation timestamp
  await sb
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return NextResponse.json(aiMessage);
}
