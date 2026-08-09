import { NextResponse } from "next/server";
import { generateStrategicOptions } from "@/lib/actions/ai-strategy";
import { errorResponse } from "@/lib/api/error-response";

// POST /projects/:id/strategy/generate — "Generate options" button (Build Plan §12,
// SCHWARTZ_METHODOLOGY_SKILL.md's "+" row). Project-scoped, not scenario-scoped: it reads all 4
// of the project's active scenarios (logic + implications) plus its predetermined elements in
// one call, unlike indicators/implications which are generated per scenario.
export const maxDuration = 120;

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json(await generateStrategicOptions(params.id));
  } catch (err) {
    return errorResponse(err);
  }
}
