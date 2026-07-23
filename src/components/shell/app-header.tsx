"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Mark + sign-out only. The old always-on child switcher moved to
// KidScopePills, rendered only on pages whose content is scoped to one kid
// (chat, planners) — on every other page it controlled nothing.
export function AppHeader() {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 bg-cream/95 backdrop-blur border-b border-sand-dark/40">
      <div className="mx-auto max-w-[640px] px-6 py-3 flex items-center justify-between">
        <Link href="/parent" className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rust inline-block" />
          <span className="font-[family-name:var(--font-playfair)] font-semibold tracking-wide text-espresso">
            ORBIT
          </span>
        </Link>

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/login");
            router.refresh();
          }}
          title="Sign out"
          aria-label="Sign out"
          className="text-warm-gray hover:text-espresso transition-colors text-sm px-1"
        >
          ⎋
        </button>
      </div>
    </header>
  );
}
