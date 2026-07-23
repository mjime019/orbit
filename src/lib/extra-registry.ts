// Registry for child_profiles.extra: every known key the onboarding
// extraction can produce (see buildOnboardingExtractionPrompt), with how and
// where it renders on the About tab. Unknown keys still render — title-cased
// under "Anything else" — so nothing the parent said is ever invisible.
// This registry is also the whitelist for report-suggested file updates.

export type ExtraRender = "pills" | "paragraph" | "quotes";

export type SectionKey =
  | "temperament"
  | "interests"
  | "school"
  | "growing"
  | "sensitivities"
  | "comfort"
  | "routines"
  | "family"
  | "goals"
  | "values"
  | "other";

export interface ExtraSpec {
  label: string;
  section: SectionKey;
  render: ExtraRender;
}

export const EXTRA_REGISTRY: Record<string, ExtraSpec> = {
  temperament_notes: { label: "Temperament", section: "temperament", render: "paragraph" },
  language_notes: { label: "How he talks", section: "temperament", render: "paragraph" },
  direct_quotes: { label: "Things he says", section: "temperament", render: "quotes" },
  growing_edges: { label: "Growing edges", section: "growing", render: "pills" },
  school_notes: { label: "How school's going", section: "school", render: "paragraph" },
  school_likes: { label: "Loves at school", section: "school", render: "pills" },
  school_struggles: { label: "Harder at school", section: "school", render: "pills" },
  philosophy: { label: "Parenting philosophy", section: "values", render: "paragraph" },
  siblings: { label: "Siblings", section: "family", render: "pills" },
  pets: { label: "Pets", section: "family", render: "pills" },
  living_situation: { label: "At home", section: "family", render: "paragraph" },
  household_members: { label: "Household", section: "family", render: "pills" },
  personality_notes: { label: "Personality", section: "temperament", render: "pills" },
  behavioral_patterns: { label: "Patterns", section: "temperament", render: "pills" },
  // The extraction sometimes writes the day's rhythm as top-level keys
  // instead of inside the routines object — file them under Routines.
  mornings: { label: "Mornings", section: "routines", render: "paragraph" },
  evenings: { label: "Evenings", section: "routines", render: "paragraph" },
  weekends: { label: "Weekends", section: "routines", render: "paragraph" },
  school_day: { label: "School day", section: "routines", render: "paragraph" },
  after_school: { label: "After school", section: "routines", render: "paragraph" },
  golden_hours: { label: "Golden hours", section: "routines", render: "paragraph" },
  bedtime: { label: "Bedtime", section: "routines", render: "paragraph" },
  naps: { label: "Naps", section: "routines", render: "paragraph" },
  sleep: { label: "Sleep", section: "routines", render: "paragraph" },
  meals: { label: "Meals", section: "routines", render: "paragraph" },
  weekday_activities: { label: "Weekday activities", section: "routines", render: "paragraph" },
};

// Keys that belong in the family_context column. The complete route writes
// them there; About renders them in the Family section from either home, so
// rows seeded before this fix display correctly without a migration.
export const FAMILY_KEYS = new Set(["siblings", "pets", "living_situation"]);

// Deterministic About-tab section order (Basics renders separately above).
export const SECTION_ORDER: { key: SectionKey; emoji: string; title: string }[] = [
  { key: "temperament", emoji: "🌤️", title: "Temperament" },
  { key: "interests", emoji: "⭐", title: "Interests & Play" },
  { key: "school", emoji: "🏫", title: "School" },
  { key: "growing", emoji: "🌱", title: "Growing Edges" },
  { key: "sensitivities", emoji: "🌡️", title: "Sensitivities" },
  { key: "comfort", emoji: "💛", title: "Comfort & Regulation" },
  { key: "routines", emoji: "🕐", title: "Routines" },
  { key: "family", emoji: "👨‍👩‍👦", title: "Family" },
  { key: "goals", emoji: "🎯", title: "Your Goals" },
  { key: "values", emoji: "🧭", title: "Values & Philosophy" },
  { key: "other", emoji: "📝", title: "Anything Else" },
];

export function titleCaseKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Some AI-extracted values were stored as JSON-encoded strings
// ('["collaborative","leader"]') — parse those before display so brackets
// and quotes never reach the parent.
function parseMaybeJson(value: unknown): unknown {
  if (typeof value === "string") {
    const t = value.trim();
    if ((t.startsWith("[") && t.endsWith("]")) || (t.startsWith("{") && t.endsWith("}"))) {
      try {
        return JSON.parse(t);
      } catch {
        return value;
      }
    }
  }
  return value;
}

// Any extracted value → display text, never raw JSON. Arrays join their
// items; objects read as their values ("Felipe (4)" for {name, age}).
export function displayValue(raw: unknown): string {
  const value = parseMaybeJson(raw);
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(displayValue).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.name === "string") {
      return o.age !== undefined && o.age !== null && o.age !== ""
        ? `${o.name} (${displayValue(o.age)})`
        : o.name;
    }
    return Object.values(o).map(displayValue).filter(Boolean).join(" · ");
  }
  return "";
}

// Any extracted value → pill labels. One pill per array item; a lone
// string/object becomes a single pill.
export function displayPills(raw: unknown): string[] {
  const value = parseMaybeJson(raw);
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.map(displayValue).filter(Boolean);
  const text = displayValue(value);
  return text ? [text] : [];
}
