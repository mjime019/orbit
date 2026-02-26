import { getClassroomRoster, getClassroomInfo } from "@/lib/queries";
import { ContentEngine } from "./content-engine";

export const dynamic = "force-dynamic";

export default async function ContentEnginePage() {
  const [roster, classroom] = await Promise.all([
    getClassroomRoster(),
    getClassroomInfo(),
  ]);

  return (
    <ContentEngine
      roster={roster}
      classroomName={classroom?.name ?? "Classroom"}
      classroomTheme={classroom?.lesson_theme ?? null}
    />
  );
}
