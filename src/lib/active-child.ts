import { cookies } from "next/headers";
import { getParentChildren } from "./queries";
import { getSessionProfile } from "./session";

export interface ActiveChildContext {
  children: { id: string; name: string; date_of_birth: string | null }[];
  activeChildId: string | null;
  activeChild: { id: string; name: string; date_of_birth: string | null } | null;
}

// The logged-in parent's selected child, from the `orbit_child` cookie set by
// KidScopePills. Validated against their real children; falls back to
// the oldest child. No children linked → null (pages render an empty state —
// never a demo identity).
export async function getActiveChild(): Promise<ActiveChildContext> {
  const { profileId } = await getSessionProfile();
  const kids = await getParentChildren(profileId);
  const cookieStore = await cookies();
  const requested = cookieStore.get("orbit_child")?.value;

  const active = kids.find((k) => k.id === requested) ?? kids[0] ?? null;

  return {
    children: kids,
    activeChildId: active?.id ?? null,
    activeChild: active,
  };
}

export async function getActiveChildId(): Promise<string | null> {
  const { activeChildId } = await getActiveChild();
  return activeChildId;
}
