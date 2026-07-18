"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/parent", label: "Home", emoji: "🏠", match: /^\/parent$/ },
  {
    href: "/parent/growth",
    label: "Journey",
    emoji: "🌱",
    match: /^\/parent\/(kid|growth|understand|onboarding|highlights)/,
  },
  { href: "/capture", label: "", emoji: "", match: /^\/capture/, center: true },
  { href: "/parent/chat", label: "Ask", emoji: "💬", match: /^\/parent\/chat/ },
  {
    href: "/parent/planners",
    label: "More",
    emoji: "🗺️",
    match: /^\/parent\/(planners|activities|weekends|extras|transition)/,
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
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
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
