import { NextRequest, NextResponse } from "next/server";

// Shared-secret gate for the camp pilot routes. Not real auth — just enough
// to keep a passed-around demo URL from exposing the API. The teacher enters
// the code once on /camp; the client sends it as the x-camp-key header.
// Fails closed: if CAMP_ACCESS_KEY is unset, every request is rejected.
export function requireCampKey(req: NextRequest): NextResponse | null {
  const expected = process.env.CAMP_ACCESS_KEY;
  if (!expected || req.headers.get("x-camp-key") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
