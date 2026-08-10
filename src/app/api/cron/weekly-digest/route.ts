import { NextResponse } from "next/server";
import { runWeeklyDigestForAllProjects } from "@/lib/actions/weekly-digest";
import { describeError } from "@/lib/api/error-response";

// Vercel Cron target (see vercel.json) — GET, once weekly. Same shared-secret pattern as
// /api/cron/indicators-monitor and /api/cron/news-feed.
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
    const summary = await runWeeklyDigestForAllProjects();
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}
