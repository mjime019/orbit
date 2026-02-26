/**
 * Mock AI response generator for development when Gemini API is unavailable.
 *
 * Uses seed-data patterns as templates. The mock analyzes the user message
 * (which contains the teacher's note or observation JSON) to produce
 * context-aware responses — not random garbage.
 */

import type {
  DevDomain,
  SocialTag,
  ObservationExtraction,
  HighlightGeneration,
  DigestGeneration,
  OnboardingExtraction,
} from "./types";

// ─── Keyword → Domain mapping ──────────────────────────────────
const DOMAIN_KEYWORDS: Record<DevDomain, string[]> = {
  language: [
    "said",
    "told",
    "word",
    "letter",
    "sentence",
    "story",
    "read",
    "write",
    "spoke",
    "language",
    "talk",
    "talking",
    "described",
    "explained",
    "asked",
    "named",
    "vocabulary",
    "tense",
    "past tense",
    "morning circle",
  ],
  motor_fine: [
    "built",
    "drew",
    "cut",
    "glue",
    "write",
    "wrote",
    "letter",
    "paint",
    "painted",
    "popsicle",
    "stick",
    "scissors",
    "bead",
    "thread",
    "pencil",
    "crayon",
    "traced",
    "puzzle",
    "stacked",
    "poured",
  ],
  motor_gross: [
    "ran",
    "jump",
    "climb",
    "hop",
    "kick",
    "throw",
    "catch",
    "balance",
    "swing",
    "slide",
    "dance",
    "gallop",
    "skip",
    "tumble",
    "obstacle",
    "playground",
    "outdoor",
  ],
  social_emotional: [
    "shared",
    "helped",
    "friend",
    "together",
    "invited",
    "cooperat",
    "conflict",
    "angry",
    "calm",
    "breath",
    "regulated",
    "hug",
    "comfort",
    "took turns",
    "new child",
    "new kid",
    "joined",
    "organized",
    "assigned",
    "recruited",
    "frustrated",
    "okay",
    "fix it",
    "sorry",
  ],
  cognitive: [
    "count",
    "number",
    "pattern",
    "sorted",
    "measured",
    "more",
    "less",
    "volume",
    "problem",
    "figure",
    "reason",
    "because",
    "if",
    "bridge",
    "balance",
    "adjust",
    "design",
    "plan",
    "museum",
    "poured",
    "container",
  ],
  creative: [
    "paint",
    "drew",
    "color",
    "imagin",
    "pretend",
    "rocket",
    "story",
    "dinosaur museum",
    "submarine",
    "spaceship",
    "song",
    "dance",
    "art",
    "cardboard",
    "craft",
    "mixed",
    "collage",
    "role",
    "play",
  ],
};

const SOCIAL_KEYWORDS: Record<SocialTag, string[]> = {
  helped: ["helped", "showed", "gave", "find the right", "comfort"],
  led: ["organized", "recruited", "assigned", "directed", "told everyone"],
  regulated: [
    "breath",
    "calm",
    "it's okay",
    "fix it",
    "frustrated",
    "paused",
    "deep breath",
    "without crying",
  ],
  played_with: [
    "together",
    "with Mia",
    "with Leo",
    "shared",
    "invited",
    "cooperat",
    "joined",
  ],
  conflict: ["argued", "disagreed", "conflict", "upset", "mad", "fight"],
  breakthrough: [
    "first time",
    "never before",
    "new",
    "finally",
    "breakthrough",
    "independently",
  ],
};

// ─── Helpers ────────────────────────────────────────────────────

function detectDomains(text: string): DevDomain[] {
  const lower = text.toLowerCase();
  const found: DevDomain[] = [];

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      found.push(domain as DevDomain);
    }
  }

  // Always return at least one domain
  if (found.length === 0) found.push("cognitive");
  return [...new Set(found)].slice(0, 3);
}

function detectSocialTag(text: string): SocialTag | null {
  const lower = text.toLowerCase();

  for (const [tag, keywords] of Object.entries(SOCIAL_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return tag as SocialTag;
    }
  }
  return null;
}

function extractQuote(text: string): string | null {
  // Find text in quotes — teacher often quotes the child
  const match = text.match(/"([^"]{5,})"/);
  return match ? match[1] : null;
}

