import { AppHeader } from "@/components/shell/app-header";
import { TabBar } from "@/components/shell/tab-bar";

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-cream">
      <AppHeader />
      {/* pb-24 keeps content clear of the fixed tab bar */}
      <div className="mx-auto max-w-[640px] px-6 py-6 pb-24">{children}</div>
      <TabBar />
    </div>
  );
}
