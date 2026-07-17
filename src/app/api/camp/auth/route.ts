import { NextRequest, NextResponse } from "next/server";
import { requireCampKey } from "@/lib/camp-auth";

// Validates an access code so the /camp gate can reject a wrong one at entry
// rather than after the teacher has already recorded. Touches nothing.
export async function POST(req: NextRequest) {
  const unauthorized = requireCampKey(req);
  if (unauthorized) return unauthorized;
  return NextResponse.json({ ok: true });
}
