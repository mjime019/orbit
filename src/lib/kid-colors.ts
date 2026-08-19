// Per-kid identity colors, keyed by roster index (kids are always ordered
// oldest-first, so index is stable everywhere). One source of truth for the
// home cards, scope pills, and capture — cool-palette takes on cobalt /
// sage / violet so each boy is recognizable at a glance.
// Tailwind JIT picks these up because the class strings are literals here.

export const AVATAR_GRADIENTS = [
  "from-[#5A90B0] to-[#84AFCB]",
  "from-[#568975] to-[#83AC9C]",
  "from-[#B097D6] to-[#C7B5E3]",
];

export const KID_ACCENT_BORDERS = [
  "border-[#5A90B0]",
  "border-[#568975]",
  "border-[#B097D6]",
];

export const KID_ACCENT_TEXT = [
  "text-[#3F6480]",
  "text-[#45705F]",
  "text-[#7D63A8]",
];

export function kidGradient(index: number): string {
  return AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
}
export function kidBorder(index: number): string {
  return KID_ACCENT_BORDERS[index % KID_ACCENT_BORDERS.length];
}
export function kidText(index: number): string {
  return KID_ACCENT_TEXT[index % KID_ACCENT_TEXT.length];
}
