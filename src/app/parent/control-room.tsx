"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { DomainPill } from "@/components/ui/domain-pill";
import { SectionHead } from "@/components/ui/section-head";
import {
  DOMAIN_CONFIG,
  SOCIAL_TAG_CONFIG,
  type Highlight,
  type Observation,
  type ActivityRecommendation,
  type WeekendRecommendation,
  type SchoolCalendarEvent,
  type JourneyChapter,
  type CalendarEventType,
} from "@/lib/types";

// Calendar event type styling
const EVENT_TYPE_STYLE: Record<
  CalendarEventType,
  { icon: string; label: string; color: string; bg: string }
> = {
  no_school: { icon: "\u{1F6AB}", label: "No School", color: "text-red-700", bg: "bg-red-50" },
  half_day: { icon: "\u23F0", label: "Half Day", color: "text-orange-700", bg: "bg-orange-50" },
  spirit: { icon: "\u{1F389}", label: "Spirit Week", color: "text-purple-700", bg: "bg-purple-50" },
  special: { icon: "\u2B50", label: "Special Day", color: "text-sky", bg: "bg-sky/10" },
  birthday: { icon: "\u{1F382}", label: "Birthday", color: "text-pink-600", bg: "bg-pink-50" },
  field_trip: { icon: "\u{1F68C}", label: "Field Trip", color: "text-emerald-700", bg: "bg-emerald-50" },
  conference: { icon: "\u{1F465}", label: "Conference", color: "text-indigo-700", bg: "bg-indigo-50" },
  extracurricular: { icon: "\u{1F94B}", label: "Extra", color: "text-rust", bg: "bg-rust/10" },
  deadline: { icon: "\u{1F4CB}", label: "Deadline", color: "text-warm-gray", bg: "bg-sand" },
  performance: { icon: "\u{1F3AD}", label: "Performance", color: "text-golden", bg: "bg-golden/10" },
};

interface ControlRoomProps {
  child: { id: string; name: string; date_of_birth: string | null } | null;
  profile: { interests: string[]; parent_goals: string[] } | null;
  classroomName: string | null;
  classroomTheme: string | null;
  highlights: Highlight[];
  observations: (Observation & { profiles?: { name: string } })[];
  activityRecs: (ActivityRecommendation & { activities: NonNullable<ActivityRecommendation["activities"]> })[];
  weekendRecs: (WeekendRecommendation & { weekend_places: NonNullable<WeekendRecommendation["weekend_places"]> })[];
  calendarEvents: SchoolCalendarEvent[];
  currentChapter: JourneyChapter | null;
}

