import { z } from "zod";

// The one place AI text becomes trusted data. Every route that expects JSON
// from callAI goes through parseAIResponse with a schema from this file —
// no route-local JSON.parse, no unvalidated fields reaching the DB or the UI.
//
// Validation philosophy: the field a route can't proceed without is required
// (a highlight without content is not a highlight); everything decorative is
// tolerant — wrong-typed or missing optional fields collapse to safe defaults
// instead of failing the whole response, and unknown enum members are dropped
// rather than rejected.

export class AIResponseFormatError extends Error {
  /** Suggested HTTP status for routes surfacing this error. */
  readonly status = 502;
  /** The unparsed model output, for error payloads that echo it back. */
  readonly raw: string;

  constructor(message: string, raw: string) {
    super(message);
    this.name = "AIResponseFormatError";
    this.raw = raw;
  }
}

const DOMAINS = [
  "language",
  "motor_fine",
  "motor_gross",
  "social_emotional",
  "cognitive",
  "creative",
] as const;

const SOCIAL_TAGS = [
  "helped",
  "led",
  "regulated",
  "played_with",
  "conflict",
  "breakthrough",
] as const;

/** Array of enum values where invalid members are dropped, not fatal. */
function enumArray<const T extends readonly [string, ...string[]]>(values: T) {
  return z
    .array(z.string())
    .catch([])
    .transform((arr) =>
      arr.filter((v): v is T[number] => (values as readonly string[]).includes(v))
    );
}

const optionalString = z.string().nullable().catch(null);
const stringList = z.array(z.string()).catch([]);

// ─── Response schemas, one per JSON prompt type ─────────────────

export const ObservationExtractionSchema = z.object({
  domains: enumArray(DOMAINS),
  social_tag: z.enum(SOCIAL_TAGS).nullable().catch(null),
  other_children: stringList,
  key_quote: optionalString,
  summary: z.string().min(1),
  clarification_needed: optionalString,
});

export const HighlightGenerationSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  summary: z.string().catch(""),
  domains: enumArray(DOMAINS),
  social_tags: enumArray(SOCIAL_TAGS),
});

export const DigestGenerationSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  domains_covered: enumArray(DOMAINS),
  observation_count: z.number().catch(0),
});

export const OnboardingExtractionSchema = z.object({
  extracted_fields: z.record(z.string(), z.unknown()).catch({}),
  confidence: z.number().catch(0.5),
  followup_needed: z.boolean().catch(false),
  followup_question: optionalString,
});

export const MultiChildExtractionSchema = z.object({
  children: z
    .array(
      z.object({
        name: z.string().catch(""),
        observation_summary: z.string().catch(""),
        domains: enumArray(DOMAINS),
        social_moments: z
          .array(
            z.object({
              type: z.string().catch(""),
              description: z.string().catch(""),
              with_whom: stringList,
            })
          )
          .catch([]),
        direct_quotes: stringList,
        other_kids_involved: stringList,
        notable: z.boolean().catch(false),
        notable_reason: optionalString,
      })
    )
    .catch([]),
  day_summary: z.string().catch(""),
  themes: stringList,
});

export const CaptureFollowupSchema = z.object({
  followups: z.array(
    z.object({
      question: z.string().min(1),
      about_child: z.string().catch("general"),
      reason: z.string().catch(""),
    })
  ),
  open_close: z
    .string()
    .catch(
      "Anything else notable — new, exciting, or challenging — that we haven't covered?"
    ),
});

export const WhatThisMeansSchema = z.object({
  pulse: z.string().catch(""),
  summary: z.string().min(1),
});

export const ChapterGenerationSchema = z.object({
  period: z.string().catch(""),
  age_label: z.string().catch(""),
  title: z.string().min(1),
  emoji: z.string().catch("🌱"),
  top_domains: enumArray(DOMAINS),
  summary: z.string().min(1),
  highlight_text: optionalString,
  highlight_icon: optionalString,
  breakthrough_text: optionalString,
  breakthrough_icon: optionalString,
  emerging: stringList,
  friends: stringList,
  parent_note: optionalString,
});

export const ReportIngestionSchema = z.object({
  summary: z.string().min(1),
  strengths: stringList,
  growth_areas: stringList,
  notable_quotes: stringList,
  suggested_file_updates: z.record(z.string(), z.unknown()).catch({}),
});

// Planner payloads are heterogeneous per kind and stored whole; the route
// only needs "a non-empty array of objects". Per-kind key coverage is
// enforced by the prompts↔mock contract tests, not at parse time.
export const PlannerIdeasSchema = z
  .array(z.record(z.string(), z.unknown()))
  .min(1);

// ─── Parsing ────────────────────────────────────────────────────

/**
 * Strip markdown fences and any prose around the outermost JSON value.
 * Models occasionally wrap JSON in ```json fences or a sentence of preamble.
 */
function stripToJson(text: string, root: "object" | "array"): string {
  const cleaned = text
    .replace(/```json\n?/gi, "")
    .replace(/```\n?/g, "")
    .trim();
  const open = root === "array" ? "[" : "{";
  const close = root === "array" ? "]" : "}";
  const start = cleaned.indexOf(open);
  const end = cleaned.lastIndexOf(close);
  return start !== -1 && end > start ? cleaned.slice(start, end + 1) : cleaned;
}

/**
 * Parse raw model output against a schema. Throws AIResponseFormatError
 * (status 502) when the text isn't JSON or fails validation.
 */
export function parseAIResponse<Schema extends z.ZodType>(
  raw: string,
  schema: Schema
): z.output<Schema> {
  const root = schema instanceof z.ZodArray ? "array" : "object";
  let data: unknown;
  try {
    data = JSON.parse(stripToJson(raw, root));
  } catch {
    throw new AIResponseFormatError("AI returned unparseable JSON", raw);
  }
  const result = schema.safeParse(data);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new AIResponseFormatError(
      `AI response failed validation — ${detail}`,
      raw
    );
  }
  return result.data;
}

/** Like parseAIResponse, but returns null for routes with their own fallback. */
export function safeParseAIResponse<Schema extends z.ZodType>(
  raw: string,
  schema: Schema
): z.output<Schema> | null {
  try {
    return parseAIResponse(raw, schema);
  } catch {
    return null;
  }
}
