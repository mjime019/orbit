import { createServerSupabase } from "./supabase-server";

// For the demo, we use the fixed seed data UUIDs.
// In production, these would come from the auth session.
const DEMO_CHILD_ID = "00000000-0000-0000-0000-000000001001";
export const DEMO_PARENT_ID = "00000000-0000-0000-0000-000000000201";
const DEMO_SCHOOL_ID = "00000000-0000-0000-0000-000000000001";
const DEMO_CLASSROOM_ID = "00000000-0000-0000-0000-000000000010";

// DB errors must surface (throw) so pages render an error state instead of
// confidently rendering empty — e.g. when the Supabase project is paused.
// `must` (single rows) returns `any` because the untyped Supabase client
// infers `never` rows through .maybeSingle() — same looseness the direct
// destructuring had. `mustList` keeps the client's array inference.
function must(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: { data: any; error: { message: string } | null },
  context: string
) {
  if (result.error) {
    throw new Error(`[db] ${context}: ${result.error.message}`);
  }
  return result.data;
}

function mustList<T>(
  result: { data: T[] | null; error: { message: string } | null },
  context: string
): T[] {
  if (result.error) {
    throw new Error(`[db] ${context}: ${result.error.message}`);
  }
  return result.data ?? [];
}

export async function getChildWithProfile(childId = DEMO_CHILD_ID) {
  const sb = createServerSupabase();

  const [childRes, profileRes] = await Promise.all([
    sb.from("children").select("*").eq("id", childId).maybeSingle(),
    sb.from("child_profiles").select("*").eq("child_id", childId).maybeSingle(),
  ]);
  const child = must(childRes, "load child");
  const profile = must(profileRes, "load child profile");

  let classroom: { name: string; lesson_theme: string | null } | null = null;
  if (child?.classroom_id) {
    classroom = must(
      await sb
        .from("classrooms")
        .select("name, lesson_theme")
        .eq("id", child.classroom_id)
        .maybeSingle(),
      "load classroom"
    );
  }

  return { child, profile, classroom };
}

export async function getRecentHighlights(childId = DEMO_CHILD_ID, limit = 5) {
  const sb = createServerSupabase();
  const data = mustList(
    await sb
      .from("highlights")
      .select("*")
      .eq("child_id", childId)
      .eq("status", "sent")
      .order("created_at", { ascending: false })
      .limit(limit),
    "load highlights"
  );
  return data ?? [];
}

export async function getRecentObservations(
  childId = DEMO_CHILD_ID,
  limit = 10
) {
  const sb = createServerSupabase();
  const data = mustList(
    await sb
      .from("observations")
      .select("*, profiles!observations_teacher_id_fkey(name)")
      .eq("child_id", childId)
      .order("created_at", { ascending: false })
      .limit(limit),
    "load observations"
  );
  return data ?? [];
}

export async function getActivityRecommendations(
  childId = DEMO_CHILD_ID,
  limit = 3
) {
  const sb = createServerSupabase();
  const data = mustList(
    await sb
      .from("activity_recommendations")
      .select("*, activities(*)")
      .eq("child_id", childId)
      .eq("dismissed", false)
      .eq("completed", false)
      .order("recommended_at", { ascending: false })
      .limit(limit),
    "load activity recommendations"
  );
  return data ?? [];
}

export async function getWeekendRecommendations(
  childId = DEMO_CHILD_ID,
  limit = 4
) {
  const sb = createServerSupabase();
  const data = mustList(
    await sb
      .from("weekend_recommendations")
      .select("*, weekend_places(*)")
      .eq("child_id", childId)
      .eq("dismissed", false)
      .order("fit_score", { ascending: false })
      .limit(limit),
    "load weekend recommendations"
  );
  return data ?? [];
}

export async function getUpcomingCalendarEvents(
  schoolId = DEMO_SCHOOL_ID,
  limit = 6
) {
  const sb = createServerSupabase();
  const today = new Date().toISOString().split("T")[0];
  const data = mustList(
    await sb
      .from("school_calendar")
      .select("*")
      .eq("school_id", schoolId)
      .gte("event_date", today)
      .order("event_date", { ascending: true })
      .limit(limit),
    "load calendar events"
  );
  return data ?? [];
}

export async function getLatestJourneyChapter(childId = DEMO_CHILD_ID) {
  const sb = createServerSupabase();
  const data = mustList(
    await sb
      .from("journey_chapters")
      .select("*")
      .eq("child_id", childId)
      .order("created_at", { ascending: false })
      .limit(1),
    "load journey chapter"
  );
  return data?.[0] ?? null;
}

// Keep old name as alias for backward compat
export const getJourneyChapters = getLatestJourneyChapter;

export async function getAllJourneyChapters(childId = DEMO_CHILD_ID) {
  const sb = createServerSupabase();
  const data = mustList(
    await sb
      .from("journey_chapters")
      .select("*")
      .eq("child_id", childId)
      .order("created_at", { ascending: true }),
    "load journey chapters"
  );
  return data ?? [];
}

export async function getAllSentHighlights(childId = DEMO_CHILD_ID) {
  const sb = createServerSupabase();
  const data = mustList(
    await sb
      .from("highlights")
      .select("*, profiles!highlights_approved_by_fkey(name)")
      .eq("child_id", childId)
      .eq("status", "sent")
      .order("created_at", { ascending: false }),
    "load sent highlights"
  );
  return data ?? [];
}

