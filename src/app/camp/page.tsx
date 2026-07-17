"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ─── Types ──────────────────────────────────────────────────────────
interface SocialMoment {
  type: string;
  description: string;
  with_whom: string[];
}

interface ChildObservation {
  observation_summary: string;
  domains: string[];
  social_moments: SocialMoment[];
  direct_quotes: string[];
  other_kids_involved: string[];
  notable: boolean;
  notable_reason: string | null;
}

interface Observations {
  felipe: ChildObservation | null;
  rafael: ChildObservation | null;
  day_summary: string;
  themes: string[];
}

interface FollowupQuestion {
  question: string;
  about_child: string;
  reason: string;
}

type Step = "ready" | "recording" | "review" | "processing" | "followup-question" | "followup-recording" | "followup-review" | "anything-else" | "anything-else-recording" | "anything-else-review" | "processing-final" | "done";

// ─── Day flow prompts (memory triggers) ─────────────────────────────
const DAY_FLOW = [
  { time: "Morning", emoji: "🌅", label: "Arrival & morning activity" },
  { time: "Mid-morning", emoji: "🎨", label: "Structured activity / project" },
  { time: "Snack", emoji: "🍎", label: "Snack time" },
  { time: "Free play", emoji: "🧱", label: "Free play / outdoor time" },
  { time: "Afternoon", emoji: "📖", label: "Afternoon activity / wind-down" },
];

// ─── Thought starters ───────────────────────────────────────────────
const THOUGHT_STARTERS = [
  "Any funny quotes?",
  "Who played together?",
  "Any breakthroughs?",
  "New skills?",
  "Mood or energy?",
  "Proud moments?",
  "Conflicts resolved?",
  "What made you smile?",
];

// ─── Speech Recognition types ───────────────────────────────────────
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