function extractNames(text: string): string[] {
  const commonNames = [
    "Mia",
    "Leo",
    "Ava",
    "Sofia",
    "Ethan",
    "Noah",
    "Olivia",
    "Emma",
    "Marcus",
    "Lily",
  ];
  return commonNames.filter((name) => text.includes(name));
}

function extractChildName(systemPrompt: string): string {
  const match = systemPrompt.match(/Name:\s*(\w+)/);
  return match ? match[1] : "the child";
}

// ─── Mock Generators ────────────────────────────────────────────

/** Generate mock observation extraction from a teacher's note */
function mockExtraction(note: string): ObservationExtraction {
  const domains = detectDomains(note);
  const socialTag = detectSocialTag(note);
  const keyQuote = extractQuote(note);
  const otherChildren = extractNames(note);

  // Build a clean summary preserving teacher voice
  let summary = note;
  if (note.length > 200) {
    // Take the first two sentences
    const sentences = note.match(/[^.!?]+[.!?]+/g);
    summary = sentences ? sentences.slice(0, 2).join("").trim() : note.slice(0, 180) + "...";
  }

  return {
    domains,
    social_tag: socialTag,
    other_children: otherChildren,
    key_quote: keyQuote,
    summary,
    clarification_needed: null,
  };
}

/** Generate mock highlight from observations JSON */
function mockHighlight(
  systemPrompt: string,
  observationsJson: string
): HighlightGeneration {
  const childName = extractChildName(systemPrompt);

  // Parse observations from user message
  let observations: { note: string; domains?: string[]; social_tag?: string }[] = [];
  try {
    observations = JSON.parse(observationsJson);
  } catch {
    // If it's not valid JSON, treat it as a single note
    observations = [{ note: observationsJson }];
  }

  const allText = observations.map((o) => o.note).join(" ");
  const domains = detectDomains(allText);
  const socialTag = detectSocialTag(allText);
  const keyQuote = extractQuote(allText);
  const otherChildren = extractNames(allText);

  // Seed-data-style titles (short, evocative)
  const titleTemplates = [
    "The Little Engineer",
    "Words and Wonders",
    "Building Connections",
    "Creative Spark",
    "Growing Confidence",
    "A New Discovery",
    "Team Player",
    "Storyteller at Heart",
    "Problem Solver",
    "The Big Moment",
  ];

  // Pick a title based on primary domain
  const domainTitleMap: Partial<Record<DevDomain, string[]>> = {
    cognitive: ["The Little Engineer", "Problem Solver", "A New Discovery"],
    creative: ["Creative Spark", "Storyteller at Heart", "Colorful Imagination"],
    language: ["Words and Wonders", "Storyteller at Heart", "Finding the Words"],
    social_emotional: ["Building Connections", "Team Player", "Growing Confidence"],
    motor_fine: ["Steady Hands", "The Little Engineer", "Careful Crafting"],
    motor_gross: ["On the Move", "Full of Energy", "Big Body Play"],
  };

  const primaryDomain = domains[0];
  const titleOptions = domainTitleMap[primaryDomain] ?? titleTemplates;
  const title = titleOptions[Math.floor(Math.random() * titleOptions.length)];

  // Build a seed-data-style narrative
  const firstNote = observations[0]?.note ?? "exploring and learning";
  const quoteClause = keyQuote ? ` — "${keyQuote}"` : "";
  const peerClause =
    otherChildren.length > 0
      ? ` ${childName} was working alongside ${otherChildren.join(" and ")}, showing how naturally social learning unfolds.`
      : "";

  const content =
    `${childName} had a wonderful moment today. ${firstNote.charAt(0).toUpperCase() + firstNote.slice(1)}${quoteClause}.` +
    `${peerClause}` +
    ` The way ${childName} approaches these moments shows real growth — connecting ideas, staying engaged, and building confidence along the way.`;

  const summary = `${childName} showed focus and creativity during today's activities.`;

  return {
    title,
    content,
    summary,
    domains,
    social_tags: socialTag ? [socialTag] : [],
  };
}

