// Age formatting shared by home, onboarding, and chapters.

export function ageInMonths(dob: string | null): number | null {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (30.44 * 24 * 60 * 60 * 1000));
}

export function ageInYears(dob: string | null): number | null {
  const months = ageInMonths(dob);
  return months == null ? null : months / 12;
}

// "8 mo", "18 mo", "4 yr", "5½ yr" — halves the way parents actually say
// ages: 5y8m is "5½", not "6".
export function formatAge(dob: string | null): string {
  const months = ageInMonths(dob);
  if (months == null) return "";
  if (months < 24) return `${months} mo`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem <= 2) return `${years} yr`;
  if (rem <= 9) return `${years}½ yr`;
  return `almost ${years + 1}`;
}

export type AgeBand = "infant" | "toddler" | "preschool" | "school-age";

export function ageBand(dob: string | null): AgeBand {
  const months = ageInMonths(dob);
  if (months == null) return "preschool";
  if (months < 18) return "infant";
  if (months < 36) return "toddler";
  if (months < 60) return "preschool";
  return "school-age";
}
