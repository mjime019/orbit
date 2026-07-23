import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSessionProfile } from "@/lib/session";
import { getParentChildren } from "@/lib/queries";
import { applyProfileUpdates, isAllowedProfileKey } from "@/lib/profile-merge";

// Parent-approved report suggestions → the kid's file, additively (arrays
// union with what's there). Only whitelisted keys pass; only payloads the
// parent explicitly approved arrive here.
export async function POST(request: NextRequest) {
  const { reportId, updates } = (await request.json()) as {
    reportId?: string;
    updates?: Record<string, unknown>;
  };
  if (!reportId || !updates || typeof updates !== "object") {
    return NextResponse.json(
      { error: "Missing reportId or updates" },
      { status: 400 }
    );
  }

  const sb = await createServerSupabase();
  const { profileId } = await getSessionProfile();

  const { data: report } = await sb
    .from("reports")
    .select("id, child_id, ai_extracted")
    .eq("id", reportId)
    .maybeSingle();
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  const kids = await getParentChildren(profileId);
  if (!kids.some((k) => k.id === report.child_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (isAllowedProfileKey(key)) filtered[key] = value;
  }
  if (Object.keys(filtered).length === 0) {
    return NextResponse.json({ error: "Nothing applicable to apply" }, { status: 400 });
  }

  const { error, applied } = await applyProfileUpdates(
    sb,
    report.child_id,
    filtered,
    { mode: "merge" }
  );
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  // Mark the report so the UI shows "in the file" instead of re-offering.
  const { error: stampError } = await sb
    .from("reports")
    .update({
      ai_extracted: {
        ...((report.ai_extracted as object) ?? {}),
        applied_at: new Date().toISOString(),
      },
    })
    .eq("id", reportId);
  if (stampError) {
    console.warn("[Reports Apply] applied_at stamp failed:", stampError.message);
  }

  return NextResponse.json({ success: true, applied });
}