export async function getTodayObservationCount(classroomId = DEMO_CLASSROOM_ID) {
  const sb = createServerSupabase();
  const today = new Date().toISOString().split("T")[0];
  const { count, error } = await sb
    .from("observations")
    .select("id", { count: "exact", head: true })
    .eq("classroom_id", classroomId)
    .gte("created_at", today)
    .lt("created_at", today + "T23:59:59.999Z");
  if (error) {
    throw new Error(`[db] count today's observations: ${error.message}`);
  }
  return count ?? 0;
}

export async function getChildContext(childId: string) {
  const sb = createServerSupabase();

  const child = must(
    await sb
      .from("children")
      .select("name, date_of_birth, classroom_id")
      .eq("id", childId)
      .maybeSingle(),
    "load child"
  );

  const [profileRes, classroomRes] = await Promise.all([
    sb
      .from("child_profiles")
      .select("interests, parent_goals")
      .eq("child_id", childId)
      .maybeSingle(),
    sb
      .from("classrooms")
      .select("name, lesson_theme")
      .eq("id", child?.classroom_id ?? "")
      .maybeSingle(),
  ]);
  const profile = must(profileRes, "load child profile");
  const classroom = must(classroomRes, "load classroom");

  const age = child?.date_of_birth
    ? Math.floor(
        (Date.now() - new Date(child.date_of_birth).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000)
      )
    : 4;

  return {
    childName: child?.name ?? "Child",
    childAge: age,
    classroomName: classroom?.name ?? "Classroom",
    classroomTheme: classroom?.lesson_theme ?? "",
    interests: profile?.interests ?? [],
    parentGoals: profile?.parent_goals ?? [],
  };
}

export async function getClassroomRoster(
  classroomId = DEMO_CLASSROOM_ID
) {
  const sb = createServerSupabase();
  const data = mustList(
    await sb
      .from("children")
      .select("id, name, date_of_birth")
      .eq("classroom_id", classroomId)
      .order("name"),
    "load classroom roster"
  );
  return data ?? [];
}

export async function getClassroomInfo(
  classroomId = DEMO_CLASSROOM_ID
) {
  const sb = createServerSupabase();
  return must(
    await sb
      .from("classrooms")
      .select("id, name, lesson_theme")
      .eq("id", classroomId)
      .maybeSingle(),
    "load classroom info"
  );
}

// ─── Phase 3 Query Helpers ────────────────────────────────────────

export async function getAllWeekendPlaces() {
  const sb = createServerSupabase();
  const data = mustList(
    await sb
      .from("weekend_places")
      .select("*")
      .order("rating", { ascending: false }),
    "load weekend places"
  );
  return data ?? [];
}

export async function getExtracurricularProviders(
  schoolId = DEMO_SCHOOL_ID
) {
  const sb = createServerSupabase();
  const data = mustList(
    await sb
      .from("extracurricular_providers")
      .select("*")
      .or(`school_id.eq.${schoolId},school_id.is.null`)
      .order("name"),
    "load extracurricular providers"
  );
  return data ?? [];
}

export async function getTransitionSchools(childId = DEMO_CHILD_ID) {
  const sb = createServerSupabase();
  const data = mustList(
    await sb
      .from("transition_schools")
      .select("*")
      .eq("child_id", childId)
      .order("rating_fit", { ascending: false, nullsFirst: false }),
    "load transition schools"
  );
  return data ?? [];
}

// ─── Phase 2 Query Helpers ────────────────────────────────────────

export async function getOrCreateConversation(
  childId = DEMO_CHILD_ID,
  parentId = DEMO_PARENT_ID
) {
  const sb = createServerSupabase();

  const existing = must(
    await sb
      .from("conversations")
      .select("*")
      .eq("child_id", childId)
      .eq("parent_id", parentId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "load conversation"
  );

  if (existing) return existing;

  return must(
    await sb
      .from("conversations")
      .insert({
        child_id: childId,
        parent_id: parentId,
        title: null,
      })
      .select("*")
      .single(),
    "create conversation"
  );
}

export async function getConversationMessages(
  conversationId: string,
  limit = 20
) {
  const sb = createServerSupabase();
  const data = mustList(
    await sb
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(limit),
    "load conversation messages"
  );
  return data ?? [];
}

export async function getSchoolKnowledge(schoolId = DEMO_SCHOOL_ID) {
  const sb = createServerSupabase();

  const [schoolRes, knowledgeRes, calendarRes] = await Promise.all([
    sb.from("schools").select("name, address").eq("id", schoolId).maybeSingle(),
    sb
      .from("school_knowledge")
      .select("category, title, content")
      .eq("school_id", schoolId)
      .limit(20),
    sb
      .from("school_calendar")
      .select("event_date, event_type, title, details")
      .eq("school_id", schoolId)
      .gte("event_date", new Date().toISOString().split("T")[0])
      .order("event_date", { ascending: true })
      .limit(5),
  ]);
  const school = must(schoolRes, "load school");
  const knowledge = mustList(knowledgeRes, "load school knowledge");
  const calendar = mustList(calendarRes, "load school calendar");

  const knowledgeText = (knowledge ?? [])
    .map((k) => `[${k.category}] ${k.title}: ${k.content}`)
    .join("\n");

  const calendarText = (calendar ?? [])
    .map((e) => `${e.event_date} — ${e.title} (${e.event_type}): ${e.details ?? ""}`)
    .join("\n");

  return `School: ${school?.name ?? "School"}\nAddress: ${school?.address ?? ""}\n\nKnowledge Base:\n${knowledgeText || "No knowledge base entries."}\n\nUpcoming Events:\n${calendarText || "No upcoming events."}`;
}
