import { describe, it, expect } from "vitest";
import type { z } from "zod";
import { generateMockResponse } from "@/lib/ai-mock";
import type { PromptType } from "@/lib/prompts";
import {
  buildObservationExtractionPrompt,
  buildHighlightPrompt,
  buildDigestPrompt,
  buildOnboardingExtractionPrompt,
  buildActivityPersonalizationPrompt,
  buildConciergePrompt,
  buildFamilyChatPrompt,
  buildMultiChildExtractionPrompt,
  buildCaptureFollowupPrompt,
  buildWhatThisMeansPrompt,
  buildChapterPrompt,
  buildPlannerPrompt,
  buildReportIngestionPrompt,
} from "@/lib/prompts";
import {
  parseAIResponse,
  ObservationExtractionSchema,
  HighlightGenerationSchema,
  DigestGenerationSchema,
  OnboardingExtractionSchema,
  MultiChildExtractionSchema,
  CaptureFollowupSchema,
  WhatThisMeansSchema,
  ChapterGenerationSchema,
  ReportIngestionSchema,
  PlannerIdeasSchema,
} from "@/lib/parse-ai";

// The prompts↔mock↔schema contract: for every PromptType, the mock's output
// for the REAL prompt built by prompts.ts must parse through the same schema
// the route uses. Being a Record<PromptType, …>, adding a PromptType without
// a contract case here is a compile error.

const ROSTER = [
  { name: "Felipe", age: 3 },
  { name: "Rafael", age: 4 },
];

const TRANSCRIPT =
  'Today Felipe spent twenty minutes painting a dinosaur and said "look at my T-rex!". ' +
  "Rafael helped Felipe clean the brushes without being asked, which was a first time for him.";

const OBSERVATIONS_TEXT =
  "[Jul 20] (parent) Rafael narrated a whole rescue mission for his dinosaurs.\n" +
  '[Jul 22] (teacher) Felipe built a tall tower with Mia and said "I made it tall!".';

type JsonCase = {
  kind: "json";
  system: string;
  user: string;
  schema: z.ZodType;
  check?: (parsed: never) => void;
};
type TextCase = { kind: "text"; system: string; user: string };

