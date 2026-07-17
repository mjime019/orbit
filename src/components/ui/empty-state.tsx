import Link from "next/link";

interface EmptyStateProps {
  emoji: string;
  title: string;
  body?: string;
  action?: { href: string; label: string };
}

export function EmptyState({ emoji, title, body, action }: EmptyStateProps) {
  return (
    <div className="bg-sand rounded-2xl px-6 py-10 text-center">
      <span className="text-3xl">{emoji}</span>
      <p className="text-sm font-semibold text-espresso mt-3">{title}</p>
      {body && <p className="text-xs text-warm-gray mt-1.5 leading-relaxed">{body}</p>}
      {action && (
        <Link
          href={action.href}
          className="inline-block mt-4 px-5 py-2.5 bg-rust text-white rounded-full text-xs font-medium shadow-sm hover:bg-rust/90 active:scale-95 transition-all"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
