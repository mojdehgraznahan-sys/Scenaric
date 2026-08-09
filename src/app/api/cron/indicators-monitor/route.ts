import { NextResponse } from "next/server";
import { runIndicatorMonitoringForAllProjects } from "@/lib/actions/indicators-monitoring";
import { describeError } from "@/lib/api/error-response";

// Vercel Cron target (see vercel.json) — GET, once every 24h. Protected by a shared secret
// (Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when configured this way)
// rather than a user session, since this route has no session to check
// (src/middleware.ts carves out /api/cron/ from the auth-redirect gate for exactly this reason).
//
// Serial, per-project processing in one invocation. Vercel Hobby caps ALL serverless functions
// at 60s regardless of this setting; Pro/Enterprise can raise it further via project settings.
// If per-project time × project count ever exceeds the real ceiling, the fix is a fan-out
// (separate small invocations per project) — not built now, no project volume exists yet to
// size it against.
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
    const summary = await runIndicatorMonitoringForAllProjects();
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}
