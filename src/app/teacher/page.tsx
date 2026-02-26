export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  getClassroomInfo,
  getClassroomRoster,
  getTodayObservationCount,
} from "@/lib/queries";

function age(dob: string | null): string {
  if (!dob) return "";
  const diff = Date.now() - new Date(dob).getTime();
  const years = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  const months = Math.floor(
    (diff % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000)
  );
  return `${years}y ${months}m`;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function TeacherDashboardPage() {
  const [classroom, roster, todayCount] = await Promise.all([
    getClassroomInfo(),
    getClassroomRoster(),
    getTodayObservationCount(),
  ]);

  if (!classroom) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-6">
        <p className="text-warm-gray">Could not load classroom. Check Supabase connection.</p>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-[640px] px-4 py-6">
        {/* Greeting */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-rust uppercase tracking-wider">
              ORBIT TEACHER
            </span>
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-espresso">
            {greeting()}, Teacher
          </h1>
          <p className="text-warm-gray text-sm mt-0.5">
            {today} · {classroom.name}
            {classroom.lesson_theme ? ` · ${classroom.lesson_theme}` : ""}
          </p>
        </div>

        {/* Today's Stats */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="py-3 rounded-xl bg-cream">
              <p className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-espresso">
                {todayCount}
              </p>
              <p className="text-[10px] font-semibold text-warm-gray uppercase tracking-wide mt-0.5">
                Today
              </p>
            </div>
            <div className="py-3 rounded-xl bg-cream">
              <p className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-espresso">
                {roster.length}
              </p>
              <p className="text-[10px] font-semibold text-warm-gray uppercase tracking-wide mt-0.5">
                Students
              </p>
            </div>
            <div className="py-3 rounded-xl bg-cream">
              <p className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-sage">
                ✓
              </p>
              <p className="text-[10px] font-semibold text-warm-gray uppercase tracking-wide mt-0.5">
                On Track
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link
            href="/teacher/observe"
            className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow group"
          >
            <div className="text-2xl mb-2">📝</div>
            <h3 className="font-[family-name:var(--font-playfair)] text-base font-bold text-espresso group-hover:text-rust transition-colors">
              Observe
            </h3>
            <p className="text-[11px] text-warm-gray mt-1 leading-relaxed">
              Capture a moment in 30 seconds
            </p>
          </Link>
          <Link
            href="/teacher/content"
            className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow group"
          >
            <div className="text-2xl mb-2">✨</div>
            <h3 className="font-[family-name:var(--font-playfair)] text-base font-bold text-espresso group-hover:text-rust transition-colors">
              Content Engine
            </h3>
            <p className="text-[11px] text-warm-gray mt-1 leading-relaxed">
              Generate highlights & digests
            </p>
          </Link>
        </div>

        {/* Classroom Roster */}
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">👧</span>
            <h2 className="text-[11px] font-bold text-espresso uppercase tracking-wider">
              {classroom.name}
            </h2>
            <span className="text-[10px] text-warm-gray">
              · {roster.length} children
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {roster.map((child, i) => (
            <Link
              key={child.id}
              href={`/teacher/growth/${child.id}`}
              className={`flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-all fade-up delay-${Math.min(i + 1, 6)}`}
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rust/15 to-golden/15 flex items-center justify-center text-sm font-bold text-espresso shrink-0">
                {child.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-espresso">{child.name}</p>
                {child.date_of_birth && (
                  <p className="text-[11px] text-warm-gray">
                    {age(child.date_of_birth)}
                  </p>
                )}
              </div>
              <span className="text-warm-gray text-xs">📖</span>
            </Link>
          ))}
        </div>

        {roster.length === 0 && (
          <div className="text-center py-12">
            <p className="text-3xl mb-2">👧</p>
            <p className="text-warm-gray text-sm">No children in this classroom yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