// ─── Component ──────────────────────────────────────────────────────
export default function CampPage() {
  const [step, setStep] = useState<Step>("ready");
  const [teacherName, setTeacherName] = useState("Carla");
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [observations, setObservations] = useState<Observations | null>(null);
  const [followups, setFollowups] = useState<FollowupQuestion[]>([]);
  const [currentFollowupIndex, setCurrentFollowupIndex] = useState(0);
  const [followupResponses, setFollowupResponses] = useState<string[]>([]);
  const [followupTranscript, setFollowupTranscript] = useState("");
  const [followupInterim, setFollowupInterim] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [useTextInput, setUseTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [followupTextInput, setFollowupTextInput] = useState("");
  const [anythingElseTranscript, setAnythingElseTranscript] = useState("");
  const [anythingElseInterim, setAnythingElseInterim] = useState("");
  const [anythingElseTextInput, setAnythingElseTextInput] = useState("");
  const [allFollowupText, setAllFollowupText] = useState("");
  const [campKey, setCampKey] = useState("");
  const [campKeyInput, setCampKeyInput] = useState("");
  const [campKeyError, setCampKeyError] = useState("");
  const [checkingKey, setCheckingKey] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef("");
  const recordingActiveRef = useRef(false);
  const savedIdRef = useRef<string | null>(null);
  const finalFollowupRef = useRef("");

  // Keep ref in sync for use in callbacks
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Access code persists per device so the teacher enters it once.
  useEffect(() => {
    setCampKey(localStorage.getItem("camp_key") ?? "");
  }, []);

  const campFetch = useCallback(
    async (path: string, body: unknown) => {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-camp-key": campKey },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        // Clear the bad code so the gate reappears — on whichever screen the
        // teacher is on. Never navigate away: their words must stay put.
        localStorage.removeItem("camp_key");
        setCampKey("");
        throw new Error("Access code was rejected. Re-enter it below, then submit again.");
      }
      return res;
    },
    [campKey]
  );

  // Validate the code before accepting it, so a wrong or stale one is caught
  // now rather than after the teacher has already recorded their day.
  const handleUnlock = async () => {
    const key = campKeyInput.trim();
    if (!key || checkingKey) return;
    setCheckingKey(true);
    setCampKeyError("");
    try {
      const res = await fetch("/api/camp/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-camp-key": key },
        body: "{}",
      });
      if (res.status === 401) {
        setCampKeyError("That code didn't work. Check it and try again.");
        return;
      }
      if (!res.ok) {
        setCampKeyError("Couldn't check the code just now. Try again.");
        return;
      }
      localStorage.setItem("camp_key", key);
      setCampKey(key);
      setCampKeyInput("");
    } catch {
      setCampKeyError("Couldn't reach the server. Check your connection.");
    } finally {
      setCheckingKey(false);
    }
  };

  const accessCodeGate = (
    <div className="bg-sand rounded-2xl p-5 mb-6">
      <p className="text-xs font-medium text-warm-gray uppercase tracking-wider mb-3">
        Access code
      </p>
      <input
        type="password"
        value={campKeyInput}
        onChange={(e) => setCampKeyInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleUnlock();
        }}
        placeholder="Enter the camp access code"
        className="w-full bg-white rounded-xl p-3 text-sm text-espresso outline-none border border-sand-dark/50 focus:border-rust/50 transition-colors"
      />
      {campKeyError && (
        <p className="text-xs text-red-600 mt-2">{campKeyError}</p>
      )}
      <button
        onClick={handleUnlock}
        disabled={checkingKey}
        className="mt-3 w-full py-2.5 bg-rust text-white rounded-full text-sm font-medium hover:bg-rust/90 active:scale-95 transition-all disabled:opacity-50"
      >
        {checkingKey ? "Checking…" : "Unlock"}
      </button>
    </div>
  );

  // ─── Speech recognition setup ──────────────────────────────────
  const startRecognition = useCallback(
    (onResult: (final: string, interim: string) => void) => {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        setUseTextInput(true);
        return null;
      }

      recordingActiveRef.current = true;
      let rapidEnds = 0;
      let lastStart = Date.now();

      const spawn = (): SpeechRecognitionInstance => {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let final = "";
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const t = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              final += t + " ";
            } else {
              interim += t;
            }
          }
          onResult(final, interim);
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error("Speech error:", event.error);
          if (event.error === "not-allowed" || event.error === "service-not-available") {
            recordingActiveRef.current = false;
            setUseTextInput(true);
          }
          // Other errors ("no-speech", "aborted", "network") fall through to
          // onend, which restarts while the teacher still has the mic open.
        };

        recognition.onend = () => {
          // Browsers stop recognition after a few seconds of silence; restart
          // so the mic doesn't die mid-thought while the timer keeps running.
          if (!recordingActiveRef.current) return;
          rapidEnds = Date.now() - lastStart < 1000 ? rapidEnds + 1 : 0;
          if (rapidEnds >= 3) {
            // Ending immediately several times in a row means it's genuinely
            // failing, not pausing on silence — switch to typing so nothing
            // more is lost.
            recordingActiveRef.current = false;
            setUseTextInput(true);
            return;
          }
          lastStart = Date.now();
          recognitionRef.current = spawn();
        };

        recognition.start();
        return recognition;
      };

      return spawn();
    },
    []
  );

  // ─── Recording timer ───────────────────────────────────────────
  const startTimer = () => {
    setRecordingSeconds(0);
    timerRef.current = setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // ─── Step 1→2: Start recording ─────────────────────────────────
  const handleStartRecording = () => {
    setStep("recording");
    setTranscript("");
    setInterimText("");
    setError("");
    startTimer();

    const rec = startRecognition((final, interim) => {
      if (final) setTranscript((prev) => prev + final);
      setInterimText(interim);
    });
    recognitionRef.current = rec;
  };

  // ─── Step 2→review: Stop recording, show transcript for editing ──
  const handleStopRecording = () => {
    stopTimer();
    recordingActiveRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    const finalTranscript = useTextInput ? textInput : transcriptRef.current;
    if (!finalTranscript.trim()) {
      setStep("ready");
      return;
    }

    setTranscript(finalTranscript);
    setStep("review");
  };

  // ─── Step review→processing: Submit reviewed transcript ─────────
  const handleSubmitTranscript = async () => {
    if (!transcript.trim()) {
      setStep("ready");
      return;
    }

    setStep("processing");
    setError("");

    // Persist the raw transcript FIRST — a failed AI call must never lose
    // the teacher's words. Later saves update this same row.
    try {
      const saveRes = await campFetch("/api/camp/save", {
        id: savedIdRef.current ?? undefined,
        transcript,
        followupTranscript: "",
        observations: null,
        teacherName,
        date: new Date().toISOString().split("T")[0],
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || "Save failed");
      savedIdRef.current = saveData.id;
    } catch (err) {
      setError(
        (err instanceof Error ? err.message : "Couldn't save the recording.") +
          " Your words are still below — tap submit to retry."
      );
      setStep("review");
      return;
    }

    try {
      // Process observation
      const processRes = await campFetch("/api/camp/process", {
        transcript,
        teacherName,
      });
      const processData = await processRes.json();

      if (!processRes.ok || (processData.error && !processData.observations)) {
        setError(
          `${processData.error || "Couldn't process the recording."} Your recording is saved — tap submit to retry.`
        );
        setStep("review");
        return;
      }

      setObservations(processData.observations);

      // Get follow-up questions (optional — failures fall through to
      // "anything else?")
      let followupData: { followups?: FollowupQuestion[] } = {};
      try {
        const followupRes = await campFetch("/api/camp/followup", {
          transcript,
          observations: processData.observations,
          teacherName,
        });
        if (followupRes.ok) followupData = await followupRes.json();
      } catch {
        // Follow-ups are optional decoration; the transcript is already saved.
      }

      if (followupData.followups && followupData.followups.length > 0) {
        setFollowups(followupData.followups);
        setCurrentFollowupIndex(0);
        setFollowupResponses([]);
        setStep("followup-question");
      } else {
        // No follow-ups — go straight to "anything else?"
        setAllFollowupText("");
        setAnythingElseTranscript("");
        setAnythingElseTextInput("");
        setStep("anything-else");
      }
    } catch (err) {
      console.error(err);
      setError(
        "Couldn't process the recording — it's saved. Tap submit to retry."
      );
      setStep("review");
    }
  };

  // ─── Follow-up: Start recording for current question ─────────
  const handleStartFollowupRecording = () => {
    setStep("followup-recording");
    setFollowupTranscript("");
    setFollowupInterim("");
    setFollowupTextInput("");
    startTimer();

    const rec = startRecognition((final, interim) => {
      if (final) setFollowupTranscript((prev) => prev + final);
      setFollowupInterim(interim);
    });
    recognitionRef.current = rec;
  };

  // ─── Follow-up: Stop recording → go to review ──────────────
  const handleStopFollowupRecording = () => {
    stopTimer();
    recordingActiveRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    const finalText = useTextInput ? followupTextInput : followupTranscript;
    setFollowupTranscript(finalText);
    setStep("followup-review");
  };

  // ─── Follow-up: Submit reviewed response → next question or finish ──
  const handleSubmitFollowupResponse = () => {
    const newResponses = [...followupResponses, followupTranscript];
    setFollowupResponses(newResponses);

    const nextIndex = currentFollowupIndex + 1;
    if (nextIndex < followups.length) {
      setCurrentFollowupIndex(nextIndex);
      setFollowupTranscript("");
      setFollowupTextInput("");
      setStep("followup-question");
    } else {
      finishFollowups(newResponses);
    }
  };

  // ─── Follow-up: Skip current question ───────────────────────
  const handleSkipCurrentFollowup = () => {
    const newResponses = [...followupResponses, ""];
    setFollowupResponses(newResponses);

    const nextIndex = currentFollowupIndex + 1;
    if (nextIndex < followups.length) {
      setCurrentFollowupIndex(nextIndex);
      setStep("followup-question");
    } else {
      finishFollowups(newResponses);
    }
  };

  // ─── Follow-up: End all follow-ups early ────────────────────
  const handleEndFollowupsEarly = () => {
    finishFollowups(followupResponses);
  };

  // ─── Follow-up: Go to "anything else?" ───────────────────────
  const finishFollowups = (responses: string[]) => {
    const text = followups
      .map((fq, i) => responses[i] ? `Q: ${fq.question}\nA: ${responses[i]}` : "")
      .filter(Boolean)
      .join("\n\n");
    setAllFollowupText(text);
    setAnythingElseTranscript("");
    setAnythingElseTextInput("");
    setStep("anything-else");
  };

  // ─── "Anything else?" recording ─────────────────────────────
  const handleStartAnythingElse = () => {
    setStep("anything-else-recording");
    setAnythingElseTranscript("");
    setAnythingElseInterim("");
    setAnythingElseTextInput("");
    startTimer();

    const rec = startRecognition((final, interim) => {
      if (final) setAnythingElseTranscript((prev) => prev + final);
      setAnythingElseInterim(interim);
    });
    recognitionRef.current = rec;
  };

  const handleStopAnythingElse = () => {
    stopTimer();
    recordingActiveRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    const finalText = useTextInput ? anythingElseTextInput : anythingElseTranscript;
    setAnythingElseTranscript(finalText);
    setStep("anything-else-review");
  };

  const handleSubmitAnythingElse = () => {
    const extra = anythingElseTranscript.trim();
    const fullFollowup = extra
      ? `${allFollowupText}\n\n[Additional from ${teacherName}]: ${extra}`
      : allFollowupText;
    finalSaveAndProcess(fullFollowup);
  };

  // ─── "All done" from anything-else screen ───────────────────
  const handleCloseOut = () => {
    finalSaveAndProcess(allFollowupText);
  };

  // ─── Final save + process ───────────────────────────────────
  const finalSaveAndProcess = async (fullFollowup: string) => {
    finalFollowupRef.current = fullFollowup;
    setStep("processing-final");

    // Words first: persist transcript + follow-ups before any further AI work.
    const ok = await saveObservation(transcript, fullFollowup, observations);

    // Best-effort: re-extract with the follow-up context and refresh the row.
    // The words are already durable, so a failure here costs nothing.
    if (ok && fullFollowup) {
      try {
        const combinedTranscript = `${transcript}\n\n[Follow-up responses from ${teacherName}]:\n${fullFollowup}`;
        const processRes = await campFetch("/api/camp/process", {
          transcript: combinedTranscript,
          teacherName,
        });
        const processData = await processRes.json();
        if (processRes.ok && processData.observations) {
          setObservations(processData.observations);
          await saveObservation(transcript, fullFollowup, processData.observations);
        }
      } catch {
        // Keep the first-pass observations already saved above.
      }
    }

    setStep("done");
  };

  // ─── Save observation (returns whether the words are durably stored) ──
  const saveObservation = async (
    mainTranscript: string,
    followup: string,
    obs: Observations | null
  ): Promise<boolean> => {
    try {
      const res = await campFetch("/api/camp/save", {
        id: savedIdRef.current ?? undefined,
        transcript: mainTranscript,
        followupTranscript: followup,
        observations: obs,
        teacherName,
        date: new Date().toISOString().split("T")[0],
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      if (data.id) savedIdRef.current = data.id;
      setSaved(true);
      setError("");
      return true;
    } catch (err) {
      console.error("Failed to save:", err);
      setSaved(false);
      setError(
        err instanceof Error ? err.message : "Couldn't save the observation."
      );
      return false;
    }
  };

  const handleRetrySave = () => {
    saveObservation(transcript, finalFollowupRef.current, observations);
  };

  // ─── Start over ────────────────────────────────────────────────
  const handleReset = () => {
    savedIdRef.current = null;
    finalFollowupRef.current = "";
    recordingActiveRef.current = false;
    setStep("ready");
    setTranscript("");
    setInterimText("");
    setObservations(null);
    setFollowups([]);
    setCurrentFollowupIndex(0);
    setFollowupResponses([]);
    setFollowupTranscript("");
    setFollowupInterim("");
    setError("");
    setSaved(false);
    setRecordingSeconds(0);
    setTextInput("");
    setFollowupTextInput("");
    setAnythingElseTranscript("");
    setAnythingElseInterim("");
    setAnythingElseTextInput("");
    setAllFollowupText("");
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-lg mx-auto px-5 py-8 pb-24">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="font-[family-name:var(--font-playfair)] text-2xl font-semibold text-espresso">
            Camp Observations
          </h1>
          <p className="text-warm-gray text-sm mt-1">
            Hi {teacherName} — tell me about the kids&apos; day
          </p>
          {step === "ready" && (
            <div className="flex items-center justify-center gap-2 mt-3">
              {["Carla", "Miguel"].map((name) => (
                <button
                  key={name}
                  onClick={() => setTeacherName(name)}
                  className={`text-xs px-3 py-1.5 rounded-full transition-all ${
                    teacherName === name
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

        {/* ─── STEP: Ready ─────────────────────────────────── */}
        {step === "ready" && (
          <div className="fade-up">
            {/* Access code gate */}
            {!campKey && accessCodeGate}

            {/* Day flow memory triggers */}
            <div className="bg-sand rounded-2xl p-5 mb-6">
              <p className="text-xs font-medium text-warm-gray uppercase tracking-wider mb-3">
                Today&apos;s flow
              </p>
              <div className="space-y-2.5">
                {DAY_FLOW.map((item) => (
                  <div key={item.time} className="flex items-center gap-3">
                    <span className="text-lg">{item.emoji}</span>
                    <div>
                      <span className="text-sm font-medium text-espresso">
                        {item.time}
                      </span>
                      <span className="text-sm text-warm-gray ml-1.5">
                        {item.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Record button */}
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={handleStartRecording}
                disabled={!campKey}
                className="w-24 h-24 rounded-full bg-rust text-white flex items-center justify-center shadow-lg hover:bg-rust/90 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              </button>
              <p className="text-sm text-warm-gray">Tap to start talking</p>

              {useTextInput && (
                <p className="text-xs text-rust">
                  Voice not available — you can type instead
                </p>
              )}
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 rounded-xl text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        )}

        {/* ─── STEP: Recording ─────────────────────────────── */}
        {step === "recording" && (
          <div className="fade-up">
            {/* Recording indicator */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <span className="recording-pulse w-3 h-3 rounded-full bg-rust" />
              <span className="text-sm font-medium text-rust">
                Recording {formatTime(recordingSeconds)}
              </span>
            </div>

            {/* Live transcript */}
            <div className="bg-sand rounded-2xl p-5 mb-6 min-h-[160px]">
              {useTextInput ? (
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type what happened today with the kids..."
                  className="w-full bg-transparent text-espresso text-sm resize-none outline-none min-h-[140px] placeholder:text-warm-gray/50"
                  autoFocus
                />
              ) : (
                <p className="text-sm text-espresso leading-relaxed">
                  {transcript}
                  {interimText && (
                    <span className="text-warm-gray">{interimText}</span>
                  )}
                  {!transcript && !interimText && (
                    <span className="text-warm-gray/50">Listening...</span>
                  )}
                </p>
              )}
            </div>

            {/* Day flow reminders */}
            <div className="mb-4">
              <p className="text-xs font-medium text-warm-gray uppercase tracking-wider mb-2 text-center">
                Walk through the day
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {DAY_FLOW.map((item) => (
                  <span
                    key={item.time}
                    className="text-xs px-2.5 py-1.5 rounded-full bg-sand text-espresso border border-sand-dark/50"
                  >
                    {item.emoji} {item.time}
                  </span>
                ))}
              </div>
            </div>

            {/* Thought starters */}
            <div className="mb-6">
              <p className="text-xs font-medium text-warm-gray uppercase tracking-wider mb-2 text-center">
                Think about...
              </p>
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
            </div>

            {/* Stop button */}
            <div className="flex flex-col items-center">
              <button
                onClick={handleStopRecording}
                className="w-20 h-20 rounded-full bg-espresso text-white flex items-center justify-center shadow-lg active:scale-95 transition-all"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
              <p className="text-sm text-warm-gray mt-3">Tap to finish</p>
            </div>
          </div>
        )}

        {/* ─── STEP: Review transcript ──────────────────────── */}
        {step === "review" && (
          <div className="fade-up">
            {/* Whatever went wrong must be visible here — this screen is
                where every failed submit lands. */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 rounded-xl text-sm text-red-700">
                {error}
              </div>
            )}

            {/* A rejected code clears the key; offer it here rather than
                stranding the teacher with a transcript they can't submit. */}
            {!campKey && accessCodeGate}

            <div className="bg-sand rounded-2xl p-5 mb-4">
              <p className="text-xs font-medium text-warm-gray uppercase tracking-wider mb-3">
                Review your recording
              </p>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                className="w-full bg-white rounded-xl p-4 text-sm text-espresso leading-relaxed resize-none outline-none border border-sand-dark/50 focus:border-rust/50 transition-colors min-h-[160px]"
                rows={8}
              />
              <p className="text-xs text-warm-gray mt-2">
                Edit anything that was captured incorrectly before submitting.
              </p>
            </div>

            <div className="flex flex-col items-center gap-3">
              <button
                onClick={handleSubmitTranscript}
                disabled={!campKey}
                className="px-8 py-3 bg-rust text-white rounded-full text-sm font-medium shadow-md hover:bg-rust/90 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                Looks good — submit
              </button>
              <button
                onClick={() => {
                  setStep("recording");
                  startTimer();
                  const rec = startRecognition((final, interim) => {
                    if (final) setTranscript((prev) => prev + final);
                    setInterimText(interim);
                  });
                  recognitionRef.current = rec;
                }}
                className="text-sm text-warm-gray underline underline-offset-2"
              >
                Record more
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP: Processing ────────────────────────────── */}
        {(step === "processing" || step === "processing-final") && (
          <div className="fade-up flex flex-col items-center justify-center py-16">
            <div className="flex gap-1.5 mb-4">
              <span className="typing-dot w-2.5 h-2.5 rounded-full bg-rust" />
              <span className="typing-dot w-2.5 h-2.5 rounded-full bg-rust" style={{ animationDelay: "0.2s" }} />
              <span className="typing-dot w-2.5 h-2.5 rounded-full bg-rust" style={{ animationDelay: "0.4s" }} />
            </div>
            <p className="text-sm text-warm-gray">
              {step === "processing"
                ? "Listening to what you shared..."
                : "Updating observations..."}
            </p>
          </div>
        )}

        {/* ─── STEP: Follow-up question (one at a time) ────── */}
        {step === "followup-question" && followups[currentFollowupIndex] && (
          <div className="fade-up">
            {/* Progress indicator */}
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

            {/* The question */}
            <div className="bg-sand rounded-2xl p-5 mb-6">
              <p className="text-xs font-medium text-warm-gray uppercase tracking-wider mb-3">
                Follow-up {currentFollowupIndex + 1} of {followups.length}
              </p>
              <div className="flex gap-3">
                <span className="text-lg mt-0.5">
                  {followups[currentFollowupIndex].about_child === "felipe" ? "👦" : followups[currentFollowupIndex].about_child === "rafael" ? "👦" : "💭"}
                </span>
                <p className="text-base text-espresso leading-relaxed">
                  {followups[currentFollowupIndex].question}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <button
                onClick={handleStartFollowupRecording}
                className="w-20 h-20 rounded-full bg-rust text-white flex items-center justify-center shadow-lg hover:bg-rust/90 active:scale-95 transition-all"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              </button>
              <p className="text-sm text-warm-gray">Tap to respond</p>

              <div className="flex gap-4 mt-2">
                <button
                  onClick={handleSkipCurrentFollowup}
                  className="text-sm text-warm-gray underline underline-offset-2"
                >
                  Skip this one
                </button>
                <button
                  onClick={handleEndFollowupsEarly}
                  className="text-sm text-warm-gray underline underline-offset-2"
                >
                  That&apos;s everything
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP: Recording follow-up response ────────────── */}
        {step === "followup-recording" && followups[currentFollowupIndex] && (
          <div className="fade-up">
            {/* Keep the question visible */}
            <div className="bg-sand/60 rounded-xl p-3 mb-4">
              <p className="text-xs text-warm-gray">
                {followups[currentFollowupIndex].question}
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 mb-4">
              <span className="recording-pulse w-3 h-3 rounded-full bg-rust" />
              <span className="text-sm font-medium text-rust">
                Recording {formatTime(recordingSeconds)}
              </span>
            </div>

            <div className="bg-sand rounded-2xl p-5 mb-6 min-h-[120px]">
              {useTextInput ? (
                <textarea
                  value={followupTextInput}
                  onChange={(e) => setFollowupTextInput(e.target.value)}
                  placeholder="Type your response..."
                  className="w-full bg-transparent text-espresso text-sm resize-none outline-none min-h-[100px] placeholder:text-warm-gray/50"
                  autoFocus
                />
              ) : (
                <p className="text-sm text-espresso leading-relaxed">
                  {followupTranscript}
                  {followupInterim && (
                    <span className="text-warm-gray">{followupInterim}</span>
                  )}
                  {!followupTranscript && !followupInterim && (
                    <span className="text-warm-gray/50">Listening...</span>
                  )}
                </p>
              )}
            </div>

            <div className="flex flex-col items-center">
              <button
                onClick={handleStopFollowupRecording}
                className="w-20 h-20 rounded-full bg-espresso text-white flex items-center justify-center shadow-lg active:scale-95 transition-all"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
              <p className="text-sm text-warm-gray mt-3">Tap to finish</p>
            </div>
          </div>
        )}

        {/* ─── STEP: Review follow-up response ───────────────── */}
        {step === "followup-review" && followups[currentFollowupIndex] && (
          <div className="fade-up">
            {/* Keep the question visible */}
            <div className="bg-sand/60 rounded-xl p-3 mb-4">
              <p className="text-xs text-warm-gray">
                {followups[currentFollowupIndex].question}
              </p>
            </div>

            <div className="bg-sand rounded-2xl p-5 mb-4">
              <p className="text-xs font-medium text-warm-gray uppercase tracking-wider mb-3">
                Review your response
              </p>
              <textarea
                value={followupTranscript}
                onChange={(e) => setFollowupTranscript(e.target.value)}
                className="w-full bg-white rounded-xl p-4 text-sm text-espresso leading-relaxed resize-none outline-none border border-sand-dark/50 focus:border-rust/50 transition-colors min-h-[100px]"
                rows={4}
              />
              <p className="text-xs text-warm-gray mt-2">
                Edit anything that was captured incorrectly.
              </p>
            </div>

            <div className="flex flex-col items-center gap-3">
              <button
                onClick={handleSubmitFollowupResponse}
                className="px-8 py-3 bg-rust text-white rounded-full text-sm font-medium shadow-md hover:bg-rust/90 active:scale-95 transition-all"
              >
                {currentFollowupIndex + 1 < followups.length ? "Next question" : "Finish"}
              </button>
              <button
                onClick={() => {
                  setStep("followup-recording");
                  setFollowupTranscript("");
                  setFollowupInterim("");
                  startTimer();
                  const rec = startRecognition((final, interim) => {
                    if (final) setFollowupTranscript((prev) => prev + final);
                    setFollowupInterim(interim);
                  });
                  recognitionRef.current = rec;
                }}
                className="text-sm text-warm-gray underline underline-offset-2"
              >
                Re-record
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP: Anything else? ──────────────────────────── */}
        {step === "anything-else" && (
          <div className="fade-up">
            <div className="bg-sand rounded-2xl p-5 mb-6">
              <div className="flex gap-3">
                <span className="text-lg mt-0.5">💭</span>
                <p className="text-base text-espresso leading-relaxed">
                  Is there anything else you forgot to mention or want to capture?
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-3 w-full max-w-xs">
                <button
                  onClick={handleStartAnythingElse}
                  className="flex-1 py-3 bg-rust text-white rounded-full text-sm font-medium shadow-md hover:bg-rust/90 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                  Record more
                </button>
                <button
                  onClick={handleCloseOut}
                  className="flex-1 py-3 bg-espresso text-white rounded-full text-sm font-medium shadow-md hover:bg-espresso/90 active:scale-95 transition-all"
                >
                  All done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP: Anything-else recording ──────────────────── */}
        {step === "anything-else-recording" && (
          <div className="fade-up">
            <div className="flex items-center justify-center gap-3 mb-4">
              <span className="recording-pulse w-3 h-3 rounded-full bg-rust" />
              <span className="text-sm font-medium text-rust">
                Recording {formatTime(recordingSeconds)}
              </span>
            </div>

            <div className="bg-sand rounded-2xl p-5 mb-6 min-h-[120px]">
              {useTextInput ? (
                <textarea
                  value={anythingElseTextInput}
                  onChange={(e) => setAnythingElseTextInput(e.target.value)}
                  placeholder="Anything else you want to add..."
                  className="w-full bg-transparent text-espresso text-sm resize-none outline-none min-h-[100px] placeholder:text-warm-gray/50"
                  autoFocus
                />
              ) : (
                <p className="text-sm text-espresso leading-relaxed">
                  {anythingElseTranscript}
                  {anythingElseInterim && (
                    <span className="text-warm-gray">{anythingElseInterim}</span>
                  )}
                  {!anythingElseTranscript && !anythingElseInterim && (
                    <span className="text-warm-gray/50">Listening...</span>
                  )}
                </p>
              )}
            </div>

            <div className="flex flex-col items-center">
              <button
                onClick={handleStopAnythingElse}
                className="w-20 h-20 rounded-full bg-espresso text-white flex items-center justify-center shadow-lg active:scale-95 transition-all"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
              <p className="text-sm text-warm-gray mt-3">Tap to finish</p>
            </div>
          </div>
        )}

        {/* ─── STEP: Anything-else review ─────────────────────── */}
        {step === "anything-else-review" && (
          <div className="fade-up">
            <div className="bg-sand rounded-2xl p-5 mb-4">
              <p className="text-xs font-medium text-warm-gray uppercase tracking-wider mb-3">
                Review what you added
              </p>
              <textarea
                value={anythingElseTranscript}
                onChange={(e) => setAnythingElseTranscript(e.target.value)}
                className="w-full bg-white rounded-xl p-4 text-sm text-espresso leading-relaxed resize-none outline-none border border-sand-dark/50 focus:border-rust/50 transition-colors min-h-[100px]"
                rows={4}
              />
              <p className="text-xs text-warm-gray mt-2">
                Edit anything that was captured incorrectly.
              </p>
            </div>

            <div className="flex flex-col items-center gap-3">
              <button
                onClick={handleSubmitAnythingElse}
                className="px-8 py-3 bg-rust text-white rounded-full text-sm font-medium shadow-md hover:bg-rust/90 active:scale-95 transition-all"
              >
                Submit & finish
              </button>
              <button
                onClick={() => {
                  setStep("anything-else-recording");
                  setAnythingElseTranscript("");
                  setAnythingElseInterim("");
                  startTimer();
                  const rec = startRecognition((final, interim) => {
                    if (final) setAnythingElseTranscript((prev) => prev + final);
                    setAnythingElseInterim(interim);
                  });
                  recognitionRef.current = rec;
                }}
                className="text-sm text-warm-gray underline underline-offset-2"
              >
                Re-record
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP: Done ──────────────────────────────────── */}
        {step === "done" && (
          <div className="fade-up">
            <div className="text-center py-12">
              <span className="text-4xl">🙏</span>
              <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold text-espresso mt-4">
                Thanks, {teacherName}!
              </h2>
              <p className="text-sm text-warm-gray mt-2">
                {saved
                  ? "Your observations have been saved. I'll follow up with you on what we learned."
                  : "We hit a snag saving — your words are safe on this device until it works."}
              </p>
              {saved ? (
                <p className="text-xs text-sage mt-3">Saved successfully</p>
              ) : (
                <div className="mt-3">
                  {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
                  {/* A rejected code clears the key here too — retrying
                      without re-entering it would just fail again. */}
                  {!campKey && <div className="text-left mt-3">{accessCodeGate}</div>}
                  <button
                    onClick={handleRetrySave}
                    disabled={!campKey}
                    className="text-xs text-rust underline underline-offset-2 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Retry save
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-center pt-4">
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-rust text-white rounded-full text-sm font-medium shadow-md hover:bg-rust/90 active:scale-95 transition-all"
              >
                Record another observation
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

