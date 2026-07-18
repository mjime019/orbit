"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSpeechCapture } from "@/lib/use-speech-capture";
import { ageBand, formatAge } from "@/lib/age";
import {
  questionsForBand,
  MIN_ANSWERS,
  type OnboardingQuestion,
} from "@/lib/onboarding-questions";

type Screen = "welcome" | "questions" | "saving" | "review" | "done";

interface StoredResponse {
  promptKey: string;
  rawResponse: string;
  extractedFields: Record<string, unknown>;
}

interface OnboardingFlowProps {
  childId: string;
  childName: string;
  dateOfBirth: string | null;
  alreadyComplete: boolean;
}

// Fetch with a real timeout — an unanswered request must never leave the
// parent staring at an infinite spinner.
async function postJson(path: string, body: unknown, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export function OnboardingFlow({
  childId,
  childName,
  dateOfBirth,
  alreadyComplete,
}: OnboardingFlowProps) {
  const band = ageBand(dateOfBirth);
  const prompts = useMemo(() => questionsForBand(band), [band]);

  const [screen, setScreen] = useState<Screen>("welcome");
  const [currentIndex, setCurrentIndex] = useState(0);
  // Keyed by promptKey — answering the same question twice REPLACES the
  // response (the old flow appended duplicates).
  const [responses, setResponses] = useState<Map<string, StoredResponse>>(
    new Map()
  );
  const [input, setInput] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reviewProfile, setReviewProfile] = useState<Record<string, unknown> | null>(null);

  const speech = useSpeechCapture();
  const inputBaseRef = useRef("");

  const prompt: OnboardingQuestion | undefined = prompts[currentIndex];
  const answeredCount = responses.size;

  // ─── Voice: dictate into the answer box (teacher-observe pattern) ─
  const startListening = () => {
    inputBaseRef.current = input;
    speech.start();
  };
  const stopListening = () => {
    if (!speech.recording) return;
    const spoken = speech.stop();
    setInput(`${inputBaseRef.current} ${spoken}`.replace(/\s+/g, " ").trim());
  };
  const liveInput = speech.recording
    ? `${inputBaseRef.current} ${speech.finalText}${speech.interimText}`
        .replace(/\s+/g, " ")
        .trimStart()
    : input;

  // ─── Per-answer extraction ────────────────────────────────────────
  const submitAnswer = async () => {
    if (!prompt) return;
    let answer = input;
    if (speech.recording) {
      const spoken = speech.stop();
      answer = `${inputBaseRef.current} ${spoken}`.replace(/\s+/g, " ").trim();
      setInput(answer);
    }
    if (!answer.trim() || extracting) return;

    setExtracting(true);
    setError("");
    try {
      const res = await postJson("/api/parent/onboarding/extract", {
        childId,
        promptKey: prompt.key,
        promptText: prompt.question(childName),
        promptCategory: prompt.category,
        response: answer.trim(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Couldn't process that answer.");
      }
      setResponses((prev) => {
        const next = new Map(prev);
        next.set(prompt.key, {
          promptKey: prompt.key,
          rawResponse: answer.trim(),
          extractedFields: (data.extracted_fields ?? data) as Record<string, unknown>,
        });
        return next;
      });
      advance();
    } catch (err) {
      setError(
        err instanceof Error && err.name === "AbortError"
          ? "That took too long — check your connection and try again. Your answer is still below."
          : `${err instanceof Error ? err.message : "Something went wrong."} Your answer is still below — try again.`
      );
    } finally {
      setExtracting(false);
    }
  };

  const advance = () => {
    setError("");
    if (currentIndex + 1 < prompts.length) {
      const nextPrompt = prompts[currentIndex + 1];
      setCurrentIndex(currentIndex + 1);
      setInput(responses.get(nextPrompt.key)?.rawResponse ?? "");
    } else {
      finish();
    }
  };

  const goBack = () => {
    stopListening();
    setError("");
    if (currentIndex === 0) {
      setScreen("welcome");
      return;
    }
    const prevPrompt = prompts[currentIndex - 1];
    setCurrentIndex(currentIndex - 1);
    setInput(responses.get(prevPrompt.key)?.rawResponse ?? "");
  };

  const skip = () => {
    stopListening();
    setInput("");
    advance();
  };

  // ─── Completion (real state, no timers; retry keeps everything) ───
  const finish = async () => {
    if (answeredCount < MIN_ANSWERS) {
      setError(`Answer at least ${MIN_ANSWERS} questions so the file has something to grow from.`);
      return;
    }
    setScreen("saving");
    setSaving(true);
    setError("");
    try {
      const res = await postJson(
        "/api/parent/onboarding/complete",
        { childId, responses: [...responses.values()] },
        45000
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save the profile.");
      setReviewProfile(data.profile ?? {});
      setScreen("review");
    } catch (err) {
      setError(
        err instanceof Error && err.name === "AbortError"
          ? "Saving took too long — your answers are safe here. Tap retry."
          : `${err instanceof Error ? err.message : "Something went wrong."} Your answers are safe — tap retry.`
      );
    } finally {
      setSaving(false);
    }
  };

  // ─── Screens ──────────────────────────────────────────────────────
  if (screen === "welcome") {
    return (
      <div className="fade-up text-center pt-6">
        <div className="text-5xl mb-4">🌱</div>
        <h1 className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-espresso mb-2">
          Seed {childName}&apos;s file
        </h1>
        <p className="text-sm text-warm-gray mb-1">
          {formatAge(dateOfBirth)} old — the questions fit where he is right now.
        </p>
        <p className="text-sm text-warm-gray leading-relaxed max-w-[340px] mx-auto mb-6">
          Talk or type — what you see in {childName} becomes the base layer
          everything else builds on.
        </p>
        {alreadyComplete && (
          <p className="text-xs text-sage mb-4">
            ✓ Seeded before — answering again refines the file.
          </p>
        )}
        <button
          onClick={() => {
            setCurrentIndex(0);
            setInput(responses.get(prompts[0].key)?.rawResponse ?? "");
            setScreen("questions");
          }}
          className="bg-rust text-white font-semibold px-8 py-3.5 rounded-xl text-base hover:bg-rust/90 transition-colors shadow-sm"
        >
          Let&apos;s go
        </button>
        <div className="mt-4">
          <Link
            href={`/parent/kid/${childId}`}
            className="text-sm text-warm-gray underline underline-offset-2"
          >
            Not now →
          </Link>
        </div>
      </div>
    );
  }

  if (screen === "questions" && prompt) {
    return (
      <div className="fade-up">
        {/* Progress */}
        <div className="flex gap-1.5 mb-6">
          {prompts.map((p, i) => (
            <div
              key={p.key}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                responses.has(p.key)
                  ? "bg-rust"
                  : i === currentIndex
                  ? "bg-rust/40"
                  : "bg-sand-dark"
              }`}
            />
          ))}
        </div>

        <div className="flex justify-between items-center mb-5">
          <button onClick={goBack} className="text-warm-gray text-sm hover:text-espresso transition-colors">
            ← Back
          </button>
          <span className="text-[11px] text-warm-gray">
            {answeredCount} answered · {MIN_ANSWERS}+ needed
          </span>
          <button onClick={skip} className="text-warm-gray text-sm hover:text-espresso transition-colors">
            Skip →
          </button>
        </div>

        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold text-espresso leading-snug mb-1">
          {prompt.question(childName)}
        </h2>
        {prompt.subtext && (
          <p className="text-xs text-warm-gray mb-4">{prompt.subtext}</p>
        )}

        <div className="relative mt-3">
          <textarea
            value={liveInput}
            onChange={(e) => setInput(e.target.value)}
            readOnly={speech.recording}
            placeholder={prompt.placeholder}
            disabled={extracting}
            className="w-full min-h-[140px] p-4 pr-14 rounded-xl border-2 border-sand-dark bg-white text-[15px] leading-relaxed text-espresso placeholder:text-warm-gray/50 focus:outline-none focus:border-rust/40 transition-colors resize-none disabled:opacity-50"
          />
          {!speech.fallbackToText && (
            <button
              onClick={speech.recording ? stopListening : startListening}
              disabled={extracting}
              className={`absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center text-base transition-all ${
                speech.recording
                  ? "bg-red-500 text-white shadow-lg animate-pulse"
                  : "bg-white border-2 border-sand-dark text-warm-gray hover:shadow-md"
              }`}
            >
              {speech.recording ? "⏹" : "🎤"}
            </button>
          )}
        </div>
        {speech.recording && (
          <p className="text-xs text-red-500 font-semibold mt-2 animate-pulse">
            Listening — tap ⏹ when you&apos;re done
          </p>
        )}

        {error && (
          <div className="mt-3 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={submitAnswer}
          disabled={!liveInput.trim() || extracting}
          className="mt-4 w-full py-3.5 rounded-2xl font-semibold text-white transition-all disabled:opacity-40 bg-rust hover:bg-rust/90 active:scale-[0.99]"
        >
          {extracting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Listening to that…
            </span>
          ) : currentIndex + 1 === prompts.length ? (
            "Save this & finish"
          ) : (
            "Next"
          )}
        </button>

        {answeredCount >= MIN_ANSWERS && currentIndex + 1 < prompts.length && (
          <button
            onClick={() => {
              stopListening();
              finish();
            }}
            className="mt-3 w-full text-sm text-warm-gray underline underline-offset-2"
          >
            That&apos;s enough for now — build the file
          </button>
        )}
      </div>
    );
  }

  if (screen === "saving") {
    return (
      <div className="fade-up flex flex-col items-center justify-center py-20 text-center">
        {saving ? (
          <>
            <div className="flex gap-1.5 mb-4">
              <span className="typing-dot w-2.5 h-2.5 rounded-full bg-rust" />
              <span className="typing-dot w-2.5 h-2.5 rounded-full bg-rust" style={{ animationDelay: "0.2s" }} />
              <span className="typing-dot w-2.5 h-2.5 rounded-full bg-rust" style={{ animationDelay: "0.4s" }} />
            </div>
            <p className="text-sm text-warm-gray">
              Saving {answeredCount} answers into {childName}&apos;s file…
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-red-700 max-w-[320px] leading-relaxed mb-4">{error}</p>
            <div className="flex gap-3">
              <button
                onClick={finish}
                className="px-6 py-2.5 bg-rust text-white rounded-full text-sm font-medium shadow-md hover:bg-rust/90"
              >
                Retry
              </button>
              <button
                onClick={() => setScreen("questions")}
                className="px-6 py-2.5 text-sm text-warm-gray underline underline-offset-2"
              >
                Back to questions
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (screen === "review" && reviewProfile) {
    const chips = (v: unknown) =>
      Array.isArray(v) ? (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {v.map((x, i) => (
            <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-sand text-espresso font-medium">
              {String(x)}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-espresso/80 mt-1 leading-relaxed">{String(v)}</p>
      );
    const LABELS: Record<string, string> = {
      interests: "⭐ Interests",
      emerging_interests: "🌤️ Emerging",
      parent_goals: "🎯 Your goals",
      play_style: "🎮 Play style",
      food_sensitivities: "🍽️ Food",
      sensory_sensitivities: "🌡️ Sensory",
      emotional_triggers: "💢 Triggers",
      comfort_helps: "💛 What helps",
      comfort_escalates: "⚠️ What escalates",
      languages: "🌍 Languages",
      parent_values: "💎 Values",
    };
    const rows = Object.entries(reviewProfile).filter(
      ([k, v]) =>
        k !== "onboarding_complete" &&
        k !== "extra" &&
        v != null &&
        (!Array.isArray(v) || v.length > 0)
    );
    const extra = (reviewProfile.extra ?? {}) as Record<string, unknown>;

    return (
      <div className="fade-up">
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold text-espresso mb-1">
          {childName}&apos;s file, seeded
        </h2>
        <p className="text-xs text-warm-gray mb-4">
          All of it is saved — here&apos;s what Orbit heard.
        </p>
        <div className="space-y-3">
          {rows.map(([k, v]) => (
            <div key={k} className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-warm-gray">
                {LABELS[k] ?? k.replace(/_/g, " ")}
              </p>
              {k === "routines" && typeof v === "object" && !Array.isArray(v) ? (
                <div className="mt-1 space-y-1">
                  {Object.entries(v as Record<string, unknown>).map(([rk, rv]) => (
                    <p key={rk} className="text-xs text-espresso/80">
                      <span className="font-semibold">{rk.replace(/_/g, " ")}:</span> {String(rv)}
                    </p>
                  ))}
                </div>
              ) : (
                chips(v)
              )}
            </div>
          ))}
          {Object.keys(extra).length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-warm-gray mb-1">
                📝 Also noted
              </p>
              {Object.entries(extra).map(([k, v]) => (
                <p key={k} className="text-xs text-espresso/80 mt-1">
                  <span className="font-semibold">{k.replace(/_/g, " ")}:</span>{" "}
                  {Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v)}
                </p>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setScreen("done")}
          className="mt-5 w-full py-3.5 rounded-2xl font-semibold text-white bg-rust hover:bg-rust/90 transition-all"
        >
          Looks right
        </button>
      </div>
    );
  }

  // done
  return (
    <div className="fade-up text-center pt-10">
      <div className="text-5xl mb-4">🙏</div>
      <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold text-espresso mb-2">
        {childName}&apos;s file is growing
      </h2>
      <p className="text-sm text-warm-gray max-w-[320px] mx-auto leading-relaxed mb-6">
        Everything you shared now shapes his summaries, chapters, and
        suggestions. Keep capturing moments — the file keeps getting smarter.
      </p>
      <div className="flex flex-col items-center gap-3">
        <Link
          href={`/parent/kid/${childId}?tab=about`}
          className="px-6 py-3 bg-rust text-white rounded-full text-sm font-medium shadow-md hover:bg-rust/90"
        >
          See {childName}&apos;s file
        </Link>
        <Link href="/parent" className="text-sm text-warm-gray underline underline-offset-2">
          Home
        </Link>
      </div>
    </div>
  );
}