/** Generate mock weekly digest from observations + highlights JSON */
function mockDigest(
  systemPrompt: string,
  dataJson: string
): DigestGeneration {
  const childName = extractChildName(systemPrompt);

  let data: {
    observations?: { note: string; domains?: string[] }[];
    highlights?: { title: string; content: string }[];
  } = {};
  try {
    data = JSON.parse(dataJson);
  } catch {
    data = { observations: [], highlights: [] };
  }

  const observations = data.observations ?? [];
  const highlights = data.highlights ?? [];
  const obsCount = observations.length;

  const allText =
    observations.map((o) => o.note).join(" ") +
    " " +
    highlights.map((h) => h.content).join(" ");
  const domains = detectDomains(allText);

  // Seed-data-style digest (narrative arc of the week)
  const highlightMentions =
    highlights.length > 0
      ? highlights
          .slice(0, 3)
          .map((h) => h.title)
          .join(", ")
      : "many small moments of growth";

  const content =
    `What a week for ${childName}! This week featured ${highlightMentions}, ` +
    `woven together across ${obsCount} observed moments. ` +
    `${childName} showed real engagement this week — staying focused on projects, ` +
    `connecting ideas across activities, and building stronger relationships with peers. ` +
    `We're seeing a wonderful pattern of curiosity-driven learning, where ${childName}'s ` +
    `own interests are leading the way. ` +
    `Looking forward to building on this momentum next week.`;

  return {
    title: `${childName}'s Week: ${highlightMentions}`,
    content,
    domains_covered: [...new Set(domains)].slice(0, 4),
    observation_count: obsCount,
  };
}

/** Generate mock onboarding extraction from a parent's natural-language response */
function mockOnboardingExtraction(
  systemPrompt: string,
  parentResponse: string
): OnboardingExtraction {
  const lower = parentResponse.toLowerCase();

  // Detect category from system prompt
  const categoryMatch = systemPrompt.match(/CATEGORY:\s*(\w+)/);
  const category = categoryMatch ? categoryMatch[1] : "interests";

  const extracted: Record<string, unknown> = {};

  switch (category) {
    case "interests": {
      // Pull keywords that sound like interests
      const words = parentResponse.split(/[,.\n]+/).map((s) => s.trim()).filter(Boolean);
      extracted.current_interests = words.slice(0, 3).map((w) =>
        w.length > 40 ? w.slice(0, 40) : w
      );
      extracted.emerging_interests = words.length > 3
        ? words.slice(3, 5).map((w) => w.length > 40 ? w.slice(0, 40) : w)
        : ["exploring new materials"];
      break;
    }
    case "challenges": {
      extracted.growing_edges = lower.includes("share")
        ? ["Taking turns with peers"]
        : lower.includes("transition")
        ? ["Managing transitions"]
        : ["Building independence"];
      extracted.emotional_triggers = lower.includes("loud")
        ? ["Startled by sudden loud noises"]
        : lower.includes("separ")
        ? ["Separation at drop-off"]
        : [];
      break;
    }
    case "goals": {
      const sentences = parentResponse.match(/[^.!?]+[.!?]*/g) ?? [parentResponse];
      extracted.parent_goals = sentences
        .slice(0, 3)
        .map((s) => s.trim())
        .filter((s) => s.length > 5);
      break;
    }
    case "sensitivities": {
      extracted.food = lower.includes("allerg") || lower.includes("nut")
        ? ["Tree nut allergy"]
        : [];
      extracted.sensory = lower.includes("loud") || lower.includes("noise")
        ? ["Sensitive to sudden loud noises"]
        : [];
      extracted.emotional = lower.includes("dark") || lower.includes("scar")
        ? ["Afraid of the dark"]
        : [];
      break;
    }
    case "social": {
      extracted.play_style = lower.includes("lead") || lower.includes("organiz")
        ? "leader"
        : lower.includes("watch") || lower.includes("observ")
        ? "observer"
        : lower.includes("parallel")
        ? "parallel"
        : "collaborative";
      extracted.social_notes = parentResponse.slice(0, 120);
      extracted.comfort_helps = lower.includes("hug")
        ? ["Hugs", "Quiet space"]
        : ["Reassurance from trusted adult"];
      extracted.comfort_escalates = lower.includes("forc")
        ? ["Being forced to share"]
        : [];
      break;
    }
    case "routines": {
      extracted.nap = { time: "12:30 PM", notes: "Usually 1-1.5 hours" };
      extracted.meals = { preferences: "Not picky", notes: parentResponse.slice(0, 80) };
      extracted.drop_off = { time: "8:00 AM", notes: "Smooth most days" };
      extracted.pickup = { time: "5:00 PM", notes: "" };
      break;
    }
    case "family": {
      extracted.siblings = lower.includes("sister")
        ? [{ name: "Sibling", age: "younger" }]
        : lower.includes("brother")
        ? [{ name: "Sibling", age: "older" }]
        : [];
      extracted.languages = lower.includes("spanish")
        ? ["English", "Spanish"]
        : ["English"];
      extracted.pets = lower.includes("dog")
        ? [{ type: "dog" }]
        : lower.includes("cat")
        ? [{ type: "cat" }]
        : [];
      extracted.living_situation = parentResponse.slice(0, 80);
      break;
    }
    case "values": {
      const sentences = parentResponse.match(/[^.!?]+[.!?]*/g) ?? [parentResponse];
      extracted.parent_values = sentences
        .slice(0, 3)
        .map((s) => s.trim())
        .filter((s) => s.length > 5);
      extracted.philosophy = parentResponse.slice(0, 120);
      break;
    }
    default: {
      extracted.notes = parentResponse.slice(0, 200);
    }
  }

  return {
    extracted_fields: extracted,
    confidence: parentResponse.length > 30 ? 0.88 : 0.65,
    followup_needed: parentResponse.length < 15,
    followup_question: parentResponse.length < 15
      ? "Could you tell us a little more? Even a sentence or two helps us understand better."
      : null,
  };
}

