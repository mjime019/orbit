export function SectionHead({
  emoji,
  title,
  subtitle,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <span className="text-base">{emoji}</span>
        <span className="text-xs font-bold uppercase tracking-wider text-warm-gray">
          {title}
        </span>
      </div>
      {subtitle && (
        <p className="text-xs text-rust italic pl-6">{subtitle}</p>
      )}
    </div>
  );
}
