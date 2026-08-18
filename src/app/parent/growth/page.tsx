import { redirect } from "next/navigation";
import { getActiveChildId } from "@/lib/active-child";

// Chapters live inside each kid's Story now (the Journey tab is gone).
export default async function ParentGrowthPage() {
  const childId = await getActiveChildId();
  redirect(childId ? `/parent/kid/${childId}` : "/parent");
}
