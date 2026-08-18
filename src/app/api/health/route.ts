import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

// Keep-alive ping, hit daily by the Vercel cron (vercel.json). The Supabase
// free tier pauses projects after ~7 idle days; any REST request counts as
// activity, so one trivial query a day keeps the DB awake. Unauthenticated
// (exempted in proxy.ts) — under RLS this returns no rows, only liveness.
export async function GET() {
  const sb = await createServerSupabase();
  const { error } = await sb
    .from("schools")
    .select("id", { count: "exact", head: true });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
