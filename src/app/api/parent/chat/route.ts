import { NextRequest, NextResponse } from "next/server";
import { callAI, AIUnavailableError } from "@/lib/ai";
import { buildFamilyChatPrompt } from "@/lib/prompts";
import { createServerSupabase } from "@/lib/supabase-server";
import {
  getRecentObservations,
  getConversationMessages,
  getLatestJourneyChapter,
} from "@/lib/queries";
import { buildFileContext } from "@/lib/file-context";
import { getSessionProfile } from "@/lib/session";
import { familyFormatDate } from "@/lib/tz";

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

  // 2. Fetch all context in parallel: the kid's file, recent moments,
  // his latest chapter, and the conversation so far.
  const [{ data: child }, fileContext, observations, latestChapter, history, sessionProfile] =
    await Promise.all([
      sb.from("children").select("name").eq("id", childId).maybeSingle(),
      buildFileContext(childId),
      getRecentObservations(childId, 15),
      getLatestJourneyChapter(childId),
      getConversationMessages(conversationId, 20),
      getSessionProfile(),
    ]);
  if (!child) {
    return NextResponse.json({ error: "Child not found" }, { status: 404 });
  }

  const obsSummary = observations
    .slice(0, 15)
    .map(
      (o) =>
        `[${familyFormatDate(o.created_at)}] ${o.note}${
          o.social_tag ? ` (${o.social_tag})` : ""
        }`
    )
    .join("\n");

  const chapterSummary = latestChapter
    ? `"${latestChapter.title}" (${latestChapter.period}): ${latestChapter.summary}`
    : "No chapters written yet.";

  // Exclude the message we just inserted — it is passed as the user turn.
  const priorHistory = history.filter(
    (m, i) =>
      !(i === history.length - 1 && m.role === "parent" && m.content === message)
  );
  const conversationHistory = priorHistory
    .slice(-18)
    .map((m) => `${m.role === "parent" ? "Parent" : "Orbit"}: ${m.content}`)
    .join("\n\n");

  const systemPrompt = buildFamilyChatPrompt({
    parentName: sessionProfile.displayName,
    childName: child.name,
    fileContext: fileContext || "File is empty — nothing seeded yet.",
    recentObservations: obsSummary || "No moments captured recently.",
    latestChapterSummary: chapterSummary,
    todayLabel: familyFormatDate(new Date(), {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
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

  // Insert AI response
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

  // Update conversation timestamp
  await sb
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return NextResponse.json(aiMessage);
}
