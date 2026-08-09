import { NextResponse } from "next/server";
import { listIndicatorsForProjectWithReadings } from "@/lib/actions/indicators";
import { errorResponse } from "@/lib/api/error-response";

// GET /projects/:id/indicators — indicators joined with their last 7 indicator_readings (real
// sparkline data) and current status/trend (already computed by the daily monitoring job,
// indicators-monitoring.ts — this route only reads it). Pure DB read, no AI call.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json(await listIndicatorsForProjectWithReadings(params.id));
  } catch (err) {
    return errorResponse(err);
  }
}
