import { createClient } from "@supabase/supabase-js";

// Service-role client for the channels that have NO user session: the
// inbox token endpoint, the inbound-email webhook, and the digest cron.
// It bypasses RLS, so it is only ever constructed inside those server
// routes, after the caller has been authenticated by other means (token,
// webhook signature, CRON_SECRET). Never import from client code.
export function createAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — the inbox and digest channels need it (Vercel → Settings → Environment Variables, sensitive)."
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hasAdminSupabase(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
