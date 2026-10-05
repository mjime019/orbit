import { describe, expect, it } from "vitest";
import { FAST_TIER, WRITER_TIER, tierFor } from "../ai-models";

describe("model tiers", () => {
  it("keeps wait-on-it extraction on the fast tier", () => {
    for (const p of [
      "multi_child_extraction",
      "capture_followup",
      "onboarding_extraction",
    ] as const) {
      expect(tierFor(p)).toBe(FAST_TIER);
    }
  });

  it("runs parent-facing writing and reasoning on the writer tier", () => {
    for (const p of [
      "what_this_means",
      "chapter",
      "family_chat",
      "planner_activity",
      "planner_weekend",
      "planner_extracurricular",
      "report_ingestion",
      "ritual_suggestions",
      "goal_plan",
      "goal_checkin",
    ] as const) {
      expect(tierFor(p)).toBe(WRITER_TIER);
    }
  });

  it("leaves dormant teacher/demo surfaces on the fast tier", () => {
    for (const p of [
      "observation_extraction",
      "highlight",
      "digest",
      "activity_personalization",
      "concierge_chat",
    ] as const) {
      expect(tierFor(p)).toBe(FAST_TIER);
    }
  });

  it("sends effort only where the model accepts it", () => {
    // Haiku 4.5 rejects output_config.effort; Sonnet 5.5 must set it
    // explicitly (its default is "high").
    expect(FAST_TIER.effort).toBeUndefined();
    expect(WRITER_TIER.effort).toBe("low");
  });

  it("gives the always-thinking writer tier max_tokens headroom", () => {
    // Thinking counts toward max_tokens; without headroom a 500-token
    // summary budget is consumed before any visible output.
    expect(WRITER_TIER.thinkingHeadroom).toBeGreaterThanOrEqual(4000);
    expect(FAST_TIER.thinkingHeadroom).toBe(0);
  });
});
