"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Web Speech API types (not in all TS lib targets) ───────────────
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

export interface SpeechCapture {
  /** False when the browser has no speech API — caller shows a textarea. */
  supported: boolean;
  recording: boolean;
  /** Accumulated finalized text for the current session. */
  finalText: string;
  /** Live provisional text — render dimmed. Included in stop()'s result. */
  interimText: string;
  /** Set when the mic is unusable (denied, or dying repeatedly) — switch to typing. */
  fallbackToText: boolean;
  start: () => void;
  /**
   * Ends the session and returns final + interim merged. The interim buffer
   * is what the speaker just said that the browser hasn't finalized yet —
   * dropping it is how words get lost. Never drop it.
   */
  stop: () => string;
  reset: () => void;
}

// The engine is a verbatim port of the camp tool's proven recognizer
// (continuous + interim + auto-restart on silence + rapid-end degradation),
// with one behavioral change: stop() merges the interim buffer instead of
// discarding it.
export function useSpeechCapture(): SpeechCapture {
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [fallbackToText, setFallbackToText] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const activeRef = useRef(false);
  const finalRef = useRef("");
  const interimRef = useRef("");

  // Environment detection must run client-side after mount (SSR has no
  // window), same pattern as the localStorage read in transition-navigator.
  useEffect(() => {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSupported(false);
      setFallbackToText(true);
    }
  }, []);

  const detach = (rec: SpeechRecognitionInstance | null) => {
    if (!rec) return;
    rec.onresult = null;
    rec.onend = null;
    rec.onerror = null;
    try {
      rec.stop();
    } catch {
      // already stopped
    }
  };

  const start = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSupported(false);
      setFallbackToText(true);
      return;
    }

    // Fresh session
    detach(recognitionRef.current);
    finalRef.current = "";
    interimRef.current = "";
    setFinalText("");
    setInterimText("");
    activeRef.current = true;
    setRecording(true);

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
        if (final) {
          finalRef.current += final;
          setFinalText(finalRef.current);
        }
        interimRef.current = interim;
        setInterimText(interim);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech error:", event.error);
        if (
          event.error === "not-allowed" ||
          event.error === "service-not-available"
        ) {
          activeRef.current = false;
          setRecording(false);
          setFallbackToText(true);
        }
        // Other errors ("no-speech", "aborted", "network") fall through to
        // onend, which restarts while the speaker still has the mic open.
      };

      recognition.onend = () => {
        // Browsers stop recognition after a few seconds of silence; restart
        // so the mic doesn't die mid-thought while a timer keeps running.
        if (!activeRef.current) return;
        rapidEnds = Date.now() - lastStart < 1000 ? rapidEnds + 1 : 0;
        if (rapidEnds >= 3) {
          // Ending immediately several times in a row means it's genuinely
          // failing, not pausing on silence — degrade to typing so nothing
          // more is lost.
          activeRef.current = false;
          setRecording(false);
          setFallbackToText(true);
          return;
        }
        lastStart = Date.now();
        recognitionRef.current = spawn();
      };

      recognition.start();
      return recognition;
    };

    recognitionRef.current = spawn();
  }, []);

  const stop = useCallback((): string => {
    activeRef.current = false;
    setRecording(false);
    // Detach handlers BEFORE .stop() — a late-arriving final result would
    // otherwise double-append what we merge below.
    detach(recognitionRef.current);
    recognitionRef.current = null;

    const merged = `${finalRef.current} ${interimRef.current}`
      .replace(/\s+/g, " ")
      .trim();
    finalRef.current = merged ? merged + " " : "";
    interimRef.current = "";
    setFinalText(merged);
    setInterimText("");
    return merged;
  }, []);

  const reset = useCallback(() => {
    activeRef.current = false;
    setRecording(false);
    detach(recognitionRef.current);
    recognitionRef.current = null;
    finalRef.current = "";
    interimRef.current = "";
    setFinalText("");
    setInterimText("");
  }, []);

  // Never leave a live mic behind on unmount.
  useEffect(() => {
    return () => {
      activeRef.current = false;
      detach(recognitionRef.current);
      recognitionRef.current = null;
    };
  }, []);

  return {
    supported,
    recording,
    finalText,
    interimText,
    fallbackToText,
    start,
    stop,
    reset,
  };
}
