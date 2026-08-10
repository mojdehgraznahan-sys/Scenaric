import { NextResponse } from "next/server";
import { getProjectBilling } from "@/lib/actions/billing";
import { errorResponse } from "@/lib/api/error-response";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json(await getProjectBilling(params.id));
  } catch (err) {
    return errorResponse(err);
  }
}
