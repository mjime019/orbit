import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCampKey } from "@/lib/camp-auth";

const VALID_DOMAINS = new Set([
  "language",
  "motor_fine",
  "motor_gross",
  "social_emotional",
  "cognitive",
  "creative",
]);
const VALID_SOCIAL_TAGS = new Set([
  "helped",
  "led",
  "regulated",
  "played_with",
  "conflict",
  "breakthrough",
]);

interface ConfirmObservation {
  child_id: string;
  note: string;
  domains?: string[];
  social_tag?: string | null;
  other_children_ids?: string[];
}

// Fan-out: the human-reviewed per-child cards become real observations rows.
// Nothing reaches this table un-reviewed — the client only calls confirm
// after the speaker has seen and approved each card.
export async function POST(req: NextRequest) {
  const unauthorized = requireCampKey(req);
  if (unauthorized) return unauthorized;

  try {
    const {
      captureId,
      source,
      authorProfileId,
      classroomId,
      observations,
    } = await req.json();

    if (!Array.isArray(observations) || observations.length === 0) {
      return NextResponse.json(
        { error: "Nothing to confirm" },
        { status: 400 }
      );
    }
    if (!authorProfileId) {
      return NextResponse.json(
        { error: "Missing authorProfileId" },
        { status: 400 }
      );
    }

    const rows = (observations as ConfirmObservation[])
      .filter((o) => o.child_id && o.note?.trim())
      .map((o) => ({
        child_id: o.child_id,
        // Naming debt: for parent captures this is the parent's profile id.
        teacher_id: authorProfileId,
        classroom_id: classroomId ?? null,
        note: o.note.trim(),
        domains: (o.domains ?? []).filter((d) => VALID_DOMAINS.has(d)),
        social_tag:
          o.social_tag && VALID_SOCIAL_TAGS.has(o.social_tag)
            ? o.social_tag
            : null,
        other_children_ids: o.other_children_ids ?? [],
        source: source === "parent" ? "parent" : "teacher",
      }));

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No reviewable observations (every card needs a child and text)" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("observations")
      .insert(rows)
      .select("id");

    if (error) {
      console.error("[Capture Confirm] Insert error:", error);
      return NextResponse.json(
        { error: "Failed to save observations", detail: error.message },
        { status: 500 }
      );
    }

    if (captureId) {
      // Best-effort: the observations are already durable.
      await supabase
        .from("captures")
        .update({ status: "confirmed" })
        .eq("id", captureId);
    }

    return NextResponse.json({ saved: true, count: data?.length ?? rows.length });
  } catch (error) {
    console.error("[Capture Confirm]", error);
    return NextResponse.json(
      { error: "Failed to save observations" },
      { status: 500 }
    );
  }
}
