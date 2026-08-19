"use client";

import { useEffect, useRef } from "react";
import { useSpeechCapture } from "@/lib/use-speech-capture";

// The one input surface for capture: a real textarea first (Wispr Flow and
// native keyboard dictation type straight into it), with the in-app mic as
// an assist that appends live into the same box. Dictation streams through
// onChange continuously, so the parent's value is always current — submitting
// mid-dictation loses nothing.
export function ComposeBox({
  value,
  onChange,
  placeholder,
  disabled = false,
  minHeight = "160px",
  autoFocus = false,
  borderClass = "border-sand-dark",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: string;
  autoFocus?: boolean;
  /** Kid-scoped capture tints the box in that kid's color. */
  borderClass?: string;
}) {
  const speech = useSpeechCapture();
  const baseRef = useRef("");

  // Stream dictation into the parent's value as it arrives. onChange is a
  // setState in practice — same-value calls no-op, so extra runs are free.
  useEffect(() => {
    if (!speech.recording) return;
    const merged = `${baseRef.current} ${speech.finalText}${speech.interimText}`
      .replace(/\s+/g, " ")
      .trimStart();
    onChange(merged);
  }, [speech.recording, speech.finalText, speech.interimText, onChange]);

  const startDictation = () => {
    baseRef.current = value;
    speech.start();
  };
  const stopDictation = () => {
    if (!speech.recording) return;
    const spoken = speech.stop();
    onChange(`${baseRef.current} ${spoken}`.replace(/\s+/g, " ").trim());
  };

  return (
    <div>
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={speech.recording}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          style={{ minHeight }}
          className={`w-full p-4 pr-14 rounded-xl border-2 ${borderClass} bg-white text-[15px] leading-relaxed text-espresso placeholder:text-warm-gray/50 focus:outline-none focus:border-rust/40 transition-colors resize-none disabled:opacity-50`}
        />
        {!speech.fallbackToText && (
          <button
            onClick={speech.recording ? stopDictation : startDictation}
            disabled={disabled}
            aria-label={speech.recording ? "Stop dictating" : "Dictate"}
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
          Listening — tap ⏹ when you&apos;re done, or just keep typing after
        </p>
      )}
    </div>
  );
}
