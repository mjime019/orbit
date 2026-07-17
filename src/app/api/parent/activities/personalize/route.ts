import { NextRequest, NextResponse } from "next/server";
import { callAI, AIUnavailableError } from "@/lib/ai";
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

  const sb = await createServerSupabase();

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
    ({ text: whyItFits } = await callAI(systemPrompt, activityDetails));
    // Strip quotes if the model wraps it
    whyItFits = whyItFits.replace(/^["']|["']$/g, "").trim();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "AI service unavailable";
    const status = err instanceof AIUnavailableError ? err.status : 502;
    return NextResponse.json({ error: message }, { status });
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