/** Generate mock "why it fits" personalization blurb for an activity */
function mockActivityPersonalization(
  systemPrompt: string,
  _activityJson: string
): string {
  const childName = extractChildName(systemPrompt);

  // Try to extract interests from system prompt
  const interestsMatch = systemPrompt.match(/Interests:\s*([^\n]+)/);
  const interests = interestsMatch
    ? interestsMatch[1].split(",").map((s) => s.trim()).filter(Boolean)
    : ["building", "exploring"];

  const interest = interests[0] ?? "exploring";

  // Try to extract activity title from user message
  let activityTitle = "this activity";
  try {
    const parsed = JSON.parse(_activityJson);
    activityTitle = parsed.title ?? parsed.name ?? "this activity";
  } catch {
    // not JSON, use as-is or fallback
    if (_activityJson.length < 100) activityTitle = _activityJson;
  }

  const blurbs = [
    `${childName} has been all about ${interest} lately, and ${activityTitle} is a perfect way to extend that curiosity at home. It builds on the kind of hands-on problem-solving we've been seeing in the classroom this week.`,
    `This is a great match for ${childName} right now. We've noticed a real spark around ${interest}, and ${activityTitle} gives that energy a new direction — plus it's the kind of thing that naturally builds focus and confidence.`,
    `After watching ${childName} dive into ${interest} at school this week, ${activityTitle} feels like a natural next step. It channels that same creative energy into something you can share together at home.`,
  ];

  return blurbs[Math.floor(Math.random() * blurbs.length)];
}

