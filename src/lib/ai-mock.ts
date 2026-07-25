/**
 * Mock AI response generator for local development (opt-in via AI_MODE=mock).
 *
 * Routed by explicit PromptType — never by sniffing prompt text. Each branch
 * analyzes the user message (teacher note, transcript, observation JSON) to
 * produce context-aware responses — not random garbage. The contract tests
 * verify every JSON branch parses through the same schema the routes use.
 */

import type {
  DevDomain,
  SocialTag,
  ObservationExtraction,
  HighlightGeneration,
  DigestGeneration,
  OnboardingExtraction,
} from "./types";
import type { PromptType } from "./prompts";

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
    "Felipe",
    "Rafael",
  ];
  return commonNames.filter((name) => text.includes(name));
}

function firstSentences(text: string, count: number): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  return sentences
    ? sentences.slice(0, count).join(" ").trim()
    : text.slice(0, 180).trim();
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

// ─── Round 2/3 mock generators ──────────────────────────────────

/** Family-mode chat: plain text grounded in the names from the prompt. */
function mockFamilyChat(systemPrompt: string, parentMessage: string): string {
  const match = systemPrompt.match(
    /Orbit, (\w+)'s family concierge for their son (\w+)/
  );
  const parentName = match?.[1] ?? "there";
  const childName = match?.[2] ?? "your kid";
  const lower = parentMessage.toLowerCase();

  if (lower.includes("bedtime") || lower.includes("sleep")) {
    return `Rough bedtimes are so common at this age, ${parentName}. Based on what you've captured, ${childName} settles best when the wind-down is predictable — same order, same words, no surprises. Try moving the last screen or wild play 30 minutes earlier and keeping one small choice in his hands (which book, which pajamas).\n\nIf tonight goes sideways anyway, capture what happened — a few nights of notes usually shows the pattern.`;
  }
  if (lower.includes("weekend") || lower.includes("activit") || lower.includes("do today")) {
    return `Based on ${childName}'s recent moments, I'd lean into whatever he's been building or pretending lately — give it more room rather than introducing something brand new. Keep it low-stakes and let him lead.\n\nWant me to put together a few concrete ideas in the planner?`;
  }
  return `Good question, ${parentName}. Going from what's in ${childName}'s file and the recent moments you've captured, things are trending well — he keeps coming back to the same interests, which is exactly how depth builds at this age.\n\nIs there a specific moment or worry behind the question? The more specific you get, the more useful I can be.`;
}

/** Multi-child capture extraction: split the transcript across the roster. */
function mockMultiChildExtraction(systemPrompt: string, transcript: string) {
  const rosterMatch = systemPrompt.match(/THESE children only: ([^\n]+?)\./);
  const roster = (rosterMatch?.[1] ?? "")
    .split(",")
    .map((s) => s.replace(/\(age [^)]*\)/g, "").trim())
    .filter(Boolean);

  const sentences = transcript.match(/[^.!?]+[.!?]+/g) ?? [transcript];
  const children = [];
  for (const name of roster) {
    const mentioned = sentences.filter((s) =>
      s.toLowerCase().includes(name.toLowerCase())
    );
    if (mentioned.length === 0) continue;
    const text = mentioned.slice(0, 3).join(" ").trim();
    children.push({
      name,
      observation_summary: text,
      domains: detectDomains(text),
      social_moments: [],
      direct_quotes: extractQuote(text) ? [extractQuote(text) as string] : [],
      other_kids_involved: roster.filter(
        (other) => other !== name && text.includes(other)
      ),
      notable: /first time|never|finally|breakthrough/i.test(text),
      notable_reason: /first time|never|finally|breakthrough/i.test(text)
        ? "Sounds like something new for him"
        : null,
    });
  }
  // Dev ergonomics: a transcript with no roster names shouldn't dead-end the
  // review screen — attribute it to the first child so the flow stays alive.
  if (children.length === 0 && roster.length > 0) {
    children.push({
      name: roster[0],
      observation_summary: firstSentences(transcript, 2),
      domains: detectDomains(transcript),
      social_moments: [],
      direct_quotes: [],
      other_kids_involved: [],
      notable: false,
      notable_reason: null,
    });
  }

  return {
    children,
    day_summary: firstSentences(transcript, 2),
    themes: detectDomains(transcript).slice(0, 2),
  };
}

/** Capture follow-up questions referencing the roster names. */
function mockCaptureFollowup(systemPrompt: string) {
  const namesMatch = systemPrompt.match(/richer details about ([^\n]+?)\.\n/);
  const names = (namesMatch?.[1] ?? "")
    .split(" and ")
    .map((s) => s.replace(/\(age [^)]*\)/g, "").trim())
    .filter(Boolean);

  const followups = names.slice(0, 2).map((name) => ({
    question: `You mentioned ${name} — was there a moment where he said or did something that surprised you?`,
    about_child: name.toLowerCase(),
    reason: "Surfacing specifics worth keeping",
  }));
  if (followups.length === 0) {
    followups.push({
      question: "Was there a specific moment today that stood out?",
      about_child: "general",
      reason: "Getting specific observations",
    });
  }
  return {
    followups,
    open_close:
      "Anything else notable — new, exciting, or challenging — that we haven't covered?",
  };
}

