import type { NextRequest } from "next/server";
import { createServerSupabase } from "./supabase-server";
import { createAdminSupabase, hasAdminSupabase } from "./supabase-admin";
import type { AnySupabase } from "./inbox";

export interface InboxCaller {
  profileId: string;
  speakerName: string;
  email: string | null;
  sb: AnySupabase;
  viaToken: boolean;
}

// Who is posting to the inbox: a bearer inbox token (Siri shortcut — no
// session, service-role client) or the logged-in parent (session client).
export async function resolveInboxCaller(req: NextRequest): Promise<InboxCaller | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

  if (token) {
    if (!hasAdminSupabase()) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set — the inbox token channel needs it.");
    }
    const admin = createAdminSupabase();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, name, email")
      .eq("inbox_token", token)
      .maybeSingle();
    if (error) throw new Error(`[db] token lookup: ${error.message}`);
    if (!profile) return null;
    return {
      profileId: profile.id,
      speakerName: profile.name,
      email: profile.email ?? null,
      sb: admin,
      viaToken: true,
    };
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb
    .from("profiles")
    .select("id, name, email")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;
  return {
    profileId: profile.id,
    speakerName: profile.name,
    email: profile.email ?? null,
    sb,
    viaToken: false,
  };
}