/** Generate mock concierge chat response grounded in child context */
function mockConciergeResponse(
  systemPrompt: string,
  parentMessage: string
): string {
  const childName = extractChildName(systemPrompt);
  // Extract parent name from prompt
  const parentMatch = systemPrompt.match(/concierge for (\w+)/);
  const parentName = parentMatch ? parentMatch[1] : "there";
  const lower = parentMessage.toLowerCase();

  // Socially-aware responses based on question type
  if (lower.includes("social") || lower.includes("friend") || lower.includes("play with")) {
    return `Great question, ${parentName}. From what we've been seeing this past couple weeks, ${childName} has been gravitating toward collaborative play — especially during building activities. There was a lovely moment earlier this week where ${childName} organized a group project and naturally took on a leadership role, making sure everyone had a part. That kind of social initiative is really encouraging at this age.\n\nIf you're looking to support this at home, playdates with just one or two friends where there's a shared goal (building something, a scavenger hunt) tend to bring out ${childName}'s best social instincts.`;
  }

  if (lower.includes("activit") || lower.includes("home") || lower.includes("tonight") || lower.includes("weekend")) {
    return `Based on what ${childName}'s been into this week at school, I'd suggest something hands-on and open-ended tonight. ${childName} spent a long time at the water table yesterday exploring volume and pouring, so anything with measuring cups, funnels, or containers in the bathtub or sink would be a natural extension.\n\nKeep it playful — no need to make it "educational." ${childName} will find the learning on their own when the materials are interesting enough.`;
  }

  if (lower.includes("week") || lower.includes("how") || lower.includes("doing")) {
    return `${childName}'s been having a really engaged week, ${parentName}. The classroom is in the middle of an ocean theme, and ${childName} has latched onto it — especially anything involving building underwater vehicles. We saw some wonderful problem-solving during block play, and ${childName}'s language has been on a roll too, using new vocabulary to describe what's being built.\n\nThe social piece is growing nicely as well. ${childName} invited a newer classmate to join a building project yesterday, which was a really kind and confident move.`;
  }

  if (lower.includes("classroom") || lower.includes("theme") || lower.includes("learn")) {
    return `The Sunshine Room is currently exploring an ocean and sea life theme. The teachers have set up a marine biology discovery station with shells, magnifying glasses, and ocean books. There's also a dramatic play area set up as a submarine.\n\n${childName} has been particularly drawn to the building corner, where several kids have been constructing underwater vehicles out of cardboard boxes. It's been a great blend of creative and cognitive work.`;
  }

  if (lower.includes("concern") || lower.includes("worried") || lower.includes("trouble") || lower.includes("struggle")) {
    return `I hear you, ${parentName}, and I appreciate you sharing that. Based on what we've been observing at school, ${childName} is making steady progress. Every child has their own timeline, and what matters most is that we're seeing engagement and effort.\n\nLet me share something specific that might help: this week, ${childName} worked through a tricky building challenge without getting frustrated — that's a real sign of growing resilience. If you'd like, I can keep a closer eye on this and share more detailed observations next week.`;
  }

  // Generic warm response
  return `Thanks for reaching out, ${parentName}! Based on what we've been observing with ${childName} this week, things are going really well. ${childName} has been especially engaged during the creative activities and showing wonderful curiosity during group time.\n\nIs there anything specific you'd like to know more about? I'm happy to dig into the details of any particular area — social interactions, what ${childName}'s been learning, or ideas for extending the school experience at home.`;
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Generate a mock AI response based on the system prompt type.
 * Detects which prompt template is being used and returns the
 * appropriate JSON structure.
 */
export function generateMockResponse(
  systemPrompt: string,
  userMessage: string
): string {
  // Detect which AI use case based on prompt content
  if (
    systemPrompt.includes("observation assistant") ||
    systemPrompt.includes("extract structured developmental")
  ) {
    return JSON.stringify(mockExtraction(userMessage));
  }

  if (
    systemPrompt.includes("highlight for parents") ||
    systemPrompt.includes("writing a highlight")
  ) {
    return JSON.stringify(mockHighlight(systemPrompt, userMessage));
  }

  if (
    systemPrompt.includes("weekly digest") ||
    systemPrompt.includes("writing a weekly digest")
  ) {
    return JSON.stringify(mockDigest(systemPrompt, userMessage));
  }

  if (
    systemPrompt.includes("onboarding intake") ||
    systemPrompt.includes("Orbit onboarding")
  ) {
    return JSON.stringify(mockOnboardingExtraction(systemPrompt, userMessage));
  }

  if (
    systemPrompt.includes("Why It Fits") ||
    systemPrompt.includes("why it fits")
  ) {
    // Activity personalization returns plain text, not JSON
    return mockActivityPersonalization(systemPrompt, userMessage);
  }

  if (
    systemPrompt.includes("Orbit concierge") ||
    systemPrompt.includes("navigate early childhood")
  ) {
    // Concierge returns plain text, not JSON
    return mockConciergeResponse(systemPrompt, userMessage);
  }

  // Fallback: return the extraction mock (safest default)
  console.warn("[AI Mock] Unknown prompt type, falling back to extraction mock");
  return JSON.stringify(mockExtraction(userMessage));
}
