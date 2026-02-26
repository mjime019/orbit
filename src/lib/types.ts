export type DevDomain =
  | "language"
  | "motor_fine"
  | "motor_gross"
  | "social_emotional"
  | "cognitive"
  | "creative";

export type SocialTag =
  | "helped"
  | "led"
  | "regulated"
  | "played_with"
  | "conflict"
  | "breakthrough";

export type HighlightStatus = "draft" | "approved" | "sent";

export type CalendarEventType =
  | "no_school"
  | "half_day"
  | "spirit"
  | "special"
  | "birthday"
  | "field_trip"
  | "conference"
  | "extracurricular"
  | "deadline"
  | "performance";

export interface Child {
  id: string;
  name: string;
  date_of_birth: string | null;
  classroom_id: string | null;
  school_id: string | null;
}

export interface ChildProfile {
  id: string;
  child_id: string;
  interests: string[];
  emerging_interests: string[];
  play_style: string | null;
  parent_goals: string[];
  onboarding_complete: boolean;
}

export interface Observation {
  id: string;
  child_id: string;
  teacher_id: string;
  note: string;
  domains: DevDomain[];
  social_tag: SocialTag | null;
  photo_url: string | null;
  created_at: string;
}

export interface Highlight {
  id: string;
  child_id: string;
  title: string | null;
  content: string;
  summary: string | null;
  photo_url: string | null;
  domains: DevDomain[];
  social_tags: SocialTag[];
  status: HighlightStatus;
  created_at: string;
}

export interface Activity {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  domains: DevDomain[];
  materials: string[];
  time_minutes: number | null;
  energy_level: string;
}

export interface ActivityRecommendation {
  id: string;
  child_id: string;
  activity_id: string;
  why_it_fits: string | null;
  activities?: Activity;
}

export interface WeekendPlace {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  tags: string[];
  age_min: number | null;
  age_max: number | null;
  noise_level: string | null;
  cost_tier: string;
  rating: number | null;
  phone: string | null;
  hours: string | null;
  parking: string | null;
  sensory_notes: string | null;
}

export interface WeekendRecommendation {
  id: string;
  child_id: string;
  place_id: string;
  fit_score: number | null;
  fit_reason: string | null;
  weekend_places?: WeekendPlace;
}

export interface JourneyChapter {
  id: string;
  child_id: string;
  period: string;
  title: string;
  emoji: string;
  is_current: boolean;
  observation_count: number;
  top_domains: DevDomain[];
  summary: string | null;
  highlight_text: string | null;
}

export interface SchoolCalendarEvent {
  id: string;
  event_date: string;
  event_type: CalendarEventType;
  title: string;
  details: string | null;
  scope: string;
}

export interface Classroom {
  id: string;
  name: string;
  lesson_theme: string | null;
}

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: "parent" | "teacher" | "admin";
}

// Digest (weekly/daily parent-facing summaries)
export interface Digest {
  id: string;
  child_id: string;
  digest_type: "daily" | "weekly";
  period_start: string;
  period_end: string;
  title: string | null;
  content: string;
  highlight_ids: string[];
  observation_ids: string[];
  domains_covered: DevDomain[];
  status: HighlightStatus;
  created_at: string;
}

// AI generation result: highlight from observations
export interface HighlightGeneration {
  title: string;
  content: string;
  summary: string;
  domains: DevDomain[];
  social_tags: SocialTag[];
}

// AI generation result: weekly digest
export interface DigestGeneration {
  title: string;
  content: string;
  domains_covered: DevDomain[];
  observation_count: number;
}

// Onboarding prompt definition
export interface OnboardingPrompt {
  key: string;
  emoji: string;
  question: string;
  subtext: string;
  category:
    | "interests"
    | "challenges"
    | "goals"
    | "sensitivities"
    | "social"
    | "routines"
    | "family"
    | "values";
}

// AI extraction result from onboarding response
export interface OnboardingExtraction {
  extracted_fields: Record<string, unknown>;
  confidence: number;
  followup_needed: boolean;
  followup_question: string | null;
}

// Conversation (concierge chat)
export interface Conversation {
  id: string;
  child_id: string;
  parent_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

// Chat message
export interface Message {
  id: string;
  conversation_id: string;
  role: "parent" | "assistant" | "system";
  content: string;
  created_at: string;
}

// Extracurricular provider
export interface ExtracurricularProvider {
  id: string;
  school_id: string | null;
  name: string;
  category: string;
  provider: string | null;
  location: string | null;
  distance: string | null;
  price: string | null;
  price_note: string | null;
  ages: string | null;
  group_size: string | null;
  description: string | null;
  emoji: string | null;
  domains: DevDomain[];
  on_campus: boolean;
  campus_note: string | null;
  schedule: { day: string; time: string; spots_left?: number }[];
  orbit_perk: { type: string; label: string; detail: string } | null;
  why_good_fit: string[];
  why_might_not_fit: string[];
  what_to_look_for: string[];
  trial_questions: string[];
  switch_suggestions: string[];
}

// School transition target
export interface TransitionSchool {
  id: string;
  child_id: string;
  name: string;
  school_type: string | null;
  distance: string | null;
  tuition: string | null;
  style: string | null;
  languages: string[];
  class_size: number | null;
  features: string[];
  strengths: string[];
  considerations: string[];
  deadline: string | null;
  deadline_label: string | null;
  visit_date: string | null;
  applied: boolean;
  notes: string | null;
  rating_academics: number | null;
  rating_community: number | null;
  rating_fit: number | null;
}

// AI extraction result from observation text
export interface ObservationExtraction {
  domains: DevDomain[];
  social_tag: SocialTag | null;
  other_children: string[];
  key_quote: string | null;
  summary: string;
  clarification_needed: string | null;
}

export const DOMAIN_CONFIG: Record<
  string,
  { bg: string; text: string; emoji: string; label: string }
> = {
  language: {
    bg: "bg-domain-language-bg",
    text: "text-domain-language-text",
    emoji: "\u{1F4AC}",
    label: "Language",
  },
  motor_fine: {
    bg: "bg-domain-motor-bg",
    text: "text-domain-motor-text",
    emoji: "\u270B",
    label: "Fine Motor",
  },
  motor_gross: {
    bg: "bg-domain-motor-bg",
    text: "text-domain-motor-text",
    emoji: "\u{1F3C3}",
    label: "Gross Motor",
  },
  social_emotional: {
    bg: "bg-domain-social-bg",
    text: "text-domain-social-text",
    emoji: "\u{1F91D}",
    label: "Social-Emotional",
  },
  cognitive: {
    bg: "bg-domain-cognitive-bg",
    text: "text-domain-cognitive-text",
    emoji: "\u{1F9E9}",
    label: "Cognitive",
  },
  creative: {
    bg: "bg-domain-creative-bg",
    text: "text-domain-creative-text",
    emoji: "\u{1F3A8}",
    label: "Creative",
  },
};

export const SOCIAL_TAG_CONFIG: Record<string, { emoji: string; label: string }> = {
  helped: { emoji: "\u{1FAF6}", label: "Helped" },
  led: { emoji: "\u2B50", label: "Led" },
  regulated: { emoji: "\u{1F9D8}", label: "Regulated" },
  played_with: { emoji: "\u{1F91D}", label: "Played Together" },
  conflict: { emoji: "\u{1F4A1}", label: "Navigated Conflict" },
  breakthrough: { emoji: "\u{1F389}", label: "Breakthrough" },
};
