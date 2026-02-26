export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-[640px] px-6 py-8">{children}</div>
    </div>
  );
}
