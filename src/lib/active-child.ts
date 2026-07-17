import { cookies } from "next/headers";
import { getParentChildren } from "./queries";

export interface ActiveChildContext {
  children: { id: string; name: string; date_of_birth: string | null }[];
  activeChildId: string;
  activeChild: { id: string; name: string; date_of_birth: string | null } | null;
}

const FALLBACK_CHILD_ID = "00000000-0000-0000-0000-000000001001"; // Johnny

// The parent's selected child, from the `orbit_child` cookie set by the
// header switcher. Validated against their real children; falls back to the
// first child (Johnny in the demo). Stand-in for a session until auth lands.
export async function getActiveChild(): Promise<ActiveChildContext> {
  const kids = await getParentChildren();
  const cookieStore = await cookies();
  const requested = cookieStore.get("orbit_child")?.value;

  const active =
    kids.find((k) => k.id === requested) ?? kids[0] ?? null;

  return {
    children: kids,
    activeChildId: active?.id ?? FALLBACK_CHILD_ID,
    activeChild: active,
  };
}

export async function getActiveChildId(): Promise<string> {
  const { activeChildId } = await getActiveChild();
  return activeChildId;
}
