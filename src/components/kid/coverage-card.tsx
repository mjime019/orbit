// The data-health block on the Story tab: how many moments, how fresh, and
// a radar over the six developmental domains showing where the picture is
// deep vs thin — with nudges to capture in the thin spots.

import Link from "next/link";
import { DOMAIN_CONFIG, type DevDomain } from "@/lib/types";
import { familyFormatDate } from "@/lib/tz";

const DOMAIN_ORDER: DevDomain[] = [
  "language",
  "motor_fine",
  "motor_gross",
  "social_emotional",
  "cognitive",
  "creative",
];

const WINDOW_DAYS = 90;
const STALE_DAYS = 14;
const MIN_FOR_RADAR = 5;

// `profiles` is a to-one join, but the untyped client infers an array —
// accept both shapes.
interface CoverageRow {
  domains: string[] | null;
  created_at: string;
  source?: string | null;
  profiles?: { name: string } | { name: string }[] | null;
}

function authorName(row: CoverageRow): string | null {
  const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return p?.name ?? null;
}

export function CoverageCard({
  childName,
  rows,
}: {
  childName: string;
  rows: CoverageRow[];
}) {
  if (rows.length === 0) return null;

  const latest = rows[0];
  const latestMs = new Date(latest.created_at).getTime();
  // Server component: reading the clock per request is the point (recency
  // and the 90-day window are relative to now).
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const daysSince = Math.floor((nowMs - latestMs) / (24 * 60 * 60 * 1000));
  const author =
    authorName(latest) ?? (latest.source === "parent" ? "you" : "school");

  const windowStart = nowMs - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const counts: Record<DevDomain, number> = {
    language: 0,
    motor_fine: 0,
    motor_gross: 0,
    social_emotional: 0,
    cognitive: 0,
    creative: 0,
  };
  let inWindow = 0;
  for (const row of rows) {
    if (new Date(row.created_at).getTime() < windowStart) continue;
    inWindow++;
    for (const d of row.domains ?? []) {
      if (d in counts) counts[d as DevDomain]++;
    }
  }
  const maxCount = Math.max(1, ...DOMAIN_ORDER.map((d) => counts[d]));

  // Thin spots → capture nudges (worst two).
  const gaps = DOMAIN_ORDER.filter((d) => counts[d] <= 1)
    .sort((a, b) => counts[a] - counts[b])
    .slice(0, 2);

  // Hexagon geometry: axis i at angle -90° + i·60°, radius 58, center (100,78).
  const point = (i: number, r: number) => {
    const angle = ((-90 + i * 60) * Math.PI) / 180;
    return [100 + r * Math.cos(angle), 78 + r * Math.sin(angle)] as const;
  };
  const ring = (r: number) =>
    DOMAIN_ORDER.map((_, i) => point(i, r).join(",")).join(" ");
  const valuePolygon = DOMAIN_ORDER.map((d, i) => {
    const frac = Math.max(0.06, counts[d] / maxCount);
    return point(i, 58 * frac).join(",");
  }).join(" ");

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-sand-dark/40">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-bold uppercase tracking-wider text-espresso/60">
          📊 The picture so far
        </p>
        <span className="text-[11px] text-warm-gray">
          {rows.length} moment{rows.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="text-[11px] text-warm-gray">
        Latest {familyFormatDate(latest.created_at)} · from {author}
      </p>

      {daysSince > STALE_DAYS && (
        <Link
          href="/capture"
          className="block mt-2.5 px-3 py-2 bg-golden/10 border border-golden/40 rounded-xl text-xs text-espresso hover:bg-golden/20 transition-colors"
        >
          🕐 It&apos;s been {daysSince} days — the picture&apos;s getting stale.
          Capture something recent →
        </Link>
      )}

      {inWindow >= MIN_FOR_RADAR && (
        <div className="flex justify-center mt-2">
          <svg viewBox="0 0 200 168" className="w-full max-w-[300px]">
            {[58, 38.67, 19.33].map((r) => (
              <polygon
                key={r}
                points={ring(r)}
                fill="none"
                stroke="var(--color-sand-dark, #E0E0E0)"
                strokeWidth="1"
              />
            ))}
            {DOMAIN_ORDER.map((_, i) => {
              const [x, y] = point(i, 58);
              return (
                <line
                  key={i}
                  x1="100"
                  y1="78"
                  x2={x}
                  y2={y}
                  stroke="var(--color-sand-dark, #E0E0E0)"
                  strokeWidth="1"
                />
              );
            })}
            <polygon
              points={valuePolygon}
              fill="var(--color-rust, #0090F3)"
              fillOpacity="0.18"
              stroke="var(--color-rust, #0090F3)"
              strokeWidth="1.5"
            />
            {DOMAIN_ORDER.map((d, i) => {
              const [x, y] = point(i, 72);
              return (
                <text
                  key={d}
                  x={x}
                  y={y + 4}
                  textAnchor="middle"
                  fontSize="11"
                >
                  {DOMAIN_CONFIG[d].emoji}
                </text>
              );
            })}
          </svg>
        </div>
      )}

      {gaps.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {gaps.map((d) => (
            <Link
              key={d}
              href="/capture"
              className="block px-3 py-2 bg-sand rounded-xl text-xs text-espresso/80 hover:bg-sand-dark/40 transition-colors"
            >
              {DOMAIN_CONFIG[d].emoji} Not much{" "}
              {DOMAIN_CONFIG[d].label.toLowerCase()} lately for {childName} —
              worth capturing?
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
