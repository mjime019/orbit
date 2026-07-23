// The apples-to-apples rubric: one structured plain-text view of a kid's
// file, consumed by every personal AI surface (chat, summaries, chapters,
// planners). Before this existed, everything in child_profiles.extra —
// temperament, school notes, family, philosophy — was invisible to the AI.
// Sections render in a fixed order; empty sections are omitted.

import { createServerSupabase } from "./supabase-server";
import { formatAge, ageBand } from "./age";
import {
  EXTRA_REGISTRY,
  displayPills,
  displayValue,
  titleCaseKey,
  type SectionKey,
} from "./extra-registry";

function lineFor(
  key: string,
  value: unknown
): { section: SectionKey; line: string } | null {
  const spec = EXTRA_REGISTRY[key] ?? {
    label: titleCaseKey(key),
    section: "other" as SectionKey,
    render: Array.isArray(value) ? ("pills" as const) : ("paragraph" as const),
  };
  const text =
    spec.render === "paragraph"
      ? displayValue(value)
      : displayPills(value).join(", ");
  if (!text) return null;
  return { section: spec.section, line: `${spec.label}: ${text}` };
}

export async function buildFileContext(childId: string): Promise<string> {
  const sb = await createServerSupabase();

  const [{ data: child }, { data: profile }] = await Promise.all([
    sb
      .from("children")
      .select("name, date_of_birth")
      .eq("id", childId)
      .maybeSingle(),
    sb.from("child_profiles").select("*").eq("child_id", childId).maybeSingle(),
  ]);
  if (!child) return "";

  const name = child.name;
  const age = formatAge(child.date_of_birth) || "unknown age";
  const band = ageBand(child.date_of_birth);

  // extra + family_context keys routed to their sections via the registry.
  const sectionLines: Record<SectionKey, string[]> = {
    temperament: [],
    interests: [],
    school: [],
    growing: [],
    sensitivities: [],
    comfort: [],
    routines: [],
    family: [],
    goals: [],
    values: [],
    other: [],
  };
  const extra: Record<string, unknown> = profile?.extra ?? {};
  for (const [key, value] of Object.entries(extra)) {
    const entry = lineFor(key, value);
    if (entry) sectionLines[entry.section].push(entry.line);
  }
  const familyContext: Record<string, unknown> = profile?.family_context ?? {};
  for (const [key, value] of Object.entries(familyContext)) {
    if (extra[key] !== undefined) continue;
    const entry = lineFor(key, value);
    if (entry) sectionLines[entry.section === "other" ? "family" : entry.section].push(entry.line);
  }
  for (const [key, value] of Object.entries(
    (profile?.routines ?? {}) as Record<string, unknown>
  )) {
    const text = displayValue(value);
    if (text) sectionLines.routines.push(`${titleCaseKey(key)}: ${text}`);
  }

  const push = (lines: string[], label: string, value: unknown) => {
    const text = Array.isArray(value)
      ? displayPills(value).join(", ")
      : displayValue(value);
    if (text) lines.push(`${label}: ${text}`);
  };
  push(sectionLines.interests, "Interests", profile?.interests);
  push(sectionLines.interests, "Emerging interests", profile?.emerging_interests);
  push(sectionLines.interests, "How he plays", profile?.play_style);
  push(sectionLines.interests, "Play notes", profile?.play_style_notes);
  push(sectionLines.growing, "Growing edges seen at home", profile?.emotional_triggers);
  push(sectionLines.sensitivities, "Food", profile?.food_sensitivities);
  push(sectionLines.sensitivities, "Sensory", profile?.sensory_sensitivities);
  push(sectionLines.comfort, "What helps", profile?.comfort_helps);
  push(sectionLines.comfort, "What escalates", profile?.comfort_escalates);
  push(sectionLines.goals, "Parent's goals", profile?.parent_goals);
  push(sectionLines.values, "What matters most to the parents", profile?.parent_values);

  // Active activities (best-effort — never fail context for a side table).
  const activityLines: string[] = [];
  try {
    const { data: activities, error } = await sb
      .from("child_activities")
      .select("name, category, schedule_note, status")
      .eq("child_id", childId)
      .eq("status", "active");
    if (error) throw new Error(error.message);
    for (const a of activities ?? []) {
      activityLines.push(
        `${a.name} (${a.category}${a.schedule_note ? `, ${a.schedule_note}` : ""})`
      );
    }
  } catch (err) {
    console.warn("[file-context] activities skipped:", err);
  }

  // Latest report takeaways (column may not exist until the SQL batch runs).
  const reportLines: string[] = [];
  try {
    const { data: reports, error } = await sb
      .from("reports")
      .select("title, ai_summary")
      .eq("child_id", childId)
      .not("ai_summary", "is", null)
      .order("created_at", { ascending: false })
      .limit(2);
    if (error) throw new Error(error.message);
    for (const r of reports ?? []) {
      if (r.ai_summary) reportLines.push(`${r.title}: ${r.ai_summary}`);
    }
  } catch (err) {
    console.warn("[file-context] report takeaways skipped:", err);
  }

  const blocks: string[] = [`CHILD: ${name}, ${age} old (${band})`];
  const addBlock = (title: string, lines: string[]) => {
    if (lines.length > 0) blocks.push(`${title}:\n${lines.join("\n")}`);
  };
  addBlock("TEMPERAMENT", sectionLines.temperament);
  addBlock("INTERESTS & PLAY", sectionLines.interests);
  addBlock("WHAT'S HARD RIGHT NOW", sectionLines.growing);
  addBlock("SENSITIVITIES", sectionLines.sensitivities);
  addBlock("COMFORT & REGULATION", sectionLines.comfort);
  addBlock("ROUTINES", sectionLines.routines);
  addBlock("FAMILY", sectionLines.family);
  addBlock("SCHOOL", sectionLines.school);
  addBlock("PARENT'S GOALS & VALUES", [
    ...sectionLines.goals,
    ...sectionLines.values,
  ]);
  addBlock("CURRENT ACTIVITIES", activityLines);
  addBlock("RECENT REPORT TAKEAWAYS", reportLines);
  addBlock("OTHER NOTES", sectionLines.other);

  return blocks.join("\n\n");
}
