export const dynamic = "force-dynamic";

import Link from "next/link";
import { getChildWithProfile, getAllSentHighlights } from "@/lib/queries";
import { HighlightFeed } from "./highlight-feed";

export default async function HighlightsPage() {
  const { child } = await getChildWithProfile();

  if (!child) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-6">
        <p className="text-warm-gray">Could not load data. Check Supabase connection.</p>
      </div>
    );
  }

  const highlights = await getAllSentHighlights(child.id);

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-[640px] px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/parent" className="text-warm-gray hover:text-espresso transition-colors">
            {"\u2190"}
          </Link>
          <div>
            <h1 className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-espresso">
              ✨ Highlights
            </h1>
            <p className="text-warm-gray text-sm">
              {child.name}&apos;s moments, from their teachers
            </p>
          </div>
        </div>

        <HighlightFeed highlights={highlights} childName={child.name} />
      </div>
    </div>
  );
}
