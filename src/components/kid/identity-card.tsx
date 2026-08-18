// "Who {name} is" — the top of the Story tab. Deterministic from the file
// (zero AI): temperament in the parent's words, what he loves, how he plays.
// Renders nothing until the file has content.

import Link from "next/link";
import { displayValue, displayPills } from "@/lib/extra-registry";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function IdentityCard({
  childId,
  childName,
  profile,
}: {
  childId: string;
  childName: string;
  profile: any;
}) {
  const extra: Record<string, unknown> = profile?.extra ?? {};
  const temperament =
    displayValue(extra.temperament_notes) || displayPills(extra.personality_notes).join(" · ");
  const interests = displayPills(profile?.interests).slice(0, 5);
  const playStyle = displayValue(profile?.play_style);

  if (!temperament && interests.length === 0 && !playStyle) return null;

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-sand-dark/40">
      <p className="text-xs font-bold uppercase tracking-wider text-espresso/60 mb-2">
        🌟 Who {childName} is
      </p>
      {temperament && (
        <p className="text-[15px] text-espresso leading-relaxed">{temperament}</p>
      )}
      {interests.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {interests.map((i) => (
            <span
              key={i}
              className="text-[11px] px-2.5 py-1 rounded-full bg-golden/15 text-golden font-medium"
            >
              {i}
            </span>
          ))}
        </div>
      )}
      {playStyle && (
        <p className="text-xs text-warm-gray mt-2.5">
          Plays: <span className="text-espresso/80">{playStyle}</span>
        </p>
      )}
      <Link
        href={`/parent/kid/${childId}?tab=about`}
        className="inline-block text-[11px] font-medium text-rust underline underline-offset-2 mt-3"
      >
        Full file →
      </Link>
    </div>
  );
}
