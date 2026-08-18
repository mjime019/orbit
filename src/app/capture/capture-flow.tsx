"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { ComposeBox } from "@/components/capture/compose-box";
import {
  DOMAIN_CONFIG,
  SOCIAL_TAG_CONFIG,
  type DevDomain,
  type SocialTag,
} from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────────────
interface RosterEntry {
  id: string;
  name: string;
  age: number | null;
}

interface SocialMoment {
  type: string;
  description: string;
  with_whom: string[];
}

interface ExtractedChild {
  child_id: string | null;
  name?: string;
  observation_summary?: string;
  domains?: string[];
  social_moments?: SocialMoment[];
  direct_quotes?: string[];
  other_kids_involved?: string[];
  notable?: boolean;
  notable_reason?: string | null;
}

interface Extraction {
  children: ExtractedChild[];
  day_summary: string;
  themes: string[];
}

interface FollowupQuestion {
  question: string;
  about_child: string;
  reason: string;
}

// Editable per-child card state for the review-before-confirm step
interface CardState {
  key: number;
  childId: string | null;
  include: boolean;
  note: string;
  domains: DevDomain[];
  socialTag: SocialTag | null;
}

// Text-first flow (Round 4): every input moment is one compose screen —
// a real textarea (Wispr Flow / keyboard dictation land here) with the
// in-app mic as assist. The old record→stop→review triplets are gone.
type Step =
  | "ready"
  | "compose"
  | "processing"
  | "followup"
  | "anything-else"
  | "processing-final"
  | "cards"
  | "saving"
  | "done";

interface CaptureFlowProps {
  ctx: "teacher" | "parent";
  roster: RosterEntry[];
  authorProfileId: string;
  classroomId: string | null;
}

// ─── Context prompts ────────────────────────────────────────────────
const SCHOOL_FLOW = [
  { emoji: "🌅", label: "Morning activity" },
  { emoji: "🎨", label: "Project time" },
  { emoji: "🍎", label: "Snack" },
  { emoji: "🧱", label: "Free play" },
  { emoji: "📖", label: "Wind-down" },
];

const HOME_FLOW = [
  { emoji: "🌳", label: "An outing" },
  { emoji: "🍝", label: "A mealtime moment" },
  { emoji: "🛁", label: "Bath, bedtime" },
  { emoji: "🧸", label: "Play" },
  { emoji: "💬", label: "Something they said" },
];

const THOUGHT_STARTERS = [
  "Any funny quotes?",
  "Who played together?",
  "Any breakthroughs?",
  "New skills?",
  "Mood or energy?",
  "Proud moments?",
];

function buildNoteFromExtraction(c: ExtractedChild): string {
  const parts = [c.observation_summary?.trim()].filter(Boolean) as string[];
  if (c.direct_quotes?.length) {
    parts.push(c.direct_quotes.map((q) => `"${q}"`).join(" · "));
  }
  if (c.notable && c.notable_reason) {
    parts.push(`Notable: ${c.notable_reason}`);
  }
  return parts.join(" — ");
}

