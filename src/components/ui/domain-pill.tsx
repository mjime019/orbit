import { DOMAIN_CONFIG } from "@/lib/types";

export function DomainPill({ domain }: { domain: string }) {
  const config = DOMAIN_CONFIG[domain] || {
    bg: "bg-sand",
    text: "text-warm-gray",
    emoji: "\u{1F4CC}",
    label: domain,
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${config.bg} ${config.text}`}
    >
      <span className="text-[11px]">{config.emoji}</span> {config.label}
    </span>
  );
}
