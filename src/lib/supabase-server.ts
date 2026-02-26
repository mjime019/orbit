import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client (uses service role implicitly via anon key for now).
// In production this would use createServerClient from @supabase/ssr with cookies.
export function createServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
