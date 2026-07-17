#!/usr/bin/env node
/**
 * One-off migration: camp_observations (jsonb blobs) -> observations (per-child rows).
 *
 * Run AFTER scripts/schema-2026-07-overhaul.sql has been applied:
 *   node --env-file=.env.local scripts/migrate-camp-observations.mjs --dry-run
 *   node --env-file=.env.local scripts/migrate-camp-observations.mjs
 *
 * Idempotent: skips any observation whose (child_id, note) already exists.
 * camp_observations is left untouched as an archive.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (use --env-file=.env.local)");
  process.exit(1);
}
const dryRun = process.argv.includes("--dry-run");
const sb = createClient(url, key);

// Fixed ids from scripts/schema-2026-07-overhaul.sql (verified collision-free)
const CHILD_IDS = {
  felipe: "00000000-0000-0000-0000-000000001101",
  rafael: "00000000-0000-0000-0000-000000001102",
};
const TEACHER_IDS = {
  carla: "00000000-0000-0000-0000-000000000103",
  miguel: "00000000-0000-0000-0000-000000000201", // parent profile; camp toggle allowed him as recorder
};
const SUMMER_CAMP_CLASSROOM = "00000000-0000-0000-0000-000000000011";

const VALID_DOMAINS = new Set([
  "language", "motor_fine", "motor_gross", "social_emotional", "cognitive", "creative",
]);
const VALID_SOCIAL_TAGS = new Set([
  "helped", "led", "regulated", "played_with", "conflict", "breakthrough",
]);

function buildNote(obs) {
  const parts = [obs.observation_summary?.trim()].filter(Boolean);
  if (Array.isArray(obs.direct_quotes) && obs.direct_quotes.length) {
    parts.push(obs.direct_quotes.map((q) => `"${q}"`).join(" · "));
  }
  if (obs.notable && obs.notable_reason) {
    parts.push(`Notable: ${obs.notable_reason}`);
  }
  return parts.join(" — ");
}

const { data: rows, error } = await sb
  .from("camp_observations")
  .select("*")
  .order("created_at", { ascending: true });
if (error) {
  console.error("Failed to read camp_observations:", error.message);
  process.exit(1);
}

let inserted = 0, skipped = 0, empty = 0;
for (const row of rows) {
  const teacherId =
    TEACHER_IDS[(row.teacher_name || "carla").toLowerCase()] ?? TEACHER_IDS.carla;

  for (const childKey of ["felipe", "rafael"]) {
    const obs = row.observations?.[childKey];
    if (!obs || !obs.observation_summary) { empty++; continue; }

    const note = buildNote(obs);
    const childId = CHILD_IDS[childKey];

    const { data: existing, error: exErr } = await sb
      .from("observations")
      .select("id")
      .eq("child_id", childId)
      .eq("note", note)
      .limit(1);
    if (exErr) { console.error("Existence check failed:", exErr.message); process.exit(1); }
    if (existing.length) { skipped++; continue; }

    const payload = {
      child_id: childId,
      teacher_id: teacherId,
      classroom_id: SUMMER_CAMP_CLASSROOM,
      note,
      domains: (obs.domains ?? []).filter((d) => VALID_DOMAINS.has(d)),
      social_tag:
        (obs.social_moments ?? []).map((m) => m.type).find((t) => VALID_SOCIAL_TAGS.has(t)) ?? null,
      other_children_ids: [], // camp peers aren't DB rows; their names live in the note
      source: "teacher",
      created_at: row.created_at,
    };

    if (dryRun) {
      console.log(`[dry-run] ${childKey} <- ${row.date}: ${note.slice(0, 80)}...`);
    } else {
      const { error: insErr } = await sb.from("observations").insert(payload);
      if (insErr) { console.error(`Insert failed (${childKey}, ${row.date}):`, insErr.message); process.exit(1); }
    }
    inserted++;
  }
}

console.log(
  `${dryRun ? "[dry-run] would insert" : "Inserted"} ${inserted} observation(s); ` +
  `skipped ${skipped} already-migrated; ${empty} child-slots empty across ${rows.length} camp record(s).`
);
