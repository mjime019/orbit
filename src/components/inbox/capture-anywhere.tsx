"use client";

import { useCallback, useEffect, useState } from "react";

// The parent's private inbox token + the recipe for a Siri shortcut that
// posts dictated words to /api/inbox. The token is shown masked; copying
// it is deliberate.
export function CaptureAnywhere() {
  const [token, setToken] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<"token" | "url" | null>(null);
  const [rotating, setRotating] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/inbox/token");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load your token");
      setToken(data.token ?? null);
      setEndpoint(data.endpoint ?? "");
      setUnavailable(Boolean(data.unavailable) || !data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your token");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const copy = async (what: "token" | "url", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("Couldn't copy — select it and copy by hand.");
    }
  };

  const rotate = async () => {
    if (rotating) return;
    if (!window.confirm("Make a new token? Any shortcut using the old one stops working.")) return;
    setRotating(true);
    setError("");
    try {
      const res = await fetch("/api/inbox/token", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't rotate");
      setToken(data.token);
      setRevealed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't rotate");
    } finally {
      setRotating(false);
    }
  };

  const masked = token ? token.slice(0, 6) + "…" + token.slice(-4) : "";

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 rounded-xl text-sm text-red-700">{error}</div>
      )}

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-sand-dark/40">
        <p className="text-sm font-semibold text-espresso">✉️ Reply to the email</p>
        <p className="text-xs text-warm-gray mt-1.5 leading-relaxed">
          Twice a week Orbit emails one question per kid. Reply with a line or two —
          the reply lands here as a moment waiting for your OK. No app needed.
        </p>
        <a
          href="/api/digest/send?preview=1"
          target="_blank"
          rel="noreferrer"
          className="inline-block mt-3 text-xs font-medium text-rust underline underline-offset-2"
        >
          Preview this week&apos;s email →
        </a>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-sand-dark/40">
        <p className="text-sm font-semibold text-espresso">🎙️ A Siri shortcut</p>
        <p className="text-xs text-warm-gray mt-1.5 leading-relaxed">
          &ldquo;Hey Siri, Orbit note&rdquo; → say it → it&apos;s in your inbox. Built
          once in the Shortcuts app with your private token below.
        </p>

        {unavailable ? (
          <p className="mt-3 text-xs text-espresso bg-golden/10 rounded-xl p-3">
            Your token appears once scripts/pivot/10-inbox-digest.sql has run.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 bg-cream rounded-xl px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-warm-gray w-12 shrink-0">
                URL
              </span>
              <code className="text-xs text-espresso font-[family-name:var(--font-meta)] truncate flex-1">
                {endpoint}
              </code>
              <button
                onClick={() => copy("url", endpoint)}
                className="text-[11px] font-medium text-rust shrink-0"
              >
                {copied === "url" ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="flex items-center gap-2 bg-cream rounded-xl px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-warm-gray w-12 shrink-0">
                Token
              </span>
              <code className="text-xs text-espresso font-[family-name:var(--font-meta)] truncate flex-1">
                {revealed ? token : masked}
              </code>
              <button
                onClick={() => setRevealed((v) => !v)}
                className="text-[11px] text-warm-gray shrink-0"
              >
                {revealed ? "Hide" : "Show"}
              </button>
              <button
                onClick={() => token && copy("token", token)}
                className="text-[11px] font-medium text-rust shrink-0"
              >
                {copied === "token" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        <ol className="mt-4 space-y-1.5 text-xs text-espresso/85 leading-relaxed list-decimal pl-4">
          <li>Shortcuts app → <span className="font-semibold">+</span> → name it &ldquo;Orbit note&rdquo;.</li>
          <li>Add <span className="font-semibold">Dictate Text</span> (or <span className="font-semibold">Ask for Input</span> if you type with Wispr Flow).</li>
          <li>
            Add <span className="font-semibold">Get Contents of URL</span>: the URL above,
            Method <span className="font-semibold">POST</span>, Headers{" "}
            <code className="font-[family-name:var(--font-meta)]">Authorization</code> ={" "}
            <code className="font-[family-name:var(--font-meta)]">Bearer YOUR-TOKEN</code>, Request Body{" "}
            <span className="font-semibold">JSON</span> with one field{" "}
            <code className="font-[family-name:var(--font-meta)]">text</code> = the dictated text.
          </li>
          <li>Add <span className="font-semibold">Get Dictionary Value</span> for key <code className="font-[family-name:var(--font-meta)]">message</code>, then <span className="font-semibold">Speak Text</span> (or Show Result).</li>
        </ol>
        <p className="text-[11px] text-warm-gray mt-3 leading-relaxed">
          Orbit answers with something like &ldquo;Got it — 1 moment about Rafael,
          waiting for your OK.&rdquo; Add a <code className="font-[family-name:var(--font-meta)]">childId</code> field to the body if you want a
          shortcut per kid.
        </p>

        {!unavailable && (
          <button
            onClick={rotate}
            disabled={rotating}
            className="mt-3 text-[11px] text-warm-gray underline underline-offset-2 disabled:opacity-40"
          >
            {rotating ? "Making a new token…" : "Make a new token"}
          </button>
        )}
      </div>
    </div>
  );
}
