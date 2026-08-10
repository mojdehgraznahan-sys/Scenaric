import { NextResponse } from "next/server";
import { listProjectTeam } from "@/lib/actions/team";
import { errorResponse } from "@/lib/api/error-response";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json(await listProjectTeam(params.id));
  } catch (err) {
    return errorResponse(err);
  }
}
