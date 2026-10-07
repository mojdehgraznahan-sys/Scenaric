import { NextResponse } from "next/server";
import { runDecisionScanForAllProjects } from "@/lib/actions/decision-scan";
import { describeError } from "@/lib/api/error-response";

// Vercel Cron target (see vercel.json) — GET, once every 24h. Protected by a shared secret,
// same as indicators-monitor/route.ts, which this file copies verbatim apart from the action
// it calls (src/middleware.ts carves out /api/cron/ from the auth-redirect gate for the same
// reason).
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runDecisionScanForAllProjects();
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}
