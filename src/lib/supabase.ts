import { createBrowserClient } from "@supabase/ssr";

// Browser client: carries the logged-in session (auth + RLS `authenticated`
// role). Client components only — server code uses supabase-server.ts.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