function FitBar({ score }: { score: number }) {
  const color =
    score >= 90 ? "bg-sage" : score >= 80 ? "bg-sky" : "bg-warm-gray";
  const textColor =
    score >= 90
      ? "text-sage"
      : score >= 80
        ? "text-sky"
        : "text-warm-gray";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-sand-dark">
        <div
          className={`h-full rounded-full ${color} transition-all duration-600`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-xs font-bold ${textColor} min-w-[32px]`}>
        {score}%
      </span>
    </div>
  );
}

export function ControlRoom({
  child,
  profile,
  classroomName,
  classroomTheme,
  highlights,
  observations,
  activityRecs,
  weekendRecs,
  calendarEvents,
  currentChapter,
}: ControlRoomProps) {
  const [savedHighlights, setSavedHighlights] = useState<Set<string>>(
    new Set()
  );

  const childName = child?.name ?? "Your Child";
  const todayHighlight = highlights[0] ?? null;
  const topActivity = activityRecs[0] ?? null;

  const now = new Date();
  const greeting =
    now.getHours() < 12
      ? "Good morning"
      : now.getHours() < 17
        ? "Good afternoon"
        : "Good evening";
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
  const dateLabel = now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });

  const toggleSave = (id: string) => {
    setSavedHighlights((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // If Supabase isn't configured yet, show a helpful message
  if (!child) {
    return (
      <div className="min-h-screen bg-cream">
        <div className="mx-auto max-w-[520px] px-6 pt-10">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2.5 h-2.5 rounded-full bg-rust" />
            <span className="text-xs font-bold tracking-widest uppercase text-rust">
              Orbit
            </span>
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-2xl font-semibold text-espresso mb-3">
            Welcome to Orbit
          </h1>
          <Card>
            <p className="text-sm text-warm-gray leading-relaxed mb-4">
              To see the Parent Control Room with real data, configure your
              Supabase connection:
            </p>
            <ol className="text-sm text-espresso space-y-2 list-decimal list-inside">
              <li>
                Create a Supabase project and run the schema from{" "}
                <code className="text-xs bg-sand px-1.5 py-0.5 rounded">
                  software/architecture/supabase-schema.sql
                </code>
              </li>
              <li>
                Run the seed data from{" "}
                <code className="text-xs bg-sand px-1.5 py-0.5 rounded">
                  software/architecture/seed-data.sql
                </code>
              </li>
              <li>
                Update{" "}
                <code className="text-xs bg-sand px-1.5 py-0.5 rounded">
                  .env.local
                </code>{" "}
                with your Supabase URL and anon key
              </li>
              <li>Restart the dev server</li>
            </ol>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream orbit-scroll">
      {/* HEADER */}
      <div className="fade-up mx-auto max-w-[520px] px-6 pt-7">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-rust" />
              <span className="text-xs font-bold tracking-widest uppercase text-rust">
                Orbit
              </span>
            </div>
            <h1 className="font-[family-name:var(--font-playfair)] text-[26px] font-semibold leading-tight text-espresso">
              {greeting}, {childName}&apos;s family
            </h1>
            <p className="text-sm text-warm-gray mt-1">
              {dayName}, {dateLabel}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <Link
              href="/parent/chat"
              className="w-11 h-11 rounded-full border-2 border-sand-dark bg-white text-lg flex items-center justify-center shadow-sm hover:shadow-md transition-shadow"
            >
              {"\u{1F4AC}"}
            </Link>
            <Link
              href={`/parent/profile/${child.id}`}
              className="w-11 h-11 rounded-full border-2 border-rust/20 bg-gradient-to-br from-rust to-[#E8945A] text-white text-lg font-bold flex items-center justify-center font-[family-name:var(--font-playfair)]"
            >
              {childName.charAt(0)}
            </Link>
          </div>
        </div>
      </div>

      {/* WIDGETS */}
      <div className="mx-auto max-w-[520px] px-6 pt-5 pb-32 grid gap-4">
        {/* TODAY'S HIGHLIGHT */}
        {todayHighlight && (
          <div className="fade-up delay-1">
            <SectionHead
              emoji={"\u2728"}
              title="Today's Highlight"
              subtitle={todayHighlight.title ?? undefined}
            />
            <Card>
              <p className="text-[15px] leading-relaxed">
                {todayHighlight.content}
              </p>
              <div className="flex gap-1.5 mt-3 flex-wrap">
                {todayHighlight.domains.map((d) => (
                  <DomainPill key={d} domain={d} />
                ))}
              </div>
              <div className="flex justify-end mt-2.5">
                <button
                  onClick={() => toggleSave(todayHighlight.id)}
                  className="text-xl bg-transparent border-none cursor-pointer transition-opacity"
                  style={{
                    opacity: savedHighlights.has(todayHighlight.id) ? 1 : 0.35,
                  }}
                >
                  {savedHighlights.has(todayHighlight.id)
                    ? "\u2764\uFE0F"
                    : "\u{1F90D}"}
                </button>
              </div>
            </Card>
          </div>
        )}

        {/* PROGRESS SNAPSHOT */}
        {observations.length > 0 && (
          <div className="fade-up delay-2">
            <SectionHead
              emoji={"\u{1F4C8}"}
              title="This Week"
              subtitle={`Based on ${observations.length} observations`}
            />
            <Card>
              <div className="grid gap-3">
                {observations.slice(0, 4).map((obs) => (
                  <div
                    key={obs.id}
                    className="flex items-start gap-3 p-2.5 rounded-xl bg-cream"
                  >
                    <span className="text-lg mt-0.5">
                      {obs.social_tag
                        ? (SOCIAL_TAG_CONFIG[obs.social_tag]?.emoji ?? "\u{1F4CC}")
                        : (obs.domains[0]
                            ? (DOMAIN_CONFIG[obs.domains[0]]?.emoji ?? "\u{1F4CC}")
                            : "\u{1F4CC}")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-relaxed">{obs.note}</p>
                      <span className="text-[11px] text-warm-gray">
                        {obs.profiles?.name ?? "Teacher"} &middot;{" "}
                        {new Date(obs.created_at).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {observations.length > 4 && (
                <Link
                  href="/parent/highlights"
                  className="block text-center text-xs font-semibold text-rust mt-3 hover:underline"
                >
                  See all {observations.length} observations &rarr;
                </Link>
              )}
            </Card>
          </div>
        )}

        {/* TONIGHT'S ACTIVITY */}
        {topActivity && (
          <div className="fade-up delay-3">
            <SectionHead
              emoji={"\u{1F3E0}"}
              title="Tonight's Activity"
              subtitle={
                classroomTheme
                  ? `Connects to classroom theme: ${classroomTheme}`
                  : undefined
              }
            />
            <Card>
              <div className="flex justify-between items-start mb-2.5">
                <div>
                  <h3 className="text-lg font-bold font-[family-name:var(--font-playfair)]">
                    {topActivity.activities.title}
                  </h3>
                  <span className="text-xs text-warm-gray">
                    {topActivity.activities.time_minutes
                      ? `\u23F1 ${topActivity.activities.time_minutes} min`
                      : ""}{" "}
                    {topActivity.activities.energy_level
                      ? `\u00B7 ${topActivity.activities.energy_level} energy`
                      : ""}
                  </span>
                </div>
                <div className="flex gap-1">
                  {topActivity.activities.domains.map((d) => (
                    <span key={d} className="text-base">
                      {DOMAIN_CONFIG[d]?.emoji ?? "\u{1F4CC}"}
                    </span>
                  ))}
                </div>
              </div>

              {topActivity.why_it_fits && (
                <p className="text-[13px] text-rust italic leading-relaxed mb-3">
                  Why this fits: {topActivity.why_it_fits}
                </p>
              )}

              {topActivity.activities.materials.length > 0 && (
                <div className="bg-cream rounded-xl p-3.5 mb-3">
                  <p className="text-[13px] font-semibold text-warm-gray mb-1.5">
                    You&apos;ll need:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {topActivity.activities.materials.map((m) => (
                      <span
                        key={m}
                        className="text-[13px] px-2.5 py-0.5 rounded-2xl bg-white border border-sand-dark"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {topActivity.activities.instructions && (
                <p className="text-sm leading-relaxed">
                  {topActivity.activities.instructions}
                </p>
              )}

              {activityRecs.length > 1 && (
                <Link
                  href="/parent/activities"
                  className="block text-center text-xs font-semibold text-rust mt-3 hover:underline"
                >
                  See {activityRecs.length - 1} more activities &rarr;
                </Link>
              )}
            </Card>
          </div>
        )}

        {/* THIS WEEKEND */}
        {weekendRecs.length > 0 && (
          <div className="fade-up delay-4">
            <SectionHead
              emoji={"\u{1F5D3}"}
              title="This Weekend"
              subtitle="Personalized for your family"
            />
            <div className="grid gap-2.5">
              {weekendRecs.map((rec) => (
                <Card key={rec.id} className="!p-4.5">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="text-[15px] font-bold">
                        {rec.weekend_places.name}
                      </h4>
                      <span className="text-xs text-warm-gray">
                        {rec.weekend_places.location} &middot;{" "}
                        {rec.weekend_places.cost_tier === "free"
                          ? "Free"
                          : rec.weekend_places.cost_tier === "low"
                            ? "$"
                            : rec.weekend_places.cost_tier === "medium"
                              ? "$$"
                              : "$$$"}
                      </span>
                    </div>
                  </div>
                  {rec.fit_score != null && <FitBar score={rec.fit_score} />}
                  {rec.fit_reason && (
                    <p className="text-[13px] text-warm-gray italic leading-relaxed mt-2">
                      {rec.fit_reason}
                    </p>
                  )}
                  {rec.weekend_places.tags.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {rec.weekend_places.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[11px] px-2 py-0.5 rounded-xl bg-cream text-warm-gray font-semibold"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
            <Link
              href="/parent/weekends"
              className="block text-center text-xs font-semibold text-rust mt-3 hover:underline"
            >
              Explore more weekend ideas &rarr;
            </Link>
          </div>
        )}

        {/* UPCOMING CALENDAR */}
        {calendarEvents.length > 0 && (
          <div className="fade-up delay-5">
            <SectionHead
              emoji={"\u{1F4C5}"}
              title="Coming Up"
              subtitle={classroomName ?? undefined}
            />
            <Card>
              <div className="grid gap-2">
                {calendarEvents.map((ev) => {
                  const style =
                    EVENT_TYPE_STYLE[ev.event_type] ?? EVENT_TYPE_STYLE.special;
                  const d = new Date(ev.event_date + "T12:00:00");
                  return (
                    <div
                      key={ev.id}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-cream transition-colors"
                    >
                      <span className="text-sm">{style.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold truncate">
                          {ev.title}
                        </div>
                        <div className="text-[11px] text-warm-gray">
                          {d.toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold whitespace-nowrap ${style.bg} ${style.color}`}
                      >
                        {style.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {/* GROWTH JOURNEY */}
        {currentChapter && (
          <div className="fade-up delay-6">
            <SectionHead
              emoji={"\u{1F4D6}"}
              title="Growth Journey"
              subtitle={`${currentChapter.period} \u00B7 ${currentChapter.observation_count} observations`}
            />
            <Card>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{currentChapter.emoji}</span>
                <h3 className="text-base font-bold font-[family-name:var(--font-playfair)]">
                  {currentChapter.title}
                </h3>
              </div>
              {currentChapter.summary && (
                <p className="text-sm leading-relaxed text-warm-gray mb-3">
                  {currentChapter.summary}
                </p>
              )}
              {currentChapter.top_domains.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {currentChapter.top_domains.map((d) => (
                    <DomainPill key={d} domain={d} />
                  ))}
                </div>
              )}
              <Link
                href={`/teacher/growth/${child.id}`}
                className="block text-center text-xs font-semibold text-rust mt-3 hover:underline"
              >
                View full journey &rarr;
              </Link>
            </Card>
          </div>
        )}

        {/* QUICK LINKS */}
        <div className="fade-up delay-6">
          <SectionHead emoji={"\u{1F9ED}"} title="Explore" />
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { href: "/parent/highlights", emoji: "\u2728", label: "Highlights" },
              { href: "/parent/activities", emoji: "\u{1F3E0}", label: "Activities" },
              { href: "/parent/weekends", emoji: "\u{1F5D3}", label: "Weekends" },
              { href: "/parent/extras", emoji: "\u2B50", label: "Extras" },
              { href: "/parent/transition", emoji: "\u{1F9ED}", label: "Transition" },
              { href: "/parent/chat", emoji: "\u{1F4AC}", label: "Ask Orbit" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 p-4 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <span className="text-2xl">{link.emoji}</span>
                <span className="text-sm font-semibold text-espresso">
                  {link.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
