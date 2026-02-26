import { redirect } from "next/navigation";

export default function Home() {
  // For now, redirect straight to the parent control room.
  // This will become a login / landing page later.
  redirect("/parent");
}
