"use client";

// Renders when a parent page throws (e.g. the database is paused or
// unreachable). A visible, honest error beats confidently-empty widgets.
export default function ParentError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="bg-sand rounded-2xl px-6 py-10 text-center mt-8">
      <span className="text-3xl">🌧️</span>
      <p className="text-sm font-semibold text-espresso mt-3">
        We couldn&apos;t load this right now
      </p>
      <p className="text-xs text-warm-gray mt-1.5 leading-relaxed">
        The connection to Orbit&apos;s data hiccuped. Your information is safe —
        this is a loading problem, not a data problem.
      </p>
      <button
        onClick={reset}
        className="mt-4 px-5 py-2.5 bg-rust text-white rounded-full text-xs font-medium shadow-sm hover:bg-rust/90 active:scale-95 transition-all"
      >
        Try again
      </button>
    </div>
  );
}
