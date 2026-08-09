import { NextResponse } from "next/server";
import { listAlertIndicatorSummaries } from "@/lib/actions/indicators";
import { errorResponse } from "@/lib/api/error-response";

// GET /projects/:id/indicators/alert-summary — current Alert-status indicators, for the
// "N indicators in alert" banner. Each entry's rationale is read verbatim from the most recent
// grounded indicator_readings row — never invented at request time. Empty array when nothing
// is in Alert; the frontend hides the banner entirely in that case.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json(await listAlertIndicatorSummaries(params.id));
  } catch (err) {
    return errorResponse(err);
  }
}
