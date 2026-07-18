import { redirect } from "next/navigation";
import { getActiveChildId } from "@/lib/active-child";

// "Understand your kid" now lives on each kid's page (About tab).
export default async function UnderstandPage() {
  const childId = await getActiveChildId();
  redirect(childId ? `/parent/kid/${childId}?tab=about` : "/parent");
}
