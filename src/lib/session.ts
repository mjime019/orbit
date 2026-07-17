import { createServerSupabase } from "./supabase-server";

export interface SessionProfile {
  profileId: string;
  displayName: string;
  email: string;
}

// The logged-in parent's profile. Fails loud — a session without a profiles
// row means the family seed SQL hasn't run for this user; never fall back to
// a demo identity.
export async function getSessionProfile(): Promise<SessionProfile> {
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    throw new Error("No session — the proxy should have redirected to /login.");
  }

  const { data: profile, error } = await sb
    .from("profiles")
    .select("id, name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`[db] load session profile: ${error.message}`);
  }
  if (!profile) {
    throw new Error(
      `Logged in as ${user.email} but no profiles row exists for this account. ` +
        "Run scripts/pivot/04-family-seed.sql (with this user's auth UUID) in the Supabase dashboard."
    );
  }

  return { profileId: profile.id, displayName: profile.name, email: profile.email };
}
