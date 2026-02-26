export const dynamic = "force-dynamic";

import Link from "next/link";
import { getChildWithProfile, getAllJourneyChapters } from "@/lib/queries";
import { GrowthTimeline } from "./growth-timeline";

export default async function GrowthJourneyPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const [{ child, classroom }, chapters] = await Promise.all([
    getChildWithProfile(childId),
    getAllJourneyChapters(childId),
  ]);

  if (!child) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-6">
        <p className="text-warm-gray">Child not found. Check the URL or Supabase connection.</p>
      </div>
    );
  }

  const totalObs = chapters.reduce((s, c) => s + (c.observation_count || 0), 0);
  const allFriends = [...new Set(chapters.flatMap((c) => c.friends || []))];

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-[640px] px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/teacher" className="text-warm-gray hover:text-espresso transition-colors">
            {"\u2190"}
          </Link>
          <div>
            <h1 className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-espresso">
              📖 {child.name}&apos;s Journey
            </h1>
            <p className="text-warm-gray text-sm">
              {classroom?.name ?? "Classroom"}
            </p>
          </div>
        </div>

        {/* Stats card */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
          <div className="flex items-center gap-3.5 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rust/20 to-golden/20 flex items-center justify-center text-xl font-bold text-espresso shrink-0">
              {child.name.charAt(0)}
            </div>
            <div>
              <p className="font-[family-name:var(--font-playfair)] text-lg font-bold text-espresso">
                {child.name}&apos;s Journey
              </p>
              <p className="text-[11px] text-warm-gray">
                {classroom?.name ?? ""}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { v: String(chapters.length), u: "chapters", i: "📖" },
              { v: String(totalObs), u: "observations", i: "👁️" },
              { v: String(allFriends.length), u: "friends", i: "💛" },
              {
                v: String(
                  chapters.filter((c) => c.is_current).length > 0
                    ? chapters.filter((c) => c.is_current)[0].top_domains?.length ?? 0
                    : 0
                ),
                u: "domains now",
                i: "🎯",
              },
            ].map((s) => (
              <div key={s.u} className="text-center py-2.5 rounded-xl bg-cream">
                <p className="text-sm mb-0.5">{s.i}</p>
                <p className="font-[family-name:var(--font-playfair)] text-lg font-bold text-espresso leading-none">
                  {s.v}
                </p>
                <p className="text-[9px] font-semibold text-warm-gray uppercase tracking-wider mt-1">
                  {s.u}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-warm-gray text-center italic">
            Every chapter is drawn from real classroom observations — not tests or benchmarks.
          </p>
        </div>

        {/* Timeline */}
        <GrowthTimeline chapters={chapters} childName={child.name} />
      </div>
    </div>
  );
}
