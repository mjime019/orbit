import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai";
import { buildActivityPersonalizationPrompt } from "@/lib/prompts";
import { createServerSupabase } from "@/lib/supabase-server";
import { getChildContext, getRecentObservations } from "@/lib/queries";

export async function POST(request: NextRequest) {
  const { childId, activityId, recommendationId } = await request.json();

  if (!childId || !activityId) {
    return NextResponse.json(
      { error: "Missing childId or activityId" },
      { status: 400 }
    );
  }

  const sb = createServerSupabase();

  // Fetch context in parallel
  const [context, observations, { data: activity }] = await Promise.all([
    getChildContext(childId),
    getRecentObservations(childId, 6),
    sb.from("activities").select("*").eq("id", activityId).single(),
  ]);

  if (!activity) {
    return NextResponse.json(
      { error: "Activity not found" },
      { status: 404 }
    );
  }

  // Build recent observations summary
  const recentObsSummary = observations
    .slice(0, 4)
    .map((o) => `- ${o.note}`)
    .join("\n");

  const systemPrompt = buildActivityPersonalizationPrompt({
    childName: context.childName,
    childAge: context.childAge,
    interests: context.interests,
    recentObservations: recentObsSummary || "No recent observations.",
    classroomTheme: context.classroomTheme,
  });

  const activityDetails = JSON.stringify({
    title: activity.title,
    description: activity.description,
    domains: activity.domains,
    materials: activity.materials,
    time_minutes: activity.time_minutes,
    energy_level: activity.energy_level,
  });

  let whyItFits: string;
  try {
    whyItFits = await callAI(systemPrompt, activityDetails);
    // Strip quotes if the mock/AI wraps it
    whyItFits = whyItFits.replace(/^["']|["']$/g, "").trim();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "AI service unavailable";
    const isRateLimit = message.includes("429") || message.includes("quota");
    return NextResponse.json(
      {
        error: isRateLimit
          ? "AI rate limit reached. Please try again in a few seconds."
          : message,
      },
      { status: isRateLimit ? 429 : 502 }
    );
  }

  // Save back to the recommendation if we have a recommendationId
  if (recommendationId) {
    await sb
      .from("activity_recommendations")
      .update({ why_it_fits: whyItFits })
      .eq("id", recommendationId);
  }

  return NextResponse.json({ why_it_fits: whyItFits });
}
