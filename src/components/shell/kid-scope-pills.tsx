"use client";

import { useRouter } from "next/navigation";

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

// Kid selector for pages whose content is scoped to one child (chat, the
// per-kid planners). The old always-on header switcher moved here — scoping
// now lives only where it means something.
export function KidScopePills({
  kids,
  activeChildId,
}: {
  kids: { id: string; name: string }[];
  activeChildId: string;
}) {
  const router = useRouter();
  if (kids.length < 2) return null;

  const selectKid = (id: string) => {
    if (id === activeChildId) return;
    setChildCookie(id);
    router.refresh();
  };

  return (
    <div className="flex items-center gap-1.5 mb-4">
      {kids.map((kid, i) => {
        const active = kid.id === activeChildId;
        return (
          <button
            key={kid.id}
            onClick={() => selectKid(kid.id)}
            aria-pressed={active}
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
              {kid.name.charAt(0)}
            </span>
            {active && (
              <span className="text-xs font-semibold text-espresso">
                {kid.name}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
