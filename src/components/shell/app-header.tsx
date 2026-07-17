"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface AppHeaderProps {
  childrenList: { id: string; name: string }[];
  activeChildId: string;
}

const AVATAR_GRADIENTS = [
  "from-rust to-[#47B3FF]",
  "from-sage to-[#7DD98F]",
  "from-[#C9B8F8] to-[#9F86E8]",
];

// Outside the component so the React Compiler doesn't treat the global
// cookie write as a render-scope mutation.
function setChildCookie(id: string) {
  document.cookie = `orbit_child=${id}; path=/; max-age=31536000; samesite=lax`;
}

export function AppHeader({ childrenList, activeChildId }: AppHeaderProps) {
  const router = useRouter();

  const selectChild = (id: string) => {
    if (id === activeChildId) return;
    setChildCookie(id);
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 bg-cream/95 backdrop-blur border-b border-sand-dark/40">
      <div className="mx-auto max-w-[640px] px-6 py-3 flex items-center justify-between">
        <Link href="/parent" className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rust inline-block" />
          <span className="font-[family-name:var(--font-playfair)] font-semibold tracking-wide text-espresso">
            ORBIT
          </span>
        </Link>

        <div className="flex items-center gap-2">
        {childrenList.length > 0 && (
          <div className="flex items-center gap-1.5">
            {childrenList.map((child, i) => {
              const active = child.id === activeChildId;
              return (
                <button
                  key={child.id}
                  onClick={() => selectChild(child.id)}
                  aria-pressed={active}
                  title={child.name}
                  className={`flex items-center gap-1.5 rounded-full transition-all ${
                    active
                      ? "bg-white shadow-sm border border-sand-dark/50 pl-1 pr-3 py-1"
                      : "p-1 opacity-60 hover:opacity-100"
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-full bg-gradient-to-br ${
                      AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]
                    } text-white text-xs font-bold flex items-center justify-center font-[family-name:var(--font-playfair)]`}
                  >
                    {child.name.charAt(0)}
                  </span>
                  {active && (
                    <span className="text-xs font-semibold text-espresso">
                      {child.name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
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
      </div>
    </header>
  );
}
