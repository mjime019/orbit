import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSessionProfile } from "@/lib/session";
import { getParentChildren } from "@/lib/queries";
import { callAIWithDocument, AIUnavailableError } from "@/lib/ai";
import { buildReportIngestionPrompt } from "@/lib/prompts";
import { formatAge } from "@/lib/age";

const EXT_MEDIA: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

// Claude reads the uploaded report and stores a summary + suggestions on the
// report row. Suggestions do NOT touch the kid's file — that happens only in
// /apply, after the parent approves each item.
export async function POST(request: NextRequest) {
  const { reportId } = await request.json();
  if (!reportId) {
    return NextResponse.json({ error: "Missing reportId" }, { status: 400 });
  }

  const sb = await createServerSupabase();
  const { profileId } = await getSessionProfile();

  const { data: report, error: reportError } = await sb
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();
  if (reportError) {
    return NextResponse.json({ error: reportError.message }, { status: 500 });
  }
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // Ownership: the report's child must be the session parent's kid.
  const kids = await getParentChildren(profileId);
  const child = kids.find((k) => k.id === report.child_id);
  if (!child) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = report.storage_path.split(".").pop()?.toLowerCase() ?? "";
  const mediaType = EXT_MEDIA[ext];
  if (!mediaType) {
    return NextResponse.json(
      { error: "Orbit can't read this format — upload a PDF, JPG, PNG, or WebP." },
      { status: 422 }
    );
  }

  const { data: blob, error: downloadError } = await sb.storage
    .from("reports")
    .download(report.storage_path);
  if (downloadError || !blob) {
    return NextResponse.json(
      { error: `Couldn't read the stored file: ${downloadError?.message ?? "empty"}` },
      { status: 500 }
    );
  }
  const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");

  let parsed: {
    summary?: string;
    strengths?: string[];
    growth_areas?: string[];
    notable_quotes?: string[];
    suggested_file_updates?: Record<string, unknown>;
  };
  try {
    const result = await callAIWithDocument(
      buildReportIngestionPrompt({
        childName: child.name,
        ageLabel: formatAge(child.date_of_birth) || "young",
        kind: report.kind,
      }),
      { base64, mediaType },
      `This is "${report.title}"${report.period_label ? ` (${report.period_label})` : ""}. Read it and return the JSON.`,
      { maxOutputTokens: 1500 }
    );
    const cleaned = result.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    parsed = JSON.parse(start !== -1 && end > start ? cleaned.slice(start, end + 1) : cleaned);
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI service unavailable";
    const status = err instanceof AIUnavailableError ? err.status : 502;
    return NextResponse.json({ error: message }, { status });
  }

  if (!parsed.summary) {
    return NextResponse.json(
      { error: "Orbit couldn't make sense of this report — try again." },
      { status: 502 }
    );
  }

  const extracted = {
    strengths: parsed.strengths ?? [],
    growth_areas: parsed.growth_areas ?? [],
    notable_quotes: parsed.notable_quotes ?? [],
    suggested_file_updates: parsed.suggested_file_updates ?? {},
  };

  const { error: updateError } = await sb
    .from("reports")
    .update({
      ai_summary: parsed.summary,
      ai_extracted: extracted,
      ai_processed_at: new Date().toISOString(),
    })
    .eq("id", reportId);
  if (updateError) {
    // Most likely the SQL batch hasn't run (columns missing) — say so plainly.
    return NextResponse.json(
      { error: `Couldn't save the reading: ${updateError.message}. Has scripts/pivot/08-round3.sql been run?` },
      { status: 500 }
    );
  }

  return NextResponse.json({ summary: parsed.summary, extracted });
}
