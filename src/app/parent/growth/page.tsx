import { redirect } from "next/navigation";
import { getActiveChildId } from "@/lib/active-child";

// Growth journey now lives on each kid's page (Journey tab).
export default async function ParentGrowthPage() {
  const childId = await getActiveChildId();
  redirect(childId ? `/parent/kid/${childId}?tab=journey` : "/parent");
}
