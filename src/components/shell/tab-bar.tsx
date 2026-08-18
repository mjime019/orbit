"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Round 4: three tabs + capture. The Journey tab folded into each kid's
// Story (Home now owns the kid pages); Ask moved to the More page.
const TABS = [
  {
    href: "/parent",
    label: "Home",
    emoji: "🏠",
    match: /^\/parent$|^\/parent\/(kid|growth|understand|onboarding|highlights)/,
  },
  { href: "/capture", label: "", emoji: "", match: /^\/capture/, center: true },
  {
    href: "/parent/planners",
    label: "More",
    emoji: "🗺️",
    match: /^\/parent\/(planners|activities|weekends|extras|transition|chat)/,
  },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 pointer-events-none">
      <div className="mx-auto max-w-[640px] pointer-events-auto">
        <div
          className="bg-white/95 backdrop-blur border-t border-sand-dark/50 px-2 flex items-end justify-around"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {TABS.map((tab) =>
            tab.center ? (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label="Capture a moment"
                className="relative -top-4 w-14 h-14 rounded-full bg-rust text-white flex items-center justify-center shadow-lg hover:bg-rust/90 active:scale-95 transition-all"
              >
                {/* Pencil — capture is type-or-dictate now, not mic-first. */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                </svg>
              </Link>
            ) : (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 py-2 px-3 text-[11px] font-medium transition-colors ${
                  tab.match.test(pathname)
                    ? "text-rust"
                    : "text-warm-gray hover:text-espresso"
                }`}
              >
                <span className="text-lg leading-none">{tab.emoji}</span>
                {tab.label}
              </Link>
            )
          )}
        </div>
      </div>
    </nav>
  );
}
