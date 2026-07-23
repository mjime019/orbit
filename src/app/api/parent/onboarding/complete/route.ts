import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSessionProfile } from "@/lib/session";
import { FAMILY_KEYS } from "@/lib/extra-registry";

interface ResponsePayload {
  promptKey: string;
  rawResponse: string;
  extractedFields: Record<string, unknown>;
}

// Persists EVERYTHING the intake extracted: known fields land in their real
// child_profiles columns; everything else merges into child_profiles.extra
// (jsonb) so nothing the parent said is ever silently discarded.
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
  const { profileId } = await getSessionProfile();

  // ─── Merge extracted fields across responses ─────────────────────
  const merged: Record<string, unknown> = {};
  for (const r of responses) {
    for (const [key, value] of Object.entries(r.extractedFields ?? {})) {
      if (value === undefined || value === null || value === "") continue;
      if (Array.isArray(value) && Array.isArray(merged[key])) {
        merged[key] = [...new Set([...(merged[key] as unknown[]), ...value])];
      } else if (
        typeof value === "object" &&
        !Array.isArray(value) &&
        typeof merged[key] === "object" &&
        merged[key] !== null &&
        !Array.isArray(merged[key])
      ) {
        merged[key] = { ...(merged[key] as object), ...(value as object) };
      } else {
        merged[key] = value;
      }
    }
  }

  // ─── Map to real child_profiles columns ──────────────────────────
  const COLUMN_MAP: Record<string, string> = {
    current_interests: "interests",
    emerging_interests: "emerging_interests",
    parent_goals: "parent_goals",
    play_style: "play_style",
    social_notes: "play_style_notes",
    food: "food_sensitivities",
    sensory: "sensory_sensitivities",
    emotional: "emotional_triggers",
    emotional_triggers: "emotional_triggers",
    comfort_helps: "comfort_helps",
    comfort_escalates: "comfort_escalates",
    languages: "languages",
    parent_values: "parent_values",
  };

  const profileUpdate: Record<string, unknown> = { onboarding_complete: true };
  const extraUpdate: Record<string, unknown> = {};
  const familyUpdate: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(merged)) {
    const column = COLUMN_MAP[key];
    if (column) {
      // Emotional triggers can arrive from two keys — merge arrays.
      if (column === "emotional_triggers" && Array.isArray(profileUpdate[column])) {
        profileUpdate[column] = [
          ...new Set([
            ...(profileUpdate[column] as unknown[]),
            ...(Array.isArray(value) ? value : [value]),
          ]),
        ];
      } else {
        profileUpdate[column] = value;
      }
    } else if (key === "routines") {
      profileUpdate.routines = value;
    } else if (FAMILY_KEYS.has(key)) {
      familyUpdate[key] = value; // siblings, pets, living_situation → family_context
    } else {
      extraUpdate[key] = value; // growing_edges, temperament_notes, school_notes, philosophy, ...
    }
  }

  // ─── Archive raw responses (with the author, errors checked) ─────
  const { error: respError } = await sb.from("onboarding_responses").insert(
    responses.map((r) => ({
      child_id: childId,
      parent_id: profileId,
      prompt_key: r.promptKey,
      raw_response: r.rawResponse,
      extracted_fields: r.extractedFields,
    }))
  );
  if (respError) {
    console.error("[Onboarding Complete] Responses insert error:", respError);
    return NextResponse.json(
      { error: `Couldn't save your answers: ${respError.message}` },
      { status: 500 }
    );
  }

  // ─── Merge into extra/family_context without clobbering earlier seeds ───
  if (Object.keys(extraUpdate).length > 0 || Object.keys(familyUpdate).length > 0) {
    const { data: existing } = await sb
      .from("child_profiles")
      .select("extra, family_context")
      .eq("child_id", childId)
      .maybeSingle();
    if (Object.keys(extraUpdate).length > 0) {
      profileUpdate.extra = { ...(existing?.extra ?? {}), ...extraUpdate };
    }
    if (Object.keys(familyUpdate).length > 0) {
      profileUpdate.family_context = {
        ...(existing?.family_context ?? {}),
        ...familyUpdate,
      };
    }
  }

  const { error } = await sb
    .from("child_profiles")
    .update(profileUpdate)
    .eq("child_id", childId);

  if (error) {
    console.error("[Onboarding Complete] Profile update error:", error);
    return NextResponse.json(
      { error: `Couldn't update the profile: ${error.message}` },
      { status: 500 }
    );
  }

  // Best-effort re-seed stamp — separate update so a missing column
  // (SQL batch not run yet) never fails the save.
  const { error: stampError } = await sb
    .from("child_profiles")
    .update({ last_seeded_at: new Date().toISOString() })
    .eq("child_id", childId);
  if (stampError) {
    console.warn("[Onboarding Complete] last_seeded_at stamp skipped:", stampError.message);
  }

  return NextResponse.json({
    success: true,
    profile: { ...profileUpdate, onboarding_complete: true },
  });
}