/** "What this means" home-page summary: pulse + short narrative. */
function mockWhatThisMeans(systemPrompt: string, observationsText: string) {
  const childName =
    systemPrompt.match(/observations about (\w+) \(/)?.[1] ?? "He";
  const domains = detectDomains(observationsText);
  const domainPhrase: Partial<Record<DevDomain, string>> = {
    language: "finding bigger words for what he's doing",
    motor_fine: "working with his hands on precise little projects",
    motor_gross: "moving big — climbing, running, testing his body",
    social_emotional: "navigating friendships and big feelings",
    cognitive: "puzzling out how things work",
    creative: "deep in pretend worlds of his own making",
  };
  const thread = domainPhrase[domains[0]] ?? "exploring on his own terms";
  return {
    pulse: `${childName}'s been ${thread} lately.`,
    summary: `Across the recent moments, ${childName} keeps coming back to the same thread — ${thread}. That kind of repetition is how depth builds at this age, so giving it more room is the move right now.`,
  };
}

/** A full journey chapter derived from the observation window. */
function mockChapter(systemPrompt: string, observationsText: string) {
  const childName =
    systemPrompt.match(/chapter of (\w+)'s growth journey/)?.[1] ?? "he";
  const period =
    systemPrompt.match(/Chapter period: ([^\n]+)/)?.[1]?.trim() ?? "This season";
  const ageLabel =
    systemPrompt.match(/growth journey \(([^)]+?) old\)/)?.[1] ?? "";
  const domains = detectDomains(observationsText);
  const quote = extractQuote(observationsText);
  const friends = extractNames(observationsText).filter((n) => n !== childName);

  return {
    period,
    age_label: ageLabel,
    title: `${childName} Finds His Groove`,
    emoji: "🌱",
    top_domains: domains.slice(0, 3),
    summary: `This stretch was about ${childName} settling into his own rhythm. The same interests kept resurfacing and going deeper each time, and the moments his parents and teachers captured show him more willing to stick with hard things.${quote ? ` His own words tell it best: "${quote}".` : ""}`,
    highlight_text: firstSentences(observationsText.replace(/^\[[^\]]*\]\s*(\([^)]*\)\s*)?/gm, ""), 1),
    highlight_icon: "✨",
    breakthrough_text: null,
    breakthrough_icon: null,
    emerging: domains.slice(0, 2).map((d) => `More confident ${d.replace("_", " ")} play`),
    friends,
    parent_note: `Keep capturing the small stuff — the pattern across these moments is where ${childName}'s story lives.`,
  };
}

/** Planner mocks: one per kind, shaped exactly like the prompt contract. */
function plannerAnchor(systemPrompt: string): string {
  const match = systemPrompt.match(/interests?:?\s*([^\n]+)/i);
  const first = match?.[1]?.split(",")[0]?.trim();
  return first && first.length < 60 ? first.toLowerCase() : "building things";
}

function mockPlannerActivity(systemPrompt: string) {
  const childName =
    systemPrompt.match(/at-home activities for (\w+)/)?.[1] ?? "him";
  const anchor = plannerAnchor(systemPrompt);
  return [
    {
      title: "Cardboard construction site",
      why_it_fits: `Because ${childName}'s been into ${anchor}, a pile of boxes and tape gives that same drive a bigger canvas.`,
      materials: ["cardboard boxes", "painter's tape", "markers"],
      time_minutes: 30,
      energy: "medium",
      domains: ["motor_fine", "creative"],
    },
    {
      title: "Kitchen helper night",
      why_it_fits: `${childName} gets real jobs with real stakes — pouring and measuring feed the same focus he's been showing.`,
      materials: ["measuring cups", "a simple recipe"],
      time_minutes: 25,
      energy: "calm",
      domains: ["cognitive", "motor_fine"],
    },
    {
      title: "Flashlight story cave",
      why_it_fits: `A blanket fort plus a flashlight turns wind-down time into story time on ${childName}'s terms.`,
      materials: ["blankets", "flashlight", "favorite books"],
      time_minutes: 20,
      energy: "calm",
      domains: ["language", "creative"],
    },
    {
      title: "Backyard obstacle course",
      why_it_fits: `Big-body play that ${childName} can redesign himself each round — he sets the rules, he runs it.`,
      materials: ["pillows", "chairs", "a timer"],
      time_minutes: 30,
      energy: "wild",
      domains: ["motor_gross", "cognitive"],
    },
  ];
}

