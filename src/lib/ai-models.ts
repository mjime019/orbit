// Which model runs which job. This is the ONE place model choice lives —
// ai.ts executes whatever tier a prompt type maps to.
//
// Pricing snapshot (per million tokens in/out, Sep 2026):
//   Haiku 4.5  $1 / $5   — fastest; structured extraction with checkable output
//   Sonnet 5.5 $2 / $10  — only 2x Haiku; far stronger writing and grounding
//   Opus 5.5   $4 / $20  — not used; reserve for a measured need
//
// Tiering rule: the parent is WAITING on extraction (capture, onboarding) and
// its output is schema-validated, so it stays on the fast tier. Everything a
// parent READS as prose or relies on as judgment (summaries, chapters, chat,
// planner ideas, report reading) is low-volume and quality-bound, so it runs
// on the writer tier. At family scale the difference is about a dollar a month.

import type { PromptType } from "./prompts";

export type Effort = "low" | "medium" | "high";

export interface ModelTier {
  model: string;
  /** output_config.effort — only on models that accept it (not Haiku 4.5). */
  effort?: Effort;
  /**
   * Extra max_tokens beyond the caller's visible-output budget. Sonnet 5.5
   * always thinks (adaptive) and thinking counts toward max_tokens, so a
   * 500-token summary budget would otherwise be eaten before any output.
   */
  thinkingHeadroom: number;
}

export const FAST_TIER: ModelTier = {
  model: "claude-haiku-4-5-20251001",
  thinkingHeadroom: 0,
};

// Effort "low" is the documented starting point for chat, content generation
// and extraction on Sonnet 5.5 — raise per route only with measured evidence.
export const WRITER_TIER: ModelTier = {
  model: "claude-sonnet-5-5",
  effort: "low",
  thinkingHeadroom: 6000,
};

// Record<PromptType, …> makes this exhaustive: adding a prompt type without
// choosing its tier is a compile error.
const TIER_BY_PROMPT: Record<PromptType, ModelTier> = {
  // Structured extraction while someone waits
  multi_child_extraction: FAST_TIER,
  capture_followup: FAST_TIER,
  onboarding_extraction: FAST_TIER,
  // Dormant teacher/demo surfaces — unchanged
  observation_extraction: FAST_TIER,
  highlight: FAST_TIER,
  digest: FAST_TIER,
  activity_personalization: FAST_TIER,
  concierge_chat: FAST_TIER,
  // Parent-facing writing and reasoning over the kid's file
  what_this_means: WRITER_TIER,
  chapter: WRITER_TIER,
  family_chat: WRITER_TIER,
  planner_activity: WRITER_TIER,
  planner_weekend: WRITER_TIER,
  planner_extracurricular: WRITER_TIER,
  report_ingestion: WRITER_TIER,
};

export function tierFor(promptType: PromptType): ModelTier {
  return TIER_BY_PROMPT[promptType];
}
