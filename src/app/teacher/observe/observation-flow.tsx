"use client";

import { useState, useRef, useEffect } from "react";
import { useSpeechCapture } from "@/lib/use-speech-capture";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { DomainPill } from "@/components/ui/domain-pill";
import { SectionHead } from "@/components/ui/section-head";
import {
  DOMAIN_CONFIG,
  SOCIAL_TAG_CONFIG,
  type DevDomain,
  type SocialTag,
  type ObservationExtraction,
} from "@/lib/types";

type Screen = "select" | "capture" | "review";

interface ObservationFlowProps {
  roster: { id: string; name: string; date_of_birth: string | null }[];
  classroomName: string;
  classroomTheme: string | null;
}

export function ObservationFlow({
  roster,
  classroomName,
  classroomTheme,
}: ObservationFlowProps) {
  const [screen, setScreen] = useState<Screen>("select");
  const [selectedChild, setSelectedChild] = useState<
    (typeof roster)[0] | null
  >(null);
  const [note, setNote] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extraction, setExtraction] = useState<ObservationExtraction | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Editable fields on review screen
  const [editedDomains, setEditedDomains] = useState<DevDomain[]>([]);
  const [editedSocialTag, setEditedSocialTag] = useState<SocialTag | null>(
    null
  );

  // Voice input — shared engine (interim capture, auto-restart on silence,
  // interim merged on stop so the tail of dictation is never lost)
  const speech = useSpeechCapture();
  const isListening = speech.recording;
  const hasVoiceSupport = speech.supported && !speech.fallbackToText;
  // The note as it was when the mic opened; dictation appends to it on stop.
  const noteBaseRef = useRef("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea on capture screen
  useEffect(() => {
    if (screen === "capture" && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [screen]);

  const selectChild = (child: (typeof roster)[0]) => {
    setSelectedChild(child);
    setNote("");
    setExtraction(null);
    setError(null);
    setScreen("capture");
  };

  const toggleDomain = (domain: DevDomain) => {
    setEditedDomains((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]
    );
  };

  const startListening = () => {
    noteBaseRef.current = note;
    speech.start();
  };

  const stopListening = () => {
    if (!speech.recording) return;
    const spoken = speech.stop();
    setNote(
      `${noteBaseRef.current} ${spoken}`.replace(/\s+/g, " ").trim()
    );
  };

  // While dictating, the textarea mirrors base note + live speech (interim
  // included) and is read-only; edits resume when the mic stops.
  const liveNote = isListening
    ? `${noteBaseRef.current} ${speech.finalText}${speech.interimText}`
        .replace(/\s+/g, " ")
        .trimStart()
    : note;

  const handleCapture = async () => {
    // Tapping capture mid-dictation commits the live speech (incl. interim)
    // instead of analyzing a stale note.
    let currentNote = note;
    if (speech.recording) {
      const spoken = speech.stop();
      currentNote = `${noteBaseRef.current} ${spoken}`
        .replace(/\s+/g, " ")
        .trim();
      setNote(currentNote);
    }
    if (!selectedChild || !currentNote.trim()) return;
    setIsExtracting(true);
    setError(null);

    try {
      const res = await fetch("/api/teacher/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId: selectedChild.id, note: currentNote.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Extraction failed");
      }

      setExtraction(data);
      setEditedDomains(data.domains ?? []);
      setEditedSocialTag(data.social_tag ?? null);
      setScreen("review");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not analyze observation"
      );
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveRaw = async () => {
    if (!selectedChild || !note.trim()) return;
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/teacher/observe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          child_id: selectedChild.id,
          note: note.trim(),
          domains: [],
          social_tag: null,
          other_children_ids: [],
        }),
      });
      if (!res.ok) throw new Error("Save failed");

      setSavedCount((c) => c + 1);
      setNote("");
      setExtraction(null);
      setSelectedChild(null);
      setScreen("select");
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selectedChild || !note.trim()) return;
    setIsSaving(true);
    setError(null);

    // Resolve other_children names to IDs
    const otherChildrenIds = (extraction?.other_children ?? [])
      .map(
        (name) =>
          roster.find(
            (c) => c.name.toLowerCase() === name.toLowerCase()
          )?.id
      )
      .filter(Boolean) as string[];

    try {
      const res = await fetch("/api/teacher/observe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          child_id: selectedChild.id,
          note: note.trim(),
          domains: editedDomains,
          social_tag: editedSocialTag,
          other_children_ids: otherChildrenIds,
        }),
      });

      if (!res.ok) throw new Error("Save failed");

      setSavedCount((c) => c + 1);
      setNote("");
      setExtraction(null);
      setSelectedChild(null);
      setScreen("select");
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // ─── SELECT CHILD ─────────────────────────────────────────
  if (screen === "select") {
    return (
      <div className="min-h-screen bg-cream">
        <div className="mx-auto max-w-[520px] px-6 pt-7 pb-24">
          {/* Header */}
          <div className="fade-up flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rust" />
                <span className="text-xs font-bold tracking-widest uppercase text-rust">
                  Orbit
                </span>
              </div>
              <h1 className="font-[family-name:var(--font-playfair)] text-[26px] font-semibold leading-tight text-espresso">
                Capture Observation
              </h1>
              <p className="text-sm text-warm-gray mt-1">
                {classroomName}
                {classroomTheme && (
                  <span className="text-rust"> &middot; {classroomTheme}</span>
                )}
              </p>
            </div>
            <Link
              href="/teacher"
              className="w-10 h-10 rounded-full border-2 border-sand-dark bg-white text-sm flex items-center justify-center hover:shadow-md transition-shadow"
            >
              &larr;
            </Link>
          </div>

          {/* Success counter */}
          {savedCount > 0 && (
            <div className="fade-up mb-4 px-4 py-2.5 rounded-xl bg-sage/10 text-sage text-sm font-semibold text-center">
              {savedCount} observation{savedCount !== 1 ? "s" : ""} captured
              today
            </div>
          )}

          <SectionHead emoji={"\u{1F466}"} title="Select a Child" />

          {roster.length === 0 ? (
            <Card>
              <p className="text-sm text-warm-gray text-center">
                No children found in this classroom.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {roster.map((child, i) => (
                <button
                  key={child.id}
                  onClick={() => selectChild(child)}
                  className={`fade-up delay-${Math.min(i + 1, 6)} flex flex-col items-center gap-2 p-4 rounded-2xl bg-white shadow-sm hover:shadow-md transition-all active:scale-95`}
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rust to-[#47B3FF] text-white text-lg font-bold flex items-center justify-center font-[family-name:var(--font-playfair)]">
                    {child.name.charAt(0)}
                  </div>
                  <span className="text-xs font-semibold text-espresso">
                    {child.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── CAPTURE ──────────────────────────────────────────────
  if (screen === "capture") {
    return (
      <div className="min-h-screen bg-cream">
        <div className="mx-auto max-w-[520px] px-6 pt-7 pb-24">
          {/* Header */}
          <div className="fade-up flex items-center gap-3 mb-6">
            <button
              onClick={() => {
                stopListening();
                setScreen("select");
              }}
              className="w-10 h-10 rounded-full border-2 border-sand-dark bg-white text-sm flex items-center justify-center hover:shadow-md transition-shadow"
            >
              &larr;
            </button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rust to-[#47B3FF] text-white text-sm font-bold flex items-center justify-center font-[family-name:var(--font-playfair)]">
              {selectedChild?.name.charAt(0)}
            </div>
            <div className="flex-1">
              <h2 className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-espresso">
                {selectedChild?.name}
              </h2>
              {classroomTheme && (
                <p className="text-xs text-warm-gray">
                  Theme: {classroomTheme}
                </p>
              )}
            </div>
          </div>

          {/* Observation input */}
          <Card className="fade-up delay-1">
            <label className="text-xs font-bold uppercase tracking-wider text-warm-gray mb-3 block">
              What did you notice?
            </label>
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={liveNote}
                onChange={(e) => setNote(e.target.value)}
                readOnly={isListening}
                placeholder={`What did you notice about ${selectedChild?.name}?`}
                disabled={isExtracting}
                className="w-full min-h-[160px] p-4 rounded-xl border-2 border-sand-dark bg-cream text-[15px] leading-relaxed text-espresso placeholder:text-warm-gray/50 focus:outline-none focus:border-rust/40 transition-colors resize-none disabled:opacity-50"
              />

              {/* Voice button */}
              {hasVoiceSupport && (
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={isExtracting}
                  className={`absolute bottom-3 right-3 w-11 h-11 rounded-full flex items-center justify-center text-lg transition-all ${
                    isListening
                      ? "bg-red-500 text-white shadow-lg animate-pulse"
                      : "bg-white border-2 border-sand-dark text-warm-gray hover:shadow-md"
                  }`}
                >
                  {isListening ? "\u{23F9}" : "\u{1F3A4}"}
                </button>
              )}
            </div>

            {isListening && (
              <p className="text-xs text-red-500 font-semibold mt-2 animate-pulse">
                Listening — tap ⏹ when you&apos;re done
              </p>
            )}
            {speech.fallbackToText && (
              <p className="text-xs text-warm-gray mt-2">
                Voice isn&apos;t available right now — typing works.
              </p>
            )}
          </Card>

          {/* Error */}
          {error && (
            <div className="mt-3 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm">
              {error}
              <button
                onClick={handleSaveRaw}
                disabled={isSaving}
                className="block mt-2 text-xs font-semibold text-rust underline"
              >
                Save without analysis
              </button>
            </div>
          )}

          {/* Capture button */}
          <button
            onClick={handleCapture}
            disabled={!liveNote.trim() || isExtracting}
            className="fade-up delay-2 mt-4 w-full py-4 rounded-2xl font-semibold text-white transition-all disabled:opacity-40 bg-rust hover:bg-rust/90 active:scale-[0.98]"
          >
            {isExtracting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analyzing...
              </span>
            ) : (
              "Capture Observation"
            )}
          </button>
        </div>
      </div>
    );
  }

  // ─── REVIEW ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-[520px] px-6 pt-7 pb-24">
        {/* Header */}
        <div className="fade-up flex items-center gap-3 mb-6">
          <button
            onClick={() => setScreen("capture")}
            className="w-10 h-10 rounded-full border-2 border-sand-dark bg-white text-sm flex items-center justify-center hover:shadow-md transition-shadow"
          >
            &larr;
          </button>
          <div className="flex-1">
            <h2 className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-espresso">
              Review Observation
            </h2>
            <p className="text-xs text-warm-gray">{selectedChild?.name}</p>
          </div>
        </div>

        {/* Original note */}
        <Card className="fade-up delay-1 mb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-warm-gray mb-2">
            Your observation
          </p>
          <p className="text-[15px] leading-relaxed">{note}</p>
        </Card>

        {/* AI Summary (if different from note) */}
        {extraction?.summary && extraction.summary !== note && (
          <div className="fade-up delay-2 mb-4 px-4 py-3 rounded-xl bg-sand text-sm text-warm-gray italic leading-relaxed">
            {extraction.summary}
          </div>
        )}

        {/* Key quote */}
        {extraction?.key_quote && (
          <div className="fade-up delay-2 mb-4 px-4 py-3 rounded-xl border-l-4 border-golden bg-golden/5">
            <p className="text-sm italic text-espresso">
              &ldquo;{extraction.key_quote}&rdquo;
            </p>
            <p className="text-[11px] text-warm-gray mt-1">
              &mdash; {selectedChild?.name}
            </p>
          </div>
        )}

        {/* Clarification needed */}
        {extraction?.clarification_needed && (
          <div className="fade-up delay-2 mb-4 px-4 py-3 rounded-xl bg-golden/10 text-sm text-espresso">
            <span className="font-semibold">AI question: </span>
            {extraction.clarification_needed}
            <button
              onClick={() => setScreen("capture")}
              className="block mt-2 text-xs font-semibold text-rust underline"
            >
              Edit note
            </button>
          </div>
        )}

        {/* Domains */}
        <Card className="fade-up delay-3 mb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-warm-gray mb-3">
            Developmental Domains
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(DOMAIN_CONFIG) as DevDomain[]).map((key) => (
              <button
                key={key}
                onClick={() => toggleDomain(key)}
                className={`transition-opacity ${
                  editedDomains.includes(key) ? "opacity-100" : "opacity-25"
                }`}
              >
                <DomainPill domain={key} />
              </button>
            ))}
          </div>
        </Card>

        {/* Social tag */}
        <Card className="fade-up delay-4 mb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-warm-gray mb-3">
            Social Moment
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(SOCIAL_TAG_CONFIG) as [SocialTag, { emoji: string; label: string }][]).map(
              ([key, config]) => (
                <button
                  key={key}
                  onClick={() =>
                    setEditedSocialTag(editedSocialTag === key ? null : key)
                  }
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    editedSocialTag === key
                      ? "bg-rust text-white border-rust"
                      : "bg-white text-warm-gray border-sand-dark"
                  }`}
                >
                  {config.emoji} {config.label}
                </button>
              )
            )}
          </div>
        </Card>

        {/* Other children mentioned */}
        {extraction?.other_children && extraction.other_children.length > 0 && (
          <Card className="fade-up delay-5 mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-warm-gray mb-2">
              Other Children Mentioned
            </p>
            <div className="flex flex-wrap gap-1.5">
              {extraction.other_children.map((name) => (
                <span
                  key={name}
                  className="text-xs px-2.5 py-1 rounded-full bg-sand font-semibold text-espresso"
                >
                  {name}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="fade-up delay-6 w-full py-4 rounded-2xl font-semibold text-white transition-all disabled:opacity-40 bg-rust hover:bg-rust/90 active:scale-[0.98]"
        >
          {isSaving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </span>
          ) : (
            "Save Observation"
          )}
        </button>
      </div>
    </div>
  );
}