const CASES: Record<PromptType, JsonCase | TextCase> = {
  observation_extraction: {
    kind: "json",
    system: buildObservationExtractionPrompt({
      schoolName: "Little Explorers Academy",
      childName: "Johnny",
      childAge: 4,
      classroomName: "Sunshine Room",
      interests: ["building", "dinosaurs"],
      focusAreas: ["sharing"],
    }),
    user: 'Johnny built a bridge with Mia and said "we need more blocks!" — first time he asked a friend for help.',
    schema: ObservationExtractionSchema,
  },
  highlight: {
    kind: "json",
    system: buildHighlightPrompt({
      schoolName: "Little Explorers Academy",
      childName: "Johnny",
      childAge: 4,
      interests: ["building"],
      parentGoals: ["confidence"],
    }),
    user: JSON.stringify([
      { note: 'Johnny built a bridge and said "it holds!"', domains: ["cognitive"], social_tag: null },
    ]),
    schema: HighlightGenerationSchema,
  },
  digest: {
    kind: "json",
    system: buildDigestPrompt({
      schoolName: "Little Explorers Academy",
      childName: "Johnny",
      childAge: 4,
      interests: ["building"],
      classroomTheme: "Ocean life",
      parentGoals: [],
    }),
    user: JSON.stringify({
      observations: [{ note: "Johnny counted to twenty at the water table." }],
      highlights: [{ title: "The Little Engineer", content: "Johnny built a bridge." }],
    }),
    schema: DigestGenerationSchema,
  },
  onboarding_extraction: {
    kind: "json",
    system: buildOnboardingExtractionPrompt({
      promptText: "What is your child into right now?",
      promptCategory: "interests",
      childName: "Felipe",
      ageLabel: "3 years",
    }),
    user: "He is obsessed with dinosaurs, painting, and lately anything with wheels.",
    schema: OnboardingExtractionSchema,
  },
  activity_personalization: {
    kind: "text",
    system: buildActivityPersonalizationPrompt({
      childName: "Johnny",
      childAge: 4,
      interests: ["building"],
      recentObservations: "Built a bridge at the block corner.",
      classroomTheme: "Ocean life",
    }),
    user: JSON.stringify({ title: "Bathtub volume lab" }),
  },
  concierge_chat: {
    kind: "text",
    system: buildConciergePrompt({
      parentName: "Miguel",
      childName: "Johnny",
      childAge: 4,
      childProfile: "Loves building.",
      recentObservations: "Built a bridge.",
      schoolKnowledge: "Ocean theme this month.",
      conversationHistory: "No previous messages.",
    }),
    user: "How is Johnny doing socially this week?",
  },
  family_chat: {
    kind: "text",
    system: buildFamilyChatPrompt({
      parentName: "Miguel",
      childName: "Rafael",
      fileContext: "Interests: dinosaurs, rescue missions",
      recentObservations: OBSERVATIONS_TEXT,
      latestChapterSummary: "No chapters written yet.",
      todayLabel: "Saturday, July 25, 2026",
      conversationHistory: "No previous messages.",
    }),
    user: "Bedtime has been rough this week — any ideas?",
  },
  multi_child_extraction: {
    kind: "json",
    system: buildMultiChildExtractionPrompt({
      speakerName: "Carla",
      speakerRole: "teacher",
      setting: "school",
      roster: ROSTER,
    }),
    user: TRANSCRIPT,
    schema: MultiChildExtractionSchema,
    check: (parsed: z.output<typeof MultiChildExtractionSchema>) => {
      expect(parsed.children.length).toBeGreaterThan(0);
      const names = ROSTER.map((r) => r.name);
      for (const child of parsed.children) {
        expect(names).toContain(child.name);
        // The capture route drops children with an empty summary — the mock
        // must never produce one for a transcript that names the child.
        expect(child.observation_summary.length).toBeGreaterThan(0);
      }
    },
  },
  capture_followup: {
    kind: "json",
    system: buildCaptureFollowupPrompt({ speakerName: "Carla", roster: ROSTER }),
    user: TRANSCRIPT,
    schema: CaptureFollowupSchema,
    check: (parsed: z.output<typeof CaptureFollowupSchema>) => {
      expect(parsed.followups.length).toBeGreaterThan(0);
      expect(parsed.open_close.length).toBeGreaterThan(0);
    },
  },
  what_this_means: {
    kind: "json",
    system: buildWhatThisMeansPrompt({
      childName: "Rafael",
      ageLabel: "4½ years",
      interests: ["dinosaurs"],
    }),
    user: OBSERVATIONS_TEXT,
    schema: WhatThisMeansSchema,
    check: (parsed: z.output<typeof WhatThisMeansSchema>) => {
      expect(parsed.pulse).toContain("Rafael");
    },
  },
  chapter: {
    kind: "json",
    system: buildChapterPrompt({
      childName: "Felipe",
      ageLabel: "3½ years",
      ageBand: "preschool",
      periodLabel: "Summer 2026",
      interests: ["painting"],
    }),
    user: OBSERVATIONS_TEXT,
    schema: ChapterGenerationSchema,
    check: (parsed: z.output<typeof ChapterGenerationSchema>) => {
      expect(parsed.title).toContain("Felipe");
      expect(parsed.period).toBe("Summer 2026");
    },
  },
  planner_activity: {
    kind: "json",
    system: buildPlannerPrompt("activity", {
      childName: "Felipe",
      fileContext: "Interests: dinosaurs, painting\nGrowing edges: transitions",
      todayLabel: "Saturday, July 25, 2026",
      seasonLabel: "Summer 2026",
    }),
    user: "Generate the ideas now.",
    schema: PlannerIdeasSchema,
    check: (parsed: z.output<typeof PlannerIdeasSchema>) => {
      for (const idea of parsed) {
        expect(typeof idea.title).toBe("string");
        expect(typeof idea.why_it_fits).toBe("string");
        expect(Array.isArray(idea.materials)).toBe(true);
      }
    },
  },
  planner_weekend: {
    kind: "json",
    system: buildPlannerPrompt("weekend", {
      crewContexts: "Felipe: painting.\n\n---\n\nRafael: dinosaurs.",
      todayLabel: "Saturday, July 25, 2026",
      seasonLabel: "Summer 2026",
    }),
    user: "Generate the ideas now.",
    schema: PlannerIdeasSchema,
    check: (parsed: z.output<typeof PlannerIdeasSchema>) => {
      for (const idea of parsed) {
        expect(typeof idea.title).toBe("string");
        expect(typeof idea.where).toBe("string");
        expect(typeof idea.backup_if_rains).toBe("string");
      }
    },
  },
  planner_extracurricular: {
    kind: "json",
    system: buildPlannerPrompt("extracurricular", {
      childName: "Rafael",
      fileContext: "Interests: soccer, water play",
      todayLabel: "Saturday, July 25, 2026",
      seasonLabel: "Summer 2026",
    }),
    user: "Generate the ideas now.",
    schema: PlannerIdeasSchema,
    check: (parsed: z.output<typeof PlannerIdeasSchema>) => {
      for (const idea of parsed) {
        expect(typeof idea.category).toBe("string");
        expect(Array.isArray(idea.readiness_signs)).toBe(true);
      }
    },
  },
  report_ingestion: {
    kind: "json",
    system: buildReportIngestionPrompt({
      childName: "Rafael",
      ageLabel: "4½ years",
      kind: "progress_report",
    }),
    user: 'This is "Fall Progress Report" (Fall 2026). Read it and return the JSON.',
    schema: ReportIngestionSchema,
    check: (parsed: z.output<typeof ReportIngestionSchema>) => {
      expect(parsed.summary).toContain("Rafael");
    },
  },
};

