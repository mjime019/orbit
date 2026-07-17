import { redirect } from "next/navigation";

// The profile view merged into "Understand your kid" (profile + growth
// journey in one place). Old links land there.
export default function ChildProfilePage() {
  redirect("/parent/understand");
}
