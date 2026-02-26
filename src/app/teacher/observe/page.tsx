import { getClassroomRoster, getClassroomInfo } from "@/lib/queries";
import { ObservationFlow } from "./observation-flow";

export const dynamic = "force-dynamic";

export default async function ObservePage() {
  const [roster, classroom] = await Promise.all([
    getClassroomRoster(),
    getClassroomInfo(),
  ]);

  return (
    <ObservationFlow
      roster={roster}
      classroomName={classroom?.name ?? "Classroom"}
      classroomTheme={classroom?.lesson_theme ?? null}
    />
  );
}
