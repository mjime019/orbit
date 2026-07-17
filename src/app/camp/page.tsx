import { redirect } from "next/navigation";

// The camp pilot tool grew into the unified capture flow. Carla's bookmarked
// URL and stored access code keep working — same gate, same localStorage key.
export default function CampPage() {
  redirect("/capture?ctx=teacher");
}
