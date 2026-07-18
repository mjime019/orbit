import type { AgeBand } from "./age";

// Age-banded "seed the file" questions, parent-voiced. Keys map to the
// merge logic in /api/parent/onboarding/complete; categories map to
// extraction rules in buildOnboardingExtractionPrompt.

export interface OnboardingQuestion {
  key: string;
  category: string;
  question: (name: string) => string;
  subtext?: string;
  placeholder: string;
}

const INFANT: OnboardingQuestion[] = [
  {
    key: "temperament",
    category: "temperament",
    question: (n) => `How would you describe ${n}'s temperament these days?`,
    subtext: "Easygoing, intense, watchful, sunny — in your words.",
    placeholder: "He's mostly...",
  },
  {
    key: "interests",
    category: "interests",
    question: (n) => `What makes ${n} light up right now?`,
    subtext: "Faces, sounds, textures, games, the dog walking by...",
    placeholder: "He loves...",
  },
  {
    key: "social",
    category: "social",
    question: (n) => `What reliably soothes ${n} — and what winds him up?`,
    placeholder: "He calms down when...",
  },
  {
    key: "routines",
    category: "routines",
    question: (n) => `Walk me through ${n}'s typical day.`,
    subtext: "Sleep, feeds, the golden hours, the hard hours.",
    placeholder: "Mornings usually start...",
  },
  {
    key: "sensitivities",
    category: "sensitivities",
    question: (n) => `Anything that overwhelms ${n} or that you're keeping an eye on?`,
    subtext: "Sounds, foods so far, being overtired...",
    placeholder: "He gets overwhelmed when...",
  },
  {
    key: "family",
    category: "family",
    question: (n) => `Who's in ${n}'s daily world?`,
    subtext: "Brothers, grandparents, languages at home, pets.",
    placeholder: "At home we...",
  },
  {
    key: "values",
    category: "values",
    question: (n) => `When you watch ${n}, what do you see? What do you hope for him?`,
    placeholder: "I see...",
  },
];

const TODDLER: OnboardingQuestion[] = [
  {
    key: "interests",
    category: "interests",
    question: (n) => `What is ${n} obsessed with right now?`,
    placeholder: "He loves...",
  },
  {
    key: "language",
    category: "language",
    question: (n) => `What's ${n}'s talking like these days?`,
    subtext: "Words, little phrases, things he says that crack you up.",
    placeholder: "He says...",
  },
  {
    key: "challenges",
    category: "challenges",
    question: (n) => `What's hard for ${n} right now?`,
    subtext: "Transitions, sharing, big feelings — whatever you're seeing.",
    placeholder: "He struggles when...",
  },
  {
    key: "social",
    category: "social",
    question: (n) => `How does ${n} play — and what helps when things fall apart?`,
    placeholder: "With other kids he...",
  },
  {
    key: "sensitivities",
    category: "sensitivities",
    question: () => `Any sensitivities we should know about?`,
    subtext: "Food, noise, textures, fears.",
    placeholder: "He's sensitive to...",
  },
  {
    key: "routines",
    category: "routines",
    question: (n) => `What does ${n}'s day look like?`,
    placeholder: "Naps at...",
  },
  {
    key: "family",
    category: "family",
    question: (n) => `Who's in ${n}'s daily world?`,
    placeholder: "At home we...",
  },
  {
    key: "values",
    category: "values",
    question: (n) => `What do you see in ${n}? What matters most to you in raising him?`,
    placeholder: "I see...",
  },
];

const PRESCHOOL: OnboardingQuestion[] = [
  {
    key: "interests",
    category: "interests",
    question: (n) => `What is ${n} into right now?`,
    subtext: "The obsessions, the games he invents, what he'd do all day if allowed.",
    placeholder: "He's obsessed with...",
  },
  {
    key: "social",
    category: "social",
    question: (n) => `How does ${n} play with other kids — and what helps when it goes sideways?`,
    placeholder: "He usually...",
  },
  {
    key: "challenges",
    category: "challenges",
    question: (n) => `What's genuinely hard for ${n} right now?`,
    placeholder: "He has a tough time when...",
  },
  {
    key: "goals",
    category: "goals",
    question: (n) => `What do you hope ${n} grows into this year?`,
    subtext: "Skills, confidence, friendships — what would make you proud?",
    placeholder: "I'd love to see him...",
  },
  {
    key: "sensitivities",
    category: "sensitivities",
    question: () => `Any sensitivities — food, sensory, emotional?`,
    placeholder: "He's sensitive to...",
  },
  {
    key: "routines",
    category: "routines",
    question: (n) => `What does ${n}'s day look like outside school?`,
    placeholder: "After school he...",
  },
  {
    key: "family",
    category: "family",
    question: (n) => `Who's in ${n}'s world at home?`,
    placeholder: "At home we...",
  },
  {
    key: "values",
    category: "values",
    question: (n) => `What do you see in ${n}? What matters most in how you're raising him?`,
    placeholder: "I see a kid who...",
  },
];

const SCHOOL_AGE: OnboardingQuestion[] = [
  {
    key: "interests",
    category: "interests",
    question: (n) => `What is ${n} into right now?`,
    subtext: "Sports, characters, building, drawing — the current obsessions.",
    placeholder: "He's all about...",
  },
  {
    key: "school",
    category: "school",
    question: (n) => `How does ${n} feel about school?`,
    subtext: "What lights him up there, what drags.",
    placeholder: "He loves... but...",
  },
  {
    key: "social",
    category: "social",
    question: (n) => `Tell me about ${n}'s friendships.`,
    placeholder: "His best friend is...",
  },
  {
    key: "challenges",
    category: "challenges",
    question: (n) => `What's genuinely hard for ${n} right now?`,
    placeholder: "He struggles with...",
  },
  {
    key: "goals",
    category: "goals",
    question: (n) => `What do you hope this year holds for ${n}?`,
    placeholder: "I'd love to see him...",
  },
  {
    key: "sensitivities",
    category: "sensitivities",
    question: () => `Any sensitivities we should know about?`,
    placeholder: "He's sensitive to...",
  },
  {
    key: "routines",
    category: "routines",
    question: (n) => `What does ${n}'s week look like outside school?`,
    placeholder: "Weekdays he...",
  },
  {
    key: "values",
    category: "values",
    question: (n) => `What do you see in ${n}? What kind of person is he becoming?`,
    placeholder: "I see...",
  },
];

const BY_BAND: Record<AgeBand, OnboardingQuestion[]> = {
  infant: INFANT,
  toddler: TODDLER,
  preschool: PRESCHOOL,
  "school-age": SCHOOL_AGE,
};

export function questionsForBand(band: AgeBand): OnboardingQuestion[] {
  return BY_BAND[band];
}

export const MIN_ANSWERS = 3;
