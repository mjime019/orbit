import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSessionProfile } from "@/lib/session";
import { applyProfileUpdates } from "@/lib/profile-merge";

interface ResponsePayload {
  promptKey: string;
  rawResponse: string;
  extractedFields: Record<string, unknown>;
}

// Persists EVERYTHING the intake extracted through applyProfileUpdates (the
// single choke point for file writes): known fields land in their real
// child_profiles columns, family keys in family_context, everything else in
// extra — nothing the parent said is ever silently discarded.
// mode "refresh" (the 6-month "what's changed" pass) merges additively:
// arrays union with the existing file, text fields replace.
export async function POST(request: NextRequest) {
  const { childId, responses, mode } = (await request.json()) as {
    childId: string;
    responses: ResponsePayload[];
    mode?: "seed" | "refresh";
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

  const { error, applied } = await applyProfileUpdates(sb, childId, merged, {
    mode: mode === "refresh" ? "merge" : "replace",
    markComplete: true,
    stampSeeded: true,
  });

  if (error) {
    console.error("[Onboarding Complete] Profile update error:", error);
    return NextResponse.json(
      { error: `Couldn't update the profile: ${error}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    profile: { ...applied, onboarding_complete: true },
  });
}
