export const dynamic = "force-dynamic";

import Link from "next/link";
import { getChildWithProfile, getAllJourneyChapters } from "@/lib/queries";
import { getActiveChildId } from "@/lib/active-child";
import { NoKidsState } from "@/components/ui/no-kids-state";
import { GrowthTimeline } from "@/components/growth/growth-timeline";
import { SectionHead } from "@/components/ui/section-head";
import { EmptyState } from "@/components/ui/empty-state";

function age(dob: string | null): string {
  if (!dob) return "";
  const diff = Date.now() - new Date(dob).getTime();
  const years = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  const months = Math.floor(
    (diff % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000)
  );
  return `${years} yrs ${months} mo`;
}

function Pills({ items, color = "bg-sand text-warm-gray" }: { items: string[]; color?: string }) {
  if (!items || items.length === 0)
    return <p className="text-xs text-warm-gray/60 italic">Not set yet</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${color}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

function Section({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">{emoji}</span>
        <h3 className="text-[11px] font-bold text-espresso uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function JsonDisplay({ data, fallback = "Not set yet" }: { data: Record<string, unknown>; fallback?: string }) {
  const entries = Object.entries(data || {}).filter(([, v]) => v !== null && v !== "" && v !== undefined);
  if (entries.length === 0)
    return <p className="text-xs text-warm-gray/60 italic">{fallback}</p>;
  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => (
        <div key={key}>
          <p className="text-[10px] font-semibold text-warm-gray uppercase tracking-wide mb-0.5">
            {key.replace(/_/g, " ")}
          </p>
          <p className="text-xs text-espresso/80 leading-relaxed">
            {typeof value === "string" ? value : JSON.stringify(value)}
          </p>
        </div>
      ))}
    </div>
  );
}

// "Understand your kid" = the Child Memory Layer (profile) + the growth
// journey, in one parent-facing place.
export default async function UnderstandPage() {
  const childId = await getActiveChildId();
  if (!childId) return <NoKidsState />;
  const [{ child, profile, classroom }, chapters] = await Promise.all([
    getChildWithProfile(childId),
    getAllJourneyChapters(childId),
  ]);

  if (!child) {
    return (
      <EmptyState
        emoji="🌱"
        title="We couldn't find this child"
        action={{ href: "/parent", label: "Back home" }}
      />
    );
  }

  return (
    <div className="fade-up">
      {/* Hero */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rust/20 to-[#47B3FF]/20 flex items-center justify-center text-2xl font-bold text-espresso shrink-0">
            {child.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-[family-name:var(--font-playfair)] text-xl font-bold text-espresso">
              {child.name}
            </h1>
            <p className="text-warm-gray text-xs mt-0.5">
              {age(child.date_of_birth)}
              {classroom ? ` · ${classroom.name}` : ""}
              {classroom?.lesson_theme ? ` · ${classroom.lesson_theme}` : ""}
            </p>
          </div>
          <Link
            href="/parent/onboarding"
            className="shrink-0 text-[11px] font-medium text-rust underline underline-offset-2"
          >
            Refine
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        <Section emoji="⭐" title="Interests">
          <Pills items={profile?.interests ?? []} color="bg-golden/15 text-golden" />
          {profile?.emerging_interests && profile.emerging_interests.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-semibold text-warm-gray uppercase tracking-wide mb-1.5">
                Emerging
              </p>
              <Pills items={profile.emerging_interests} color="bg-sky/10 text-sky" />
            </div>
          )}
        </Section>

        <Section emoji="🎮" title="Play Style">
          {profile?.play_style ? (
            <div>
              <p className="text-sm text-espresso font-medium">{profile.play_style}</p>
              {profile.play_style_notes && (
                <p className="text-xs text-warm-gray mt-1 leading-relaxed">
                  {profile.play_style_notes}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-warm-gray/60 italic">Not set yet</p>
          )}
        </Section>

        <Section emoji="🎯" title="Your Goals">
          {profile?.parent_goals && profile.parent_goals.length > 0 ? (
            <ul className="space-y-2">
              {profile.parent_goals.map((goal: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-sage text-xs mt-0.5">●</span>
                  <span className="text-xs text-espresso/80 leading-relaxed">{goal}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-warm-gray/60 italic">Not set yet</p>
          )}
        </Section>

        <Section emoji="🌡️" title="Sensitivities">
          <div className="space-y-3">
            {profile?.food_sensitivities && profile.food_sensitivities.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-warm-gray uppercase tracking-wide mb-1.5">Food</p>
                <Pills items={profile.food_sensitivities} color="bg-red-50 text-red-700" />
              </div>
            )}
            {profile?.sensory_sensitivities && profile.sensory_sensitivities.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-warm-gray uppercase tracking-wide mb-1.5">Sensory</p>
                <Pills items={profile.sensory_sensitivities} color="bg-orange-50 text-orange-700" />
              </div>
            )}
            {profile?.emotional_triggers && profile.emotional_triggers.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-warm-gray uppercase tracking-wide mb-1.5">Emotional Triggers</p>
                <Pills items={profile.emotional_triggers} color="bg-purple-50 text-purple-700" />
              </div>
            )}
            {!profile?.food_sensitivities?.length &&
              !profile?.sensory_sensitivities?.length &&
              !profile?.emotional_triggers?.length && (
                <p className="text-xs text-warm-gray/60 italic">No sensitivities recorded</p>
              )}
          </div>
        </Section>

        <Section emoji="💛" title="Comfort & Regulation">
          <div className="space-y-3">
            {profile?.comfort_helps && profile.comfort_helps.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-sage uppercase tracking-wide mb-1.5">
                  What helps
                </p>
                <Pills items={profile.comfort_helps} color="bg-sage/10 text-sage" />
              </div>
            )}
            {profile?.comfort_escalates && profile.comfort_escalates.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-rust uppercase tracking-wide mb-1.5">
                  What escalates
                </p>
                <Pills items={profile.comfort_escalates} color="bg-rust/10 text-rust" />
              </div>
            )}
            {!profile?.comfort_helps?.length && !profile?.comfort_escalates?.length && (
              <p className="text-xs text-warm-gray/60 italic">Not set yet</p>
            )}
          </div>
        </Section>

        <Section emoji="🕐" title="Routines">
          <JsonDisplay data={profile?.routines ?? {}} />
        </Section>

        <Section emoji="👨‍👩‍👦" title="Family Context">
          <JsonDisplay data={profile?.family_context ?? {}} />
        </Section>
      </div>

      {/* Growth journey */}
      <div className="mt-8">
        <SectionHead
          emoji="🌱"
          title="Growth Journey"
          subtitle={`${child.name}'s chapters, written from real moments`}
        />
        <div className="mt-4">
          {chapters.length === 0 ? (
            <EmptyState
              emoji="📖"
              title="The first chapter is still being written"
              body={`As observations build up, ${child.name}'s story takes shape here.`}
              action={{ href: "/capture", label: "Capture a moment" }}
            />
          ) : (
            <GrowthTimeline chapters={chapters} childName={child.name} />
          )}
        </div>
      </div>

      <div className="mt-6 text-center">
        <p className="text-[11px] text-warm-gray italic">
          This is {child.name}&apos;s Child Memory Layer — built from onboarding,
          observations, and conversations. The longer you use Orbit, the richer
          it gets.
        </p>
      </div>
    </div>
  );
}
