"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { OnboardingPrompt, ChildProfile } from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────────

type Screen = "welcome" | "questions" | "processing" | "review" | "done";

interface OnboardingResponse {
  promptKey: string;
  rawResponse: string;
  extractedFields: Record<string, unknown>;
  confidence: number;
}

interface Props {
  childId: string;
  childName: string;
  alreadyComplete: boolean;
  existingProfile: ChildProfile | null;
}

// ─── 8 Prompts ──────────────────────────────────────────────────

const PROMPTS: OnboardingPrompt[] = [
  {
    key: "interests",
    emoji: "\u2728",
    question: "What lights {name} up?",
    subtext:
      "Think about the things that make their eyes go wide \u2014 toys, topics, games, places. Big and small.",
    category: "interests",
  },
  {
    key: "challenges",
    emoji: "\u{1F327}\uFE0F",
    question: "What\u2019s been hard lately?",
    subtext:
      "Every kid has their growing edges. Sharing, transitions, big feelings \u2014 anything you\u2019ve been navigating together.",
    category: "challenges",
  },
  {
    key: "goals",
    emoji: "\u{1F3AF}",
    question: "What do you hope for this year?",
    subtext:
      "Not milestones \u2014 just what matters to you. Confidence? Friendships? A smoother drop-off?",
    category: "goals",
  },
  {
    key: "sensitivities",
    emoji: "\u{1F6E1}\uFE0F",
    question: "Anything we need to be careful about?",
    subtext:
      "Allergies, sensory preferences, emotional triggers \u2014 things that help us keep {name} feeling safe.",
    category: "sensitivities",
  },
  {
    key: "social",
    emoji: "\u{1F46B}",
    question: "How does {name} connect with other kids?",
    subtext:
      "Are they the organizer, the observer, the one-best-friend type? What helps when things get tricky socially?",
    category: "social",
  },
  {
    key: "routines",
    emoji: "\u{1F504}",
    question: "Walk us through a typical day.",
    subtext:
      "Wake-up, meals, nap, energy peaks and crashes \u2014 whatever helps us understand {name}\u2019s rhythm.",
    category: "routines",
  },
  {
    key: "family",
    emoji: "\u{1F3E0}",
    question: "Tell us about your world at home.",
    subtext:
      "Siblings, pets, languages spoken, living situation \u2014 anything that shapes {name}\u2019s daily life.",
    category: "family",
  },
  {
    key: "values",
    emoji: "\u{1F49B}",
    question: "What does a great preschool year look like to you?",
    subtext:
      "Your values matter. Play-based freedom? Academic readiness? Social confidence? All of the above?",
    category: "values",
  },
];

// ─── Component ──────────────────────────────────────────────────