// ─── Component ──────────────────────────────────────────────────────
export function CaptureFlow({
  ctx,
  roster,
  authorProfileId,
  classroomId,
}: CaptureFlowProps) {
  const [step, setStep] = useState<Step>("ready");
  const [speakerName, setSpeakerName] = useState(
    ctx === "teacher" ? "Carla" : "Miguel"
  );
  // Who this capture is about: one kid, or everyone (null). Scoping to one
  // kid narrows the AI roster so "he built a tower" attributes correctly
  // without saying the name.
  const [selectedKidId, setSelectedKidId] = useState<string | null>(null);
  const effectiveRoster = selectedKidId
    ? roster.filter((r) => r.id === selectedKidId)
    : roster;
  const [transcript, setTranscript] = useState("");
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [cards, setCards] = useState<CardState[]>([]);
  const [followups, setFollowups] = useState<FollowupQuestion[]>([]);
  const [currentFollowupIndex, setCurrentFollowupIndex] = useState(0);
  const [followupResponses, setFollowupResponses] = useState<string[]>([]);
  const [followupText, setFollowupText] = useState("");
  const [allFollowupText, setAllFollowupText] = useState("");
  const [anythingElseText, setAnythingElseText] = useState("");
  const [error, setError] = useState("");
  const [savedCount, setSavedCount] = useState(0);

  const captureIdRef = useRef<string | null>(null);

  // Auth is the family login (middleware session) — no per-page code needed.
  const gatedFetch = useCallback(async (path: string, body: unknown) => {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      throw new Error("Your session expired — reload the page to sign in again.");
    }
    return res;
  }, []);

  // ─── Submit: words first, then AI ────────────────────────────────
  const handleSubmitTranscript = async () => {
    if (!transcript.trim()) {
      setStep("ready");
      return;
    }
    setStep("processing");
    setError("");

    // 1) Persist the raw words BEFORE any AI call.
    try {
      const saveRes = await gatedFetch("/api/capture/save", {
        id: captureIdRef.current ?? undefined,
        authorProfileId,
        childIds: effectiveRoster.map((r) => r.id),
        transcript,
        status: "draft",
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || "Save failed");
      captureIdRef.current = saveData.id;
    } catch (err) {
      setError(
        (err instanceof Error ? err.message : "Couldn't save the recording.") +
          " Your words are still below — tap submit to retry."
      );
      setStep("compose");
      return;
    }

    // 2) Extraction
    try {
      const processRes = await gatedFetch("/api/capture/process", {
        transcript,
        speakerName,
        speakerRole: ctx,
        setting: ctx === "teacher" ? "school" : "home",
        roster: effectiveRoster,
      });
      const processData = await processRes.json();
      if (!processRes.ok || processData.error) {
        setError(
          `${processData.error || "Couldn't process the recording."} Your recording is saved — tap submit to retry.`
        );
        setStep("compose");
        return;
      }
      // Honest dead-end guard: the words saved, but there was no actual
      // moment about the kids in them (a question, a test, a stray tap).
      if ((processData.observations?.children ?? []).length === 0) {
        setError(
          `I couldn't find a moment about ${childNames} in that. Describe what happened — "${effectiveRoster[0]?.name ?? "he"} built a huge tower and said…" — then submit again.`
        );
        setStep("compose");
        return;
      }
      setExtraction(processData.observations);

      // 3) Follow-ups (optional decoration)
      let followupData: { followups?: FollowupQuestion[] } = {};
      try {
        const fuRes = await gatedFetch("/api/capture/followup", {
          transcript,
          observations: processData.observations,
          speakerName,
          roster: effectiveRoster,
        });
        if (fuRes.ok) followupData = await fuRes.json();
      } catch {
        // words are saved; follow-ups are optional
      }

      if (followupData.followups && followupData.followups.length > 0) {
        setFollowups(followupData.followups);
        setCurrentFollowupIndex(0);
        setFollowupResponses([]);
        setFollowupText("");
        setStep("followup");
      } else {
        setAllFollowupText("");
        setStep("anything-else");
      }
    } catch (err) {
      console.error(err);
      setError("Couldn't process the recording — it's saved. Tap submit to retry.");
      setStep("compose");
    }
  };

  // ─── Follow-up loop ──────────────────────────────────────────────
  const advanceFollowups = (responses: string[]) => {
    const nextIndex = responses.length;
    if (nextIndex < followups.length) {
      setCurrentFollowupIndex(nextIndex);
      setFollowupText("");
      setStep("followup");
    } else {
      finishFollowups(responses);
    }
  };

  const handleSubmitFollowupResponse = () => {
    const newResponses = [...followupResponses, followupText.trim()];
    setFollowupResponses(newResponses);
    advanceFollowups(newResponses);
  };

  const handleSkipCurrentFollowup = () => {
    const newResponses = [...followupResponses, ""];
    setFollowupResponses(newResponses);
    advanceFollowups(newResponses);
  };

  const finishFollowups = (responses: string[]) => {
    const text = followups
      .map((fq, i) => (responses[i] ? `Q: ${fq.question}\nA: ${responses[i]}` : ""))
      .filter(Boolean)
      .join("\n\n");
    setAllFollowupText(text);
    setAnythingElseText("");
    setStep("anything-else");
  };

  // ─── Anything else ───────────────────────────────────────────────
  const handleFinishAnythingElse = () => {
    const extra = anythingElseText.trim();
    const fullFollowup = extra
      ? `${allFollowupText}\n\n[Additional from ${speakerName}]: ${extra}`
      : allFollowupText;
    finalizeAndReview(fullFollowup);
  };

  // ─── Finalize: persist follow-ups, re-extract, build review cards ─
  const buildCards = (ext: Extraction | null): CardState[] =>
    (ext?.children ?? []).map((c, i) => ({
      key: i,
      childId: c.child_id,
      include: Boolean(c.child_id),
      note: buildNoteFromExtraction(c),
      domains: (c.domains ?? []).filter((d): d is DevDomain =>
        Object.prototype.hasOwnProperty.call(DOMAIN_CONFIG, d)
      ),
      socialTag:
        ((c.social_moments ?? [])
          .map((m) => m.type)
          .find((t) =>
            Object.prototype.hasOwnProperty.call(SOCIAL_TAG_CONFIG, t)
          ) as SocialTag | undefined) ?? null,
    }));

  const finalizeAndReview = async (fullFollowup: string) => {
    setStep("processing-final");
    setError("");

    // Words (incl. follow-ups) go durable before the second AI pass.
    try {
      await gatedFetch("/api/capture/save", {
        id: captureIdRef.current ?? undefined,
        authorProfileId,
        childIds: effectiveRoster.map((r) => r.id),
        transcript,
        followupTranscript: fullFollowup || null,
        structured: extraction,
        status: "processed",
      });
    } catch {
      // The first save already persisted the main transcript; continue.
    }

    let finalExtraction = extraction;
    if (fullFollowup) {
      try {
        const combined = `${transcript}\n\n[Follow-up responses from ${speakerName}]:\n${fullFollowup}`;
        const res = await gatedFetch("/api/capture/process", {
          transcript: combined,
          speakerName,
          speakerRole: ctx,
          setting: ctx === "teacher" ? "school" : "home",
          roster: effectiveRoster,
        });
        const data = await res.json();
        if (res.ok && data.observations) {
          finalExtraction = data.observations;
          setExtraction(data.observations);
        }
      } catch {
        // keep first-pass extraction
      }
    }

    setCards(buildCards(finalExtraction));
    setStep("cards");
  };

  // ─── Card editing ────────────────────────────────────────────────
  const updateCard = (key: number, patch: Partial<CardState>) => {
    setCards((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  };

  const toggleCardDomain = (key: number, domain: DevDomain) => {
    setCards((prev) =>
      prev.map((c) =>
        c.key === key
          ? {
              ...c,
              domains: c.domains.includes(domain)
                ? c.domains.filter((d) => d !== domain)
                : [...c.domains, domain],
            }
          : c
      )
    );
  };

  const confirmableCards = cards.filter(
    (c) => c.include && c.childId && c.note.trim()
  );

  // ─── Confirm: reviewed cards become observations ─────────────────
  const handleConfirm = async () => {
    if (confirmableCards.length === 0) return;
    setStep("saving");
    setError("");
    try {
      const res = await gatedFetch("/api/capture/confirm", {
        captureId: captureIdRef.current,
        source: ctx,
        authorProfileId,
        classroomId,
        observations: confirmableCards.map((c) => ({
          child_id: c.childId,
          note: c.note,
          domains: c.domains,
          social_tag: c.socialTag,
          other_children_ids: [],
        })),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSavedCount(data.count ?? confirmableCards.length);
      setStep("done");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't save the observations."
      );
      setStep("cards");
    }
  };

  const handleReset = () => {
    captureIdRef.current = null;
    setStep("ready");
    setTranscript("");
    setExtraction(null);
    setCards([]);
    setFollowups([]);
    setCurrentFollowupIndex(0);
    setFollowupResponses([]);
    setFollowupText("");
    setAllFollowupText("");
    setAnythingElseText("");
    setError("");
    setSavedCount(0);
  };

  const contextFlow = ctx === "teacher" ? SCHOOL_FLOW : HOME_FLOW;
  const childNames = effectiveRoster.map((r) => r.name).join(" & ");
  const homeHref = ctx === "teacher" ? "/teacher" : "/parent";

  const starterPills = (
    <div className="flex flex-wrap gap-1.5 justify-center">
      {THOUGHT_STARTERS.map((starter) => (
        <span
          key={starter}
          className="text-xs px-2.5 py-1 rounded-full bg-rust/10 text-rust/80"
        >
          {starter}
        </span>
      ))}
    </div>
  );

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-[640px] mx-auto px-5 py-8 pb-24">
        <header className="text-center mb-6">
          <h1 className="font-[family-name:var(--font-playfair)] text-2xl font-semibold text-espresso">
            {ctx === "teacher" ? "Day Capture" : "Capture a Moment"}
          </h1>
          <p className="text-warm-gray text-sm mt-1">
            {ctx === "teacher"
              ? `Hi ${speakerName} — tell me about the kids' day`
              : `A moment with ${childNames || "your kids"} worth remembering`}
          </p>
          {step === "ready" && ctx === "teacher" && (
            <div className="flex items-center justify-center gap-2 mt-3">
              {["Carla", "Miguel"].map((name) => (
                <button
                  key={name}
                  onClick={() => setSpeakerName(name)}
                  className={`text-xs px-3 py-1.5 rounded-full transition-all ${
                    speakerName === name
                      ? "bg-rust text-white"
                      : "bg-sand-dark/50 text-warm-gray"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </header>

        {/* ─── READY ─────────────────────────────────────────── */}
        {step === "ready" && (
          <div className="fade-up">
            {roster.length === 0 && (
              <div className="bg-sand rounded-2xl p-5 mb-6 text-center">
                <p className="text-sm text-espresso">
                  No children are set up for this space yet.
                </p>
                <p className="text-xs text-warm-gray mt-1">
                  Once children are added, capture works here.
                </p>
              </div>
            )}

            {ctx === "parent" && roster.length > 1 && (
              <div className="mb-5">
                <p className="text-xs font-medium text-warm-gray uppercase tracking-wider mb-2 text-center">
                  Who is this about?
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  <button
                    onClick={() => setSelectedKidId(null)}
                    className={`text-xs px-3 py-1.5 rounded-full transition-all ${
                      selectedKidId === null
                        ? "bg-espresso text-white"
                        : "bg-white border border-sand-dark/50 text-warm-gray"
                    }`}
                  >
                    Everyone
                  </button>
                  {roster.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedKidId(r.id)}
                      className={`text-xs px-3 py-1.5 rounded-full transition-all ${
                        selectedKidId === r.id
                          ? "bg-rust text-white"
                          : "bg-white border border-sand-dark/50 text-warm-gray"
                      }`}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-6">
              <p className="text-xs font-medium text-warm-gray uppercase tracking-wider mb-2 text-center">
                Worth capturing
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {contextFlow.map((item) => (
                  <span
                    key={item.label}
                    className="text-xs px-2.5 py-1 rounded-full bg-sand text-espresso/80"
                  >
                    {item.emoji} {item.label}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                setError("");
                setStep("compose");
              }}
              disabled={roster.length === 0}
              className="w-full py-4 bg-rust text-white rounded-2xl text-base font-semibold shadow-md hover:bg-rust/90 active:scale-[0.99] transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              ✏️ Capture a moment
            </button>
            <p className="text-xs text-warm-gray text-center mt-2">
              Type it, dictate it, or tap the mic — whatever&apos;s fastest.
            </p>

            {error && (
              <div className="mt-4 p-3 bg-red-50 rounded-xl text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        )}

        {/* ─── COMPOSE (type or dictate, then submit) ────────── */}
        {step === "compose" && (
          <div className="fade-up">
            {error && (
              <div className="mb-4 p-3 bg-red-50 rounded-xl text-sm text-red-700">
                {error}
              </div>
            )}
            <ComposeBox
              value={transcript}
              onChange={setTranscript}
              placeholder={
                ctx === "teacher"
                  ? "Talk through the day — who did what, anything that stood out..."
                  : `What happened? "${effectiveRoster[0]?.name ?? "He"} spent the whole bath narrating a rescue mission..."`
              }
              minHeight="180px"
              autoFocus
            />
            <div className="mt-3 mb-5">{starterPills}</div>

            <div className="flex flex-col items-center gap-3">
              <button
                onClick={handleSubmitTranscript}
                disabled={!transcript.trim()}
                className="px-8 py-3 bg-rust text-white rounded-full text-sm font-medium shadow-md hover:bg-rust/90 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                Looks good — submit
              </button>
              <button
                onClick={() => setStep("ready")}
                className="text-sm text-warm-gray underline underline-offset-2"
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* ─── PROCESSING ────────────────────────────────────── */}
        {(step === "processing" || step === "processing-final" || step === "saving") && (
          <div className="fade-up flex flex-col items-center justify-center py-16">
            <div className="flex gap-1.5 mb-4">
              <span className="typing-dot w-2.5 h-2.5 rounded-full bg-rust" />
              <span className="typing-dot w-2.5 h-2.5 rounded-full bg-rust" style={{ animationDelay: "0.2s" }} />
              <span className="typing-dot w-2.5 h-2.5 rounded-full bg-rust" style={{ animationDelay: "0.4s" }} />
            </div>
            <p className="text-sm text-warm-gray">
              {step === "processing"
                ? "Listening to what you shared..."
                : step === "processing-final"
                ? "Pulling it together..."
                : "Saving observations..."}
            </p>
          </div>
        )}

        {/* ─── FOLLOW-UP ─────────────────────────────────────── */}
        {step === "followup" && followups[currentFollowupIndex] && (
          <div className="fade-up">
            <div className="flex items-center justify-center gap-1.5 mb-6">
              {followups.map((_, i) => (
                <span
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i < currentFollowupIndex
                      ? "bg-sage"
                      : i === currentFollowupIndex
                      ? "bg-rust w-6"
                      : "bg-sand-dark"
                  }`}
                />
              ))}
            </div>

            <div className="bg-sand rounded-2xl p-5 mb-4">
              <p className="text-xs font-medium text-warm-gray uppercase tracking-wider mb-3">
                Follow-up {currentFollowupIndex + 1} of {followups.length}
              </p>
              <div className="flex gap-3">
                <span className="text-lg mt-0.5">💭</span>
                <p className="text-base text-espresso leading-relaxed">
                  {followups[currentFollowupIndex].question}
                </p>
              </div>
            </div>

            <ComposeBox
              value={followupText}
              onChange={setFollowupText}
              placeholder="Type or dictate your answer — or skip it..."
              minHeight="110px"
            />

            <div className="flex flex-col items-center gap-3 mt-4">
              <button
                onClick={handleSubmitFollowupResponse}
                disabled={!followupText.trim()}
                className="px-8 py-3 bg-rust text-white rounded-full text-sm font-medium shadow-md hover:bg-rust/90 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                {currentFollowupIndex + 1 < followups.length ? "Next question" : "Finish"}
              </button>
              <div className="flex gap-4">
                <button
                  onClick={handleSkipCurrentFollowup}
                  className="text-sm text-warm-gray underline underline-offset-2"
                >
                  Skip this one
                </button>
                <button
                  onClick={() => finishFollowups(followupResponses)}
                  className="text-sm text-warm-gray underline underline-offset-2"
                >
                  That&apos;s everything
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── ANYTHING ELSE ─────────────────────────────────── */}
        {step === "anything-else" && (
          <div className="fade-up">
            <div className="bg-sand rounded-2xl p-5 mb-4">
              <div className="flex gap-3">
                <span className="text-lg mt-0.5">💭</span>
                <p className="text-base text-espresso leading-relaxed">
                  Anything else you want to capture before we wrap up?
                </p>
              </div>
            </div>

            <ComposeBox
              value={anythingElseText}
              onChange={setAnythingElseText}
              placeholder="Anything else — or leave it empty and finish..."
              minHeight="110px"
            />

            <div className="flex flex-col items-center gap-3 mt-4">
              <button
                onClick={handleFinishAnythingElse}
                className="px-8 py-3 bg-espresso text-white rounded-full text-sm font-medium shadow-md hover:bg-espresso/90 active:scale-95 transition-all"
              >
                {anythingElseText.trim() ? "Add it & review" : "All done — review"}
              </button>
            </div>
          </div>
        )}

        {/* ─── PER-CHILD REVIEW CARDS ────────────────────────── */}
        {step === "cards" && (
          <div className="fade-up">
            {error && (
              <div className="mb-4 p-3 bg-red-50 rounded-xl text-sm text-red-700">
                {error}
              </div>
            )}
            <p className="text-xs font-medium text-warm-gray uppercase tracking-wider mb-3">
              Review before saving
            </p>

            {cards.length === 0 && (
              <div className="bg-sand rounded-2xl p-5 mb-4 text-center">
                <p className="text-sm text-espresso">
                  Nothing specific was picked out for {childNames}.
                </p>
                <p className="text-xs text-warm-gray mt-1">
                  You can go back and add more detail.
                </p>
              </div>
            )}

            <div className="space-y-4 mb-6">
              {cards.map((card) => (
                <div key={card.key} className="bg-white rounded-2xl p-5 shadow-sm border border-sand-dark/40">
                  <div className="flex items-center justify-between mb-3">
                    <select
                      value={card.childId ?? ""}
                      onChange={(e) =>
                        updateCard(card.key, {
                          childId: e.target.value || null,
                          include: Boolean(e.target.value),
                        })
                      }
                      className="text-sm font-semibold text-espresso bg-sand rounded-lg px-3 py-1.5 outline-none"
                    >
                      <option value="">Assign to…</option>
                      {roster.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-xs text-warm-gray">
                      <input
                        type="checkbox"
                        checked={card.include}
                        onChange={(e) =>
                          updateCard(card.key, { include: e.target.checked })
                        }
                      />
                      Save this
                    </label>
                  </div>

                  {!card.childId && (
                    <p className="text-xs text-rust mb-2">
                      Couldn&apos;t match this to a child — pick one above or leave it unsaved.
                    </p>
                  )}

                  <textarea
                    value={card.note}
                    onChange={(e) => updateCard(card.key, { note: e.target.value })}
                    className="w-full bg-cream rounded-xl p-3 text-sm text-espresso leading-relaxed resize-none outline-none border border-sand-dark/50 focus:border-rust/50 transition-colors min-h-[90px]"
                    rows={4}
                  />

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {(Object.keys(DOMAIN_CONFIG) as DevDomain[]).map((domain) => (
                      <button
                        key={domain}
                        onClick={() => toggleCardDomain(card.key, domain)}
                        className={`text-xs px-2.5 py-1 rounded-full transition-all ${
                          card.domains.includes(domain)
                            ? "bg-rust text-white"
                            : "bg-sand text-warm-gray"
                        }`}
                      >
                        {DOMAIN_CONFIG[domain].emoji} {DOMAIN_CONFIG[domain].label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(Object.keys(SOCIAL_TAG_CONFIG) as SocialTag[]).map((tag) => (
                      <button
                        key={tag}
                        onClick={() =>
                          updateCard(card.key, {
                            socialTag: card.socialTag === tag ? null : tag,
                          })
                        }
                        className={`text-xs px-2.5 py-1 rounded-full transition-all ${
                          card.socialTag === tag
                            ? "bg-espresso text-white"
                            : "bg-sand text-warm-gray"
                        }`}
                      >
                        {SOCIAL_TAG_CONFIG[tag].emoji} {SOCIAL_TAG_CONFIG[tag].label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center gap-3">
              <button
                onClick={handleConfirm}
                disabled={confirmableCards.length === 0}
                className="px-8 py-3 bg-rust text-white rounded-full text-sm font-medium shadow-md hover:bg-rust/90 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                Save {confirmableCards.length || ""} observation
                {confirmableCards.length === 1 ? "" : "s"}
              </button>
              <button
                onClick={() => setStep("compose")}
                className="text-sm text-warm-gray underline underline-offset-2"
              >
                Back to my words
              </button>
            </div>
          </div>
        )}

        {/* ─── DONE ──────────────────────────────────────────── */}
        {step === "done" && (
          <div className="fade-up">
            <div className="text-center py-12">
              <span className="text-4xl">🙏</span>
              <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold text-espresso mt-4">
                Saved!
              </h2>
              <p className="text-sm text-warm-gray mt-2">
                {savedCount} observation{savedCount === 1 ? "" : "s"} added
                {ctx === "parent" ? " to your kids' story." : " for the class."}
              </p>
            </div>

            <div className="flex flex-col items-center gap-3 pt-4">
              <Link
                href={homeHref}
                className="px-8 py-3 bg-rust text-white rounded-full text-sm font-medium shadow-md hover:bg-rust/90 active:scale-95 transition-all"
              >
                {ctx === "parent" ? "See it on the home page" : "Back to dashboard"}
              </Link>
              <button
                onClick={handleReset}
                className="text-sm text-warm-gray underline underline-offset-2"
              >
                Record another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
