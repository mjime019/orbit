// The ONE place anything writes to a kid's file (child_profiles). Called by
// the onboarding complete route (parent answered questions) and the report
// apply route (parent approved Orbit's suggestions). Nothing else may write
// profile fields — that invariant is what "nothing enters the file without
// parent review" hangs on.

import { EXTRA_REGISTRY, FAMILY_KEYS } from "./extra-registry";

// Extraction keys → real child_profiles columns.
export const COLUMN_MAP: Record<string, string> = {
  current_interests: "interests",
  interests: "interests",
  emerging_interests: "emerging_interests",
  parent_goals: "parent_goals",
  play_style: "play_style",
  social_notes: "play_style_notes",
  food: "food_sensitivities",
  food_sensitivities: "food_sensitivities",
  sensory: "sensory_sensitivities",
  sensory_sensitivities: "sensory_sensitivities",
  emotional: "emotional_triggers",
  emotional_triggers: "emotional_triggers",
  comfort_helps: "comfort_helps",
  comfort_escalates: "comfort_escalates",
  languages: "languages",
  parent_values: "parent_values",
};

// Keys a caller may pass at all (whitelist for report-suggested updates).
export function isAllowedProfileKey(key: string): boolean {
  return (
    key in COLUMN_MAP ||
    key === "routines" ||
    FAMILY_KEYS.has(key) ||
    key in EXTRA_REGISTRY
  );
}

function unionArrays(existing: unknown, incoming: unknown[]): unknown[] {
  const base = Array.isArray(existing) ? existing : [];
  return [...new Set([...base, ...incoming])];
}

export interface ApplyOptions {
  // "replace": full seed — incoming values replace column values.
  // "merge": additive — arrays union with what's already in the file,
  //          objects merge key-wise, scalars replace (latest truth wins).
  mode: "replace" | "merge";
  markComplete?: boolean;
  stampSeeded?: boolean;
}

export async function applyProfileUpdates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  childId: string,
  updates: Record<string, unknown>,
  opts: ApplyOptions
): Promise<{ error: string | null; applied: Record<string, unknown> }> {
  const profileUpdate: Record<string, unknown> = {};
  if (opts.markComplete) profileUpdate.onboarding_complete = true;
  const extraUpdate: Record<string, unknown> = {};
  const familyUpdate: Record<string, unknown> = {};
  let routinesUpdate: Record<string, unknown> | null = null;

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null || value === "") continue;
    const column = COLUMN_MAP[key];
    if (column) {
      // Two extraction keys can land on one column (e.g. emotional +
      // emotional_triggers) — union rather than clobber within this batch.
      if (Array.isArray(value) && Array.isArray(profileUpdate[column])) {
        profileUpdate[column] = unionArrays(profileUpdate[column], value);
      } else {
        profileUpdate[column] = value;
      }
    } else if (key === "routines" && typeof value === "object" && !Array.isArray(value)) {
      routinesUpdate = value as Record<string, unknown>;
    } else if (FAMILY_KEYS.has(key)) {
      familyUpdate[key] = value;
    } else {
      extraUpdate[key] = value;
    }
  }

  // Read the existing row once for every merge target.
  const needExisting =
    opts.mode === "merge" ||
    Object.keys(extraUpdate).length > 0 ||
    Object.keys(familyUpdate).length > 0 ||
    routinesUpdate !== null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let existing: any = null;
  if (needExisting) {
    const { data } = await sb
      .from("child_profiles")
      .select("*")
      .eq("child_id", childId)
      .maybeSingle();
    existing = data;
  }

  if (opts.mode === "merge" && existing) {
    for (const [column, value] of Object.entries(profileUpdate)) {
      if (Array.isArray(value)) {
        profileUpdate[column] = unionArrays(existing[column], value);
      }
    }
  }

  if (routinesUpdate) {
    profileUpdate.routines = { ...(existing?.routines ?? {}), ...routinesUpdate };
  }
  if (Object.keys(extraUpdate).length > 0) {
    profileUpdate.extra = { ...(existing?.extra ?? {}), ...extraUpdate };
  }
  if (Object.keys(familyUpdate).length > 0) {
    profileUpdate.family_context = {
      ...(existing?.family_context ?? {}),
      ...familyUpdate,
    };
  }

  if (Object.keys(profileUpdate).length === 0) {
    return { error: null, applied: {} };
  }

  const { error } = await sb
    .from("child_profiles")
    .update(profileUpdate)
    .eq("child_id", childId);
  if (error) return { error: error.message, applied: {} };

  if (opts.stampSeeded) {
    // Best-effort — a missing column (SQL batch not run) never fails the save.
    const { error: stampError } = await sb
      .from("child_profiles")
      .update({ last_seeded_at: new Date().toISOString() })
      .eq("child_id", childId);
    if (stampError) {
      console.warn("[profile-merge] last_seeded_at stamp skipped:", stampError.message);
    }
  }

  return { error: null, applied: profileUpdate };
}
