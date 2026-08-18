import Link from "next/link";
import { formatAge } from "@/lib/age";
import { familyFormatDate } from "@/lib/tz";

const AVATAR_GRADIENTS = [
  "from-rust to-[#47B3FF]",
  "from-sage to-[#7DD98F]",
  "from-[#C9B8F8] to-[#9F86E8]",
];

interface KidCardProps {
  index: number;
  id: string;
  name: string;
  dateOfBirth: string | null;
  pulse: string | null;
  identityLine: string | null;
  daysSinceLastMoment: number | null;
  lastMoment: {
    text: string;
    source: "parent" | "school";
    created_at: string;
  } | null;
}

// A pulse is observation news — past ~2 quiet weeks it reads as stale
// ("bounced back after the karate bump" a month later). Then the card falls
// back to the evergreen identity line from the file, which is never wrong.
const PULSE_FRESH_DAYS = 14;

// One kid, one glance: name, age, one line that's actually true today,
// last moment.
export function KidCard({
  index,
  id,
  name,
  dateOfBirth,
  pulse,
  identityLine,
  daysSinceLastMoment,
  lastMoment,
}: KidCardProps) {
  const pulseFresh =
    daysSinceLastMoment !== null && daysSinceLastMoment <= PULSE_FRESH_DAYS;
  const line =
    (pulseFresh ? pulse : null) ?? identityLine ?? (pulseFresh ? null : pulse);

  return (
    <Link
      href={`/parent/kid/${id}`}
      className="block bg-white rounded-2xl p-4 shadow-sm border border-sand-dark/40 hover:shadow-md active:scale-[0.99] transition-all"
    >
      <div className="flex items-center gap-3">
        <span
          className={`w-11 h-11 rounded-full bg-gradient-to-br ${
            AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length]
          } text-white text-base font-bold flex items-center justify-center font-[family-name:var(--font-playfair)] shrink-0`}
        >
          {name.charAt(0)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-espresso">
              {name}
            </span>
            <span className="text-[11px] text-warm-gray font-medium">
              {formatAge(dateOfBirth)}
            </span>
          </div>
          <p className="text-[13px] leading-snug text-espresso/85 mt-0.5">
            {line ?? (
              <span className="text-warm-gray">
                Capture a moment to see {name}&apos;s pulse
              </span>
            )}
          </p>
        </div>
        <span className="text-warm-gray/60 text-sm shrink-0">›</span>
      </div>

      {lastMoment && (
        <div className="mt-3 pt-2.5 border-t border-sand-dark/30 flex items-center gap-2">
          <span
            className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0 ${
              lastMoment.source === "parent"
                ? "bg-lavender/40 text-espresso"
                : "bg-sky/10 text-sky"
            }`}
          >
            {lastMoment.source === "parent" ? "You" : "School"}
          </span>
          <span className="text-[12px] text-warm-gray truncate flex-1">
            {lastMoment.text}
          </span>
          <span className="text-[10px] text-warm-gray/70 shrink-0">
            {familyFormatDate(lastMoment.created_at)}
          </span>
        </div>
      )}
    </Link>
  );
}
