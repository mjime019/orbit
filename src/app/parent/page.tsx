import {
  getChildWithProfile,
  getRecentHighlights,
  getRecentObservations,
  getActivityRecommendations,
  getWeekendRecommendations,
  getUpcomingCalendarEvents,
  getJourneyChapters,
} from "@/lib/queries";
import { ControlRoom } from "./control-room";

// This page fetches user-specific data — never statically generate it.
export const dynamic = "force-dynamic";

export default async function ParentPage() {
  const [
    { child, profile, classroom },
    highlights,
    observations,
    activityRecs,
    weekendRecs,
    calendarEvents,
    currentChapter,
  ] = await Promise.all([
    getChildWithProfile(),
    getRecentHighlights(),
    getRecentObservations(),
    getActivityRecommendations(),
    getWeekendRecommendations(),
    getUpcomingCalendarEvents(),
    getJourneyChapters(),
  ]);

  return (
    <ControlRoom
      child={child}
      profile={profile}
      classroomName={classroom?.name ?? null}
      classroomTheme={classroom?.lesson_theme ?? null}
      highlights={highlights}
      observations={observations}
      activityRecs={activityRecs}
      weekendRecs={weekendRecs}
      calendarEvents={calendarEvents}
      currentChapter={currentChapter}
    />
  );
}
