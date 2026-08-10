import { NextResponse } from "next/server";
import { runNewsFeedForAllProjects } from "@/lib/actions/ai-news-items";
import { describeError } from "@/lib/api/error-response";

// Vercel Cron target (see vercel.json) — GET, once every 24h. Same shared-secret pattern as
// /api/cron/indicators-monitor (Vercel sends `Authorization: Bearer $CRON_SECRET`
// automatically when configured this way); src/middleware.ts carves out /api/cron/ from the
// auth-redirect gate for exactly this reason.
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
    const summary = await runNewsFeedForAllProjects();
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}
