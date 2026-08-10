import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/me";
import { errorResponse } from "@/lib/api/error-response";

// GET /me — src/middleware.ts already gates every non-public path behind a session, so the
// 401 branch below is defense-in-depth, not the common case.
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    return NextResponse.json(user);
  } catch (err) {
    return errorResponse(err);
  }
}