export function OnboardingFlow({
  childId,
  childName,
  alreadyComplete,
  existingProfile,
}: Props) {
  const [screen, setScreen] = useState<Screen>(
    alreadyComplete ? "done" : "welcome"
  );
  const [currentPrompt, setCurrentPrompt] = useState(0);
  const [responses, setResponses] = useState<OnboardingResponse[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [reviewData, setReviewData] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const prompt = PROMPTS[currentPrompt];
  const answeredCount = responses.length;
  const MIN_ANSWERS = 3;

  // Auto-focus textarea on prompt change
  useEffect(() => {
    if (screen === "questions" && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [currentPrompt, screen]);

  // Replace {name} in prompt text
  const personalize = (text: string) =>
    text.replace(/\{name\}/g, childName);

  // ─── Extract a single prompt response via API ───────────────

  async function extractResponse(text: string) {
    setIsExtracting(true);
    setError(null);

    try {
      const res = await fetch("/api/parent/onboarding/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childId,
          promptKey: prompt.key,
          promptText: prompt.question.replace(/\{name\}/g, childName),
          promptCategory: prompt.category,
          response: text,
        }),
      });

      if (!res.ok) throw new Error("Extraction failed");
      const data = await res.json();

      setResponses((prev) => [
        ...prev,
        {
          promptKey: prompt.key,
          rawResponse: text,
          extractedFields: data.extracted_fields,
          confidence: data.confidence,
        },
      ]);

      // Advance to next prompt or finish
      if (currentPrompt < PROMPTS.length - 1) {
        setCurrentPrompt((p) => p + 1);
        setInputValue("");
      } else {
        // All prompts done — go to processing
        startProcessing([
          ...responses,
          {
            promptKey: prompt.key,
            rawResponse: text,
            extractedFields: data.extracted_fields,
            confidence: data.confidence,
          },
        ]);
      }
    } catch {
      setError("Something went wrong. Try again?");
    } finally {
      setIsExtracting(false);
    }
  }

  // ─── Processing animation + complete API call ──────────────

  function startProcessing(allResponses: OnboardingResponse[]) {
    setScreen("processing");
    setProcessingStep(0);

    const steps = [
      { delay: 600 },
      { delay: 1200 },
      { delay: 1800 },
    ];

    steps.forEach((step, i) => {
      setTimeout(() => setProcessingStep(i + 1), step.delay);
    });

    // After animation, call the complete API
    setTimeout(async () => {
      try {
        const res = await fetch("/api/parent/onboarding/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            childId,
            responses: allResponses.map((r) => ({
              promptKey: r.promptKey,
              rawResponse: r.rawResponse,
              extractedFields: r.extractedFields,
            })),
          }),
        });

        if (!res.ok) throw new Error("Complete failed");
        const data = await res.json();
        setReviewData(data.profile ?? {});
        setScreen("review");
      } catch {
        setError("Failed to save profile. Please try again.");
        setScreen("questions");
      }
    }, 2800);
  }

  // ─── Skip to finish (when >=3 answers) ────────────────────

  function finishEarly() {
    startProcessing(responses);
  }

  // ─── Render Screens ───────────────────────────────────────

  // WELCOME
  if (screen === "welcome") {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-6">
        <div className="max-w-[480px] w-full text-center fade-up">
          <div className="text-6xl mb-6">{"\u{1F30D}"}</div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold text-espresso mb-3">
            Welcome to Orbit
          </h1>
          <p className="text-warm-gray text-lg mb-2">
            Let&apos;s get to know{" "}
            <span className="text-espresso font-semibold">{childName}</span>
          </p>
          <p className="text-warm-gray text-sm mb-8 leading-relaxed">
            We&apos;ll ask a few warm-up questions about {childName}&apos;s
            world &mdash; interests, routines, what makes them tick. This helps
            us personalize everything from daily highlights to activity
            recommendations.
          </p>
          <p className="text-warm-gray/60 text-xs mb-6">
            Takes about 5 minutes &bull; Skip any question &bull; Come back
            anytime
          </p>
          <button
            onClick={() => setScreen("questions")}
            className="bg-rust text-white font-semibold px-8 py-3.5 rounded-xl text-lg hover:bg-rust/90 transition-colors shadow-sm"
          >
            Let&apos;s get started
          </button>
          <div className="mt-4">
            <Link
              href="/parent"
              className="text-sm text-warm-gray underline underline-offset-2"
            >
              Skip for now →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // QUESTIONS
  if (screen === "questions") {
    return (
      <div className="min-h-screen bg-cream">
        <div className="mx-auto max-w-[520px] px-6 py-6">
          {/* Progress bar */}
          <div className="flex gap-1.5 mb-8">
            {PROMPTS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                  i < answeredCount
                    ? "bg-rust"
                    : i === currentPrompt
                    ? "bg-rust/40"
                    : "bg-sand-dark"
                }`}
              />
            ))}
          </div>

          {/* Back / Skip navigation */}
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={() => {
                if (currentPrompt > 0) {
                  setCurrentPrompt((p) => p - 1);
                  setInputValue(
                    responses.find(
                      (r) => r.promptKey === PROMPTS[currentPrompt - 1].key
                    )?.rawResponse ?? ""
                  );
                } else {
                  setScreen("welcome");
                }
              }}
              className="text-warm-gray text-sm hover:text-espresso transition-colors"
            >
              {"\u2190"} Back
            </button>
            <span className="text-warm-gray/60 text-xs">
              {currentPrompt + 1} of {PROMPTS.length}
            </span>
            <button
              onClick={() => {
                if (currentPrompt < PROMPTS.length - 1) {
                  setCurrentPrompt((p) => p + 1);
                  setInputValue("");
                } else if (answeredCount >= MIN_ANSWERS) {
                  finishEarly();
                }
              }}
              className="text-warm-gray text-sm hover:text-espresso transition-colors"
            >
              Skip {"\u2192"}
            </button>
          </div>

          {/* Question */}
          <div className="mb-8 fade-up" key={prompt.key}>
            <div className="text-4xl mb-4">{prompt.emoji}</div>
            <h2 className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-espresso mb-2">
              {personalize(prompt.question)}
            </h2>
            <p className="text-warm-gray text-sm leading-relaxed">
              {personalize(prompt.subtext)}
            </p>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={`Tell us about ${childName}...`}
            rows={4}
            className="w-full bg-white border border-sand-dark rounded-xl p-4 text-espresso placeholder:text-warm-gray/50 focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust/50 resize-none text-base leading-relaxed transition-all"
          />

          {error && (
            <p className="text-red-500 text-sm mt-2">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => extractResponse(inputValue)}
              disabled={!inputValue.trim() || isExtracting}
              className="flex-1 bg-rust text-white font-semibold py-3 rounded-xl hover:bg-rust/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isExtracting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin text-sm">{"\u{1F300}"}</span>
                  Processing...
                </span>
              ) : currentPrompt === PROMPTS.length - 1 ? (
                "Finish"
              ) : (
                "Next"
              )}
            </button>
          </div>

          {/* Finish early option */}
          {answeredCount >= MIN_ANSWERS &&
            currentPrompt < PROMPTS.length - 1 && (
              <button
                onClick={finishEarly}
                className="w-full mt-3 text-warm-gray text-sm hover:text-espresso transition-colors py-2"
              >
                That&apos;s enough for now &mdash; build my profile ({answeredCount}{" "}
                of {PROMPTS.length} answered)
              </button>
            )}
        </div>
      </div>
    );
  }

  // PROCESSING
  if (screen === "processing") {
    const steps = [
      { emoji: "\u{1F4D6}", text: "Reading your words..." },
      { emoji: "\u{1F9E9}", text: "Building the profile..." },
      { emoji: "\u2728", text: "Crafting personalized experience..." },
    ];

    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-6">
        <div className="max-w-[400px] w-full text-center">
          <div className="space-y-6">
            {steps.map((step, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 transition-all duration-500 ${
                  processingStep > i
                    ? "opacity-100 translate-y-0"
                    : processingStep === i
                    ? "opacity-70 translate-y-0"
                    : "opacity-0 translate-y-4"
                }`}
              >
                <span
                  className={`text-2xl transition-transform duration-500 ${
                    processingStep === i ? "animate-pulse" : ""
                  }`}
                >
                  {step.emoji}
                </span>
                <span
                  className={`text-lg ${
                    processingStep > i ? "text-espresso" : "text-warm-gray"
                  }`}
                >
                  {step.text}
                </span>
                {processingStep > i && (
                  <span className="text-sage ml-auto">{"\u2713"}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // REVIEW
  if (screen === "review") {
    const interests = (reviewData.interests as string[]) ?? [];
    const emergingInterests =
      (reviewData.emerging_interests as string[]) ?? [];
    const parentGoals = (reviewData.parent_goals as string[]) ?? [];
    const playStyle = (reviewData.play_style as string) ?? null;
    const growingEdges = (reviewData.growing_edges as string[]) ?? [];
    const sensitivityFood = (reviewData.sensitivity_food as string[]) ?? [];
    const sensitivitySensory =
      (reviewData.sensitivity_sensory as string[]) ?? [];

    return (
      <div className="min-h-screen bg-cream">
        <div className="mx-auto max-w-[520px] px-6 py-8">
          <div className="text-center mb-8 fade-up">
            <div className="text-4xl mb-3">{"\u{1F31F}"}</div>
            <h1 className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-espresso mb-2">
              {childName}&apos;s Profile
            </h1>
            <p className="text-warm-gray text-sm">
              Here&apos;s what we learned. This will power everything in Orbit.
            </p>
          </div>

          {/* Interests */}
          {(interests.length > 0 || emergingInterests.length > 0) && (
            <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm fade-up delay-1">
              <h3 className="text-xs uppercase tracking-wider text-warm-gray font-semibold mb-3">
                {"\u2728"} Interests
              </h3>
              <div className="flex flex-wrap gap-2">
                {interests.map((i, idx) => (
                  <span
                    key={idx}
                    className="bg-golden/15 text-golden px-3 py-1 rounded-full text-sm font-medium"
                  >
                    {i}
                  </span>
                ))}
                {emergingInterests.map((i, idx) => (
                  <span
                    key={`e-${idx}`}
                    className="bg-sand text-warm-gray px-3 py-1 rounded-full text-sm"
                  >
                    {i}
                    <span className="text-xs ml-1 opacity-60">new</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Parent Goals */}
          {parentGoals.length > 0 && (
            <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm fade-up delay-2">
              <h3 className="text-xs uppercase tracking-wider text-warm-gray font-semibold mb-3">
                {"\u{1F3AF}"} Goals
              </h3>
              <ul className="space-y-1.5">
                {parentGoals.map((g, idx) => (
                  <li key={idx} className="text-espresso text-sm flex gap-2">
                    <span className="text-sage">{"\u2022"}</span>
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Social / Play Style */}
          {playStyle && (
            <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm fade-up delay-3">
              <h3 className="text-xs uppercase tracking-wider text-warm-gray font-semibold mb-3">
                {"\u{1F46B}"} Social Style
              </h3>
              <p className="text-espresso text-sm">
                <span className="bg-sky/15 text-sky px-2 py-0.5 rounded-full text-xs font-semibold mr-2">
                  {playStyle}
                </span>
              </p>
            </div>
          )}

          {/* Growing Edges */}
          {growingEdges.length > 0 && (
            <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm fade-up delay-4">
              <h3 className="text-xs uppercase tracking-wider text-warm-gray font-semibold mb-3">
                {"\u{1F331}"} Growing Edges
              </h3>
              <div className="flex flex-wrap gap-2">
                {growingEdges.map((e, idx) => (
                  <span
                    key={idx}
                    className="bg-sand text-warm-gray px-3 py-1 rounded-full text-sm"
                  >
                    {e}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sensitivities */}
          {(sensitivityFood.length > 0 ||
            sensitivitySensory.length > 0) && (
            <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm fade-up delay-5">
              <h3 className="text-xs uppercase tracking-wider text-warm-gray font-semibold mb-3">
                {"\u{1F6E1}\uFE0F"} Sensitivities
              </h3>
              <div className="flex flex-wrap gap-2">
                {sensitivityFood.map((s, idx) => (
                  <span
                    key={`f-${idx}`}
                    className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-sm"
                  >
                    {s}
                  </span>
                ))}
                {sensitivitySensory.map((s, idx) => (
                  <span
                    key={`s-${idx}`}
                    className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-sm"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Activate CTA */}
          <div className="mt-8 text-center fade-up delay-6">
            <button
              onClick={() => setScreen("done")}
              className="bg-rust text-white font-semibold px-8 py-3.5 rounded-xl text-lg hover:bg-rust/90 transition-colors shadow-sm"
            >
              Activate Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  // DONE
  if (screen === "done") {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-6">
        <div className="max-w-[480px] w-full text-center fade-up">
          <div className="text-6xl mb-6">{"\u{1F389}"}</div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold text-espresso mb-3">
            {alreadyComplete ? `${childName}'s Profile is Active` : "You're all set!"}
          </h1>
          <p className="text-warm-gray text-lg mb-8">
            {alreadyComplete
              ? "Orbit is already personalized for " + childName + ". Everything you see is shaped by what we know."
              : childName +
                "'s profile is now live. Everything in Orbit \u2014 highlights, activities, recommendations \u2014 is now personalized."}
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/parent"
              className="bg-rust text-white font-semibold py-3 rounded-xl hover:bg-rust/90 transition-colors text-center"
            >
              Go to Control Room
            </Link>
            <Link
              href={`/parent/profile/${childId}`}
              className="bg-white text-espresso font-semibold py-3 rounded-xl border border-sand-dark hover:bg-sand transition-colors text-center"
            >
              View Full Profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