describe("prompts↔mock contract", () => {
  for (const [promptType, testCase] of Object.entries(CASES) as [
    PromptType,
    JsonCase | TextCase,
  ][]) {
    it(`${promptType}: mock output satisfies the route's contract`, () => {
      const raw = generateMockResponse(promptType, testCase.system, testCase.user);
      expect(raw.length).toBeGreaterThan(0);

      if (testCase.kind === "json") {
        // Must not throw — same parser + schema the route uses.
        const parsed = parseAIResponse(raw, testCase.schema);
        testCase.check?.(parsed as never);
      } else {
        // Plain-text prompt types must NOT return a JSON blob.
        expect(raw.trim().startsWith("{")).toBe(false);
        expect(raw.trim().startsWith("[")).toBe(false);
      }
    });
  }

  it("multi_child_extraction keeps the flow alive when no roster name is in the transcript", () => {
    const system = buildMultiChildExtractionPrompt({
      speakerName: "Miguel",
      speakerRole: "parent",
      setting: "home",
      roster: ROSTER,
    });
    const raw = generateMockResponse(
      "multi_child_extraction",
      system,
      "We went to the park and everyone had a great time on the swings."
    );
    const parsed = parseAIResponse(raw, MultiChildExtractionSchema);
    expect(parsed.children.length).toBeGreaterThan(0);
    expect(parsed.children[0].observation_summary.length).toBeGreaterThan(0);
  });

  it("family_chat mock addresses the actual parent and child", () => {
    const testCase = CASES.family_chat as TextCase;
    const raw = generateMockResponse("family_chat", testCase.system, testCase.user);
    expect(raw).toContain("Rafael");
  });
});
