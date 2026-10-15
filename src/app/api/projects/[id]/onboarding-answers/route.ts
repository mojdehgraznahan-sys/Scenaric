import { NextResponse } from "next/server";
import { getOnboardingAnswers, updateOnboardingAnswers } from "@/lib/actions/projects";
import { errorResponse } from "@/lib/api/error-response";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    // null when the project has no onboarding_answers row yet (e.g. created before migration
    // 0034, or onboarding was skipped) — the client treats that the same as "every answer
    // unanswered", so there's nothing to normalize here.
    return NextResponse.json(await getOnboardingAnswers(params.id));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    return NextResponse.json(await updateOnboardingAnswers(params.id, body));
  } catch (err) {
    return errorResponse(err);
  }
}
