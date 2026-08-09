import { NextResponse } from "next/server";
import { setPrimaryStrategicOption } from "@/lib/actions/strategy";
import { errorResponse } from "@/lib/api/error-response";

// PATCH /projects/:id/strategy/:optionId { is_primary } — "Mark as primary." Only one option
// may be primary per project at a time; setPrimaryStrategicOption unsets any prior primary and
// sets this one atomically via a DB function (0022_strategic_options.sql), not two sequential
// updates from here.
export async function PATCH(request: Request, { params }: { params: { id: string; optionId: string } }) {
  let body: { is_primary?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof body.is_primary !== "boolean") {
    return NextResponse.json({ error: "is_primary (boolean) is required." }, { status: 400 });
  }

  try {
    return NextResponse.json(await setPrimaryStrategicOption(params.id, params.optionId, body.is_primary));
  } catch (err) {
    return errorResponse(err);
  }
}
