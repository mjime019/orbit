// Family timezone helpers. Server code runs in UTC (Vercel), so every
// user-facing date/greeting must be computed in the family's timezone —
// otherwise "Good morning" shows at 8pm and day boundaries drift.
// This module is the only date-formatting authority for server-rendered
// output and AI-prompt date stamps.

export const FAMILY_TZ = "America/New_York";

export function familyFormatDate(
  iso: string | Date,
  opts?: Intl.DateTimeFormatOptions
): string {
  return new Date(iso).toLocaleDateString("en-US", {
    ...(opts ?? { month: "short", day: "numeric" }),
    timeZone: FAMILY_TZ,
  });
}

// "yyyy-mm-dd" for today in the family timezone (en-CA formats ISO-style).
export function familyToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FAMILY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Wall-clock offset of FAMILY_TZ vs UTC at the given instant (DST-aware,
// minute precision — plenty for day boundaries).
function tzOffsetMs(at: Date): number {
  const wall = new Date(at.toLocaleString("en-US", { timeZone: FAMILY_TZ }));
  const utc = new Date(at.toLocaleString("en-US", { timeZone: "UTC" }));
  return wall.getTime() - utc.getTime();
}

// UTC ISO range covering "today" in the family timezone, for timestamptz
// column filters (created_at >= start AND created_at < end).
export function familyDayBounds(): { startUtcIso: string; endUtcIso: string } {
  const now = new Date();
  const startMs = Date.parse(`${familyToday()}T00:00:00Z`) - tzOffsetMs(now);
  return {
    startUtcIso: new Date(startMs).toISOString(),
    endUtcIso: new Date(startMs + 24 * 60 * 60 * 1000).toISOString(),
  };
}

function familyHour(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: FAMILY_TZ,
      hour: "numeric",
      hour12: false,
    }).format(new Date())
  );
}

export function familyGreeting(): string {
  const h = familyHour();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// "Summer 2026" — season + year in the family timezone.
export function familySeasonLabel(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FAMILY_TZ,
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const month = Number(parts.find((p) => p.type === "month")?.value ?? 1) - 1;
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const season =
    month < 2 || month === 11
      ? "Winter"
      : month < 5
        ? "Spring"
        : month < 8
          ? "Summer"
          : "Fall";
  return `${season} ${year}`;
}
