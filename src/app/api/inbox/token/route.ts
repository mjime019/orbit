import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { resolveInboxCaller } from "@/lib/inbox-auth";

// The logged-in parent's inbox token (for the Siri shortcut) — read it, or
// rotate it. Never the other parent's.
export async function GET(req: NextRequest) {
  const caller = await resolveInboxCaller(req);
  if (!caller || caller.viaToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data, error } = await caller.sb
    .from("profiles")
    .select("inbox_token")
    .eq("id", caller.profileId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ token: null, unavailable: true });
  }
  return NextResponse.json({
    token: data?.inbox_token ?? null,
    endpoint: `${(process.env.APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`).replace(/\/$/, "")}/api/inbox`,
  });
}

export async function POST(req: NextRequest) {
  const caller = await resolveInboxCaller(req);
  if (!caller || caller.viaToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const token = randomBytes(32).toString("hex");
  const { error } = await caller.sb
    .from("profiles")
    .update({ inbox_token: token })
    .eq("id", caller.profileId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ token });
}