function mockPlannerWeekend() {
  return [
    {
      title: "Morning at the bay park",
      where: "A shaded waterfront park",
      why_it_works_for_the_crew: "The big boys can run the open field while the baby gets stroller shade — everyone's outside, nobody's melting.",
      timing_tip: "Go right after breakfast, home before the midday heat and nap window.",
      backup_if_rains: "Children's museum early, before the rainy-day crowd arrives.",
    },
    {
      title: "Library + splash pad combo",
      where: "Neighborhood library, then the nearest splash pad",
      why_it_works_for_the_crew: "Story time settles everyone, then the splash pad burns the wiggles — the baby watches from shade.",
      timing_tip: "Library first while everyone's fresh; splash pad crowds thin before noon.",
      backup_if_rains: "Stay for the library's craft corner and call it a win.",
    },
    {
      title: "Farmers market snack tour",
      where: "A weekend farmers market",
      why_it_works_for_the_crew: "Each boy picks one snack — a mission for the big kids, sights and sounds for the baby, groceries for you.",
      timing_tip: "Arrive at opening; stroller lanes are clear for the first hour.",
      backup_if_rains: "Grocery-store snack tour with the same one-pick-each rule.",
    },
  ];
}

function mockPlannerExtracurricular(systemPrompt: string) {
  const childName =
    systemPrompt.match(/worth exploring for (\w+)/)?.[1] ?? "him";
  return [
    {
      category: "Swim lessons",
      why_now: `At his age, water confidence is the highest-value skill there is — and ${childName}'s comfort with new challenges suggests he's ready.`,
      readiness_signs: ["Comfortable getting his face wet", "Follows two-step instructions"],
      questions_to_ask_providers: [
        "What's the instructor-to-kid ratio in the water?",
        "How do you handle a kid who's hesitant that day?",
      ],
      try_before_committing: "One drop-in family swim session before signing up for a series.",
    },
    {
      category: "Intro soccer",
      why_now: `${childName}'s big-body energy and interest in games with rules point at low-key team play.`,
      readiness_signs: ["Runs and kicks with control", "Handles taking turns"],
      questions_to_ask_providers: [
        "Is it skills-and-fun or competitive at this age?",
        "What happens when a kid wanders off mid-drill?",
      ],
      try_before_committing: "A free trial class or just a pickup kickaround at the park with friends.",
    },
  ];
}

/** Report ingestion: parent-language reading of an uploaded school report. */
function mockReportIngestion(systemPrompt: string, userMessage: string) {
  const childName = systemPrompt.match(/about their son (\w+)/)?.[1] ?? "him";
  const title = userMessage.match(/This is "([^"]+)"/)?.[1] ?? "the report";
  return {
    summary: `${title} paints ${childName} as engaged and well-settled (mock reading — AI_MODE=mock). His teachers describe steady focus during hands-on work and warm connections with classmates.`,
    strengths: ["Sustained focus on hands-on projects", "Kind with classmates"],
    growth_areas: ["Practicing patience during transitions"],
    notable_quotes: [],
    suggested_file_updates: {
      school_notes: `Per ${title}: settled in well, engaged during hands-on work.`,
    },
  };
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Generate a mock AI response for an explicit prompt type. The exhaustive
 * switch means adding a PromptType without a mock branch is a compile error.
 */
export function generateMockResponse(
  promptType: PromptType,
  systemPrompt: string,
  userMessage: string
): string {
  switch (promptType) {
    case "observation_extraction":
      return JSON.stringify(mockExtraction(userMessage));
    case "highlight":
      return JSON.stringify(mockHighlight(systemPrompt, userMessage));
    case "digest":
      return JSON.stringify(mockDigest(systemPrompt, userMessage));
    case "onboarding_extraction":
      return JSON.stringify(mockOnboardingExtraction(systemPrompt, userMessage));
    case "activity_personalization":
      // Plain text, not JSON
      return mockActivityPersonalization(systemPrompt, userMessage);
    case "concierge_chat":
      // Plain text, not JSON
      return mockConciergeResponse(systemPrompt, userMessage);
    case "family_chat":
      // Plain text, not JSON
      return mockFamilyChat(systemPrompt, userMessage);
    case "multi_child_extraction":
      return JSON.stringify(mockMultiChildExtraction(systemPrompt, userMessage));
    case "capture_followup":
      return JSON.stringify(mockCaptureFollowup(systemPrompt));
    case "what_this_means":
      return JSON.stringify(mockWhatThisMeans(systemPrompt, userMessage));
    case "chapter":
      return JSON.stringify(mockChapter(systemPrompt, userMessage));
    case "planner_activity":
      return JSON.stringify(mockPlannerActivity(systemPrompt));
    case "planner_weekend":
      return JSON.stringify(mockPlannerWeekend());
    case "planner_extracurricular":
      return JSON.stringify(mockPlannerExtracurricular(systemPrompt));
    case "report_ingestion":
      return JSON.stringify(mockReportIngestion(systemPrompt, userMessage));
  }
}
