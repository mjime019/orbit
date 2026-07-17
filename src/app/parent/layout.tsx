import { AppHeader } from "@/components/shell/app-header";
import { TabBar } from "@/components/shell/tab-bar";
import { getActiveChild } from "@/lib/active-child";

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { children: kids, activeChildId } = await getActiveChild();

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader
        childrenList={kids.map((k) => ({ id: k.id, name: k.name }))}
        activeChildId={activeChildId ?? ""}
      />
      {/* pb-24 keeps content clear of the fixed tab bar */}
      <div className="mx-auto max-w-[640px] px-6 py-6 pb-24">{children}</div>
      <TabBar />
    </div>
  );
}
