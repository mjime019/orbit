import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

interface ResponsePayload {
  promptKey: string;
  rawResponse: string;
  extractedFields: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  const { childId, responses } = (await request.json()) as {
    childId: string;
    responses: ResponsePayload[];
  };

  if (!childId || !responses?.length) {
    return NextResponse.json(
      { error: "Missing childId or responses" },
      { status: 400 }
    );
  }

  const sb = await createServerSupabase();

  // ─── Merge all extracted fields into a unified profile ────
  const merged: Record<string, unknown> = {};

  for (const r of responses) {
    const fields = r.extractedFields;

    switch (r.promptKey) {
      case "interests":
        if (fields.current_interests)
          merged.interests = fields.current_interests;
        if (fields.emerging_interests)
          merged.emerging_interests = fields.emerging_interests;
        break;
      case "challenges":
        if (fields.growing_edges) merged.growing_edges = fields.growing_edges;
        if (fields.emotional_triggers)
          merged.emotional_triggers = fields.emotional_triggers;
        break;
      case "goals":
        if (fields.parent_goals) merged.parent_goals = fields.parent_goals;
        break;
      case "sensitivities":
        if (fields.food) merged.sensitivity_food = fields.food;
        if (fields.sensory) merged.sensitivity_sensory = fields.sensory;
        if (fields.emotional) merged.sensitivity_emotional = fields.emotional;
        break;
      case "social":
        if (fields.play_style) merged.play_style = fields.play_style;
        if (fields.social_notes) merged.social_notes = fields.social_notes;
        if (fields.comfort_helps) merged.comfort_helps = fields.comfort_helps;
        if (fields.comfort_escalates)
          merged.comfort_escalates = fields.comfort_escalates;
        break;
      case "routines":
        merged.routines = fields;
        break;
      case "family":
        if (fields.siblings) merged.siblings = fields.siblings;
        if (fields.languages) merged.languages = fields.languages;
        if (fields.pets) merged.pets = fields.pets;
        if (fields.living_situation)
          merged.living_situation = fields.living_situation;
        break;
      case "values":
        if (fields.parent_values) merged.parent_values = fields.parent_values;
        if (fields.philosophy) merged.philosophy = fields.philosophy;
        break;
      default:
        // Unknown category — store as extra
        merged[r.promptKey] = fields;
    }
  }

  // ─── Save each response to onboarding_responses ────────────
  const insertRows = responses.map((r) => ({
    child_id: childId,
    prompt_key: r.promptKey,
    raw_response: r.rawResponse,
    extracted_fields: r.extractedFields,
  }));

  await sb.from("onboarding_responses").insert(insertRows);

  // ─── Update child_profiles with merged data ────────────────
  const profileUpdate: Record<string, unknown> = {
    onboarding_complete: true,
  };

  // Map merged fields to child_profiles columns
  if (merged.interests) profileUpdate.interests = merged.interests;
  if (merged.emerging_interests)
    profileUpdate.emerging_interests = merged.emerging_interests;
  if (merged.parent_goals) profileUpdate.parent_goals = merged.parent_goals;
  if (merged.play_style) profileUpdate.play_style = merged.play_style;

  // Store additional data in the JSONB extra_data column if it exists,
  // otherwise these fields are stored in onboarding_responses
  const extraData: Record<string, unknown> = {};
  for (const key of [
    "growing_edges",
    "emotional_triggers",
    "sensitivity_food",
    "sensitivity_sensory",
    "sensitivity_emotional",
    "social_notes",
    "comfort_helps",
    "comfort_escalates",
    "routines",
    "siblings",
    "languages",
    "pets",
    "living_situation",
    "parent_values",
    "philosophy",
  ]) {
    if (merged[key] !== undefined) {
      extraData[key] = merged[key];
    }
  }

  const { error } = await sb
    .from("child_profiles")
    .update(profileUpdate)
    .eq("child_id", childId);

  if (error) {
    console.error("[Onboarding Complete] Profile update error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }

  // Return the merged profile for the review screen
  return NextResponse.json({
    success: true,
    profile: { ...merged, onboarding_complete: true },
  });
}
