import { describe, it, expect } from "vitest";
import {
  parseAIResponse,
  safeParseAIResponse,
  AIResponseFormatError,
  ObservationExtractionSchema,
  HighlightGenerationSchema,
  DigestGenerationSchema,
  ChapterGenerationSchema,
  PlannerIdeasSchema,
  WhatThisMeansSchema,
} from "@/lib/parse-ai";

const validExtraction = {
  domains: ["language", "cognitive"],
  social_tag: "helped",
  other_children: ["Mia"],
  key_quote: "I made it tall!",
  summary: "Johnny built a tower and told Mia how he did it.",
  clarification_needed: null,
};

describe("parseAIResponse", () => {
  it("parses clean JSON", () => {
    const result = parseAIResponse(
      JSON.stringify(validExtraction),
      ObservationExtractionSchema
    );
    expect(result.summary).toBe(validExtraction.summary);
    expect(result.domains).toEqual(["language", "cognitive"]);
  });

  it("strips markdown code fences", () => {
    const raw = "```json\n" + JSON.stringify(validExtraction) + "\n```";
    const result = parseAIResponse(raw, ObservationExtractionSchema);
    expect(result.summary).toBe(validExtraction.summary);
  });

  it("extracts an object wrapped in prose", () => {
    const raw =
      "Sure! Here is the extraction you asked for:\n" +
      JSON.stringify(validExtraction) +
      "\nLet me know if you need anything else.";
    const result = parseAIResponse(raw, ObservationExtractionSchema);
    expect(result.summary).toBe(validExtraction.summary);
  });

  it("extracts an array root wrapped in fences and prose", () => {
    const ideas = [{ title: "Cardboard fort", why_it_fits: "because" }];
    const raw = "Here are the ideas:\n```json\n" + JSON.stringify(ideas) + "\n```";
    const result = parseAIResponse(raw, PlannerIdeasSchema);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Cardboard fort");
  });

  it("throws AIResponseFormatError on non-JSON, preserving the raw text", () => {
    let thrown: unknown;
    try {
      parseAIResponse("I'm sorry, I can't do that.", ObservationExtractionSchema);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(AIResponseFormatError);
    expect((thrown as AIResponseFormatError).status).toBe(502);
    expect((thrown as AIResponseFormatError).raw).toContain("I'm sorry");
  });

  it("throws when a required field is missing", () => {
    const missingSummary = { ...validExtraction, summary: undefined };
    expect(() =>
      parseAIResponse(JSON.stringify(missingSummary), ObservationExtractionSchema)
    ).toThrow(AIResponseFormatError);
  });

  it("throws when a required field is empty", () => {
    expect(() =>
      parseAIResponse(
        JSON.stringify({ ...validExtraction, summary: "" }),
        ObservationExtractionSchema
      )
    ).toThrow(AIResponseFormatError);
  });

  it("rejects a highlight without content", () => {
    expect(() =>
      parseAIResponse(
        JSON.stringify({ title: "The Big Moment" }),
        HighlightGenerationSchema
      )
    ).toThrow(AIResponseFormatError);
  });

  it("rejects an empty planner array", () => {
    expect(() => parseAIResponse("[]", PlannerIdeasSchema)).toThrow(
      AIResponseFormatError
    );
  });
});

describe("tolerant fields", () => {
  it("drops unknown domain values instead of failing", () => {
    const raw = JSON.stringify({
      ...validExtraction,
      domains: ["language", "clairvoyance", "cognitive"],
    });
    const result = parseAIResponse(raw, ObservationExtractionSchema);
    expect(result.domains).toEqual(["language", "cognitive"]);
  });

  it("collapses an invalid social_tag to null", () => {
    const raw = JSON.stringify({ ...validExtraction, social_tag: "vibing" });
    const result = parseAIResponse(raw, ObservationExtractionSchema);
    expect(result.social_tag).toBeNull();
  });

  it("defaults missing optional arrays and wrong-typed decorations", () => {
    const raw = JSON.stringify({
      title: "A Week of Wonder",
      content: "It was a great week.",
      domains_covered: "all of them",
      observation_count: "seven",
    });
    const result = parseAIResponse(raw, DigestGenerationSchema);
    expect(result.domains_covered).toEqual([]);
    expect(result.observation_count).toBe(0);
  });

  it("fills chapter decoration defaults but keeps title/summary required", () => {
    const result = parseAIResponse(
      JSON.stringify({ title: "Finding His Groove", summary: "He grew." }),
      ChapterGenerationSchema
    );
    expect(result.emoji).toBe("🌱");
    expect(result.top_domains).toEqual([]);
    expect(result.friends).toEqual([]);
    expect(result.breakthrough_text).toBeNull();
  });
});

describe("safeParseAIResponse", () => {
  it("returns the parsed value on success", () => {
    const result = safeParseAIResponse(
      JSON.stringify({ pulse: "Rafael is narrating rescue missions.", summary: "A good stretch." }),
      WhatThisMeansSchema
    );
    expect(result?.summary).toBe("A good stretch.");
  });

  it("returns null instead of throwing", () => {
    expect(safeParseAIResponse("not json", WhatThisMeansSchema)).toBeNull();
    expect(safeParseAIResponse("{}", WhatThisMeansSchema)).toBeNull();
  });
});
