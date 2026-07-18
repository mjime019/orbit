import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSessionProfile } from "@/lib/session";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
]);
const KINDS = new Set(["school_report", "assessment", "artwork", "other"]);

// Progress-report uploads. Files live in the PRIVATE `reports` bucket;
// reads go through short-lived signed URLs only.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  const childId = form.get("childId")?.toString();
  const title = form.get("title")?.toString();
  const kind = form.get("kind")?.toString() ?? "school_report";
  const periodLabel = form.get("periodLabel")?.toString() || null;
  const notes = form.get("notes")?.toString() || null;

  if (!(file instanceof File) || !childId || !title?.trim()) {
    return NextResponse.json(
      { error: "Missing file, childId, or title" },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File is over 10MB — export a smaller version." },
      { status: 400 }
    );
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "PDFs and images only for now." },
      { status: 400 }
    );
  }

  const { profileId } = await getSessionProfile();
  const sb = await createServerSupabase();

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const storagePath = `${childId}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await sb.storage
    .from("reports")
    .upload(storagePath, file, { contentType: file.type });
  if (uploadError) {
    return NextResponse.json(
      { error: `Upload failed: ${uploadError.message}` },
      { status: 500 }
    );
  }

  const { data, error } = await sb
    .from("reports")
    .insert({
      child_id: childId,
      title: title.trim(),
      kind: KINDS.has(kind) ? kind : "other",
      period_label: periodLabel,
      storage_path: storagePath,
      notes,
      uploaded_by: profileId,
    })
    .select()
    .single();
  if (error) {
    // The file is up but the row failed — surface it; re-upload is harmless.
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ report: data });
}

export async function GET(req: NextRequest) {
  const childId = req.nextUrl.searchParams.get("childId");
  if (!childId) {
    return NextResponse.json({ error: "Missing childId" }, { status: 400 });
  }
  const sb = await createServerSupabase();
  const { data: rows, error } = await sb
    .from("reports")
    .select("*")
    .eq("child_id", childId)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const reports = await Promise.all(
    (rows ?? []).map(async (r) => {
      const { data: signed } = await sb.storage
        .from("reports")
        .createSignedUrl(r.storage_path, 3600);
      return { ...r, url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ reports });
}
