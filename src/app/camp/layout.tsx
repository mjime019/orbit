import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Camp Observations",
  description: "Daily observation capture for camp teachers.",
};

export default function CampLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
