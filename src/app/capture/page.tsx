export const dynamic = "force-dynamic";

import { getClassroomRoster, getParentChildren } from "@/lib/queries";
import { getSessionProfile } from "@/lib/session";
import { CaptureFlow } from "./capture-flow";

// Fixed ids from scripts/schema-2026-07-overhaul.sql
const SUMMER_CAMP_CLASSROOM_ID = "00000000-0000-0000-0000-000000000011";
const CARLA_PROFILE_ID = "00000000-0000-0000-0000-000000000103";

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  return Math.floor(
    (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );
}

export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<{ ctx?: string }>;
}) {
  const { ctx } = await searchParams;
  const isTeacher = ctx === "teacher";
  const { profileId } = await getSessionProfile();

  const kids = isTeacher
    ? await getClassroomRoster(SUMMER_CAMP_CLASSROOM_ID)
    : await getParentChildren(profileId);

  const roster = kids.map((k) => ({
    id: k.id,
    name: k.name,
    age: ageFromDob(k.date_of_birth),
  }));

  return (
    <CaptureFlow
      ctx={isTeacher ? "teacher" : "parent"}
      roster={roster}
      authorProfileId={isTeacher ? CARLA_PROFILE_ID : profileId}
      classroomId={isTeacher ? SUMMER_CAMP_CLASSROOM_ID : null}
    />
  );
}
