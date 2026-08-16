import { NextResponse } from "next/server";
import {
  explainSelectedDot,
  findCoverageGaps,
  suggestAlternateAxisPair,
  explainPredeterminedElements,
  explainWildcards,
} from "@/lib/actions/ai-matrix-tasks";
import { checkAxisIndependence } from "@/lib/actions/ai-matrix";
import { errorResponse } from "@/lib/api/error-response";

// Fixed task menu — never freeform (see ask-ai.tsx's context="matrix" branch). Step 4 (Rank
// forces) is closed-book per SCHWARTZ_METHODOLOGY_SKILL.md's research-mode table — none of
// these tasks attach webSearch.
export const maxDuration = 120;

type Task = "explain_dot" | "check_independence" | "coverage_gaps" | "alternate_axis_pair" | "predetermined_elements" | "wildcards";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const projectId = params.id;

  let body: { task?: Task; signalId?: string; axisASignalId?: string; axisBSignalId?: string; excludeSignalIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    switch (body.task) {
      case "explain_dot":
        if (!body.signalId) {
          return NextResponse.json({ error: "signalId is required for explain_dot." }, { status: 400 });
        }
        return NextResponse.json(await explainSelectedDot(projectId, body.signalId));

      case "check_independence":
        if (!body.axisASignalId || !body.axisBSignalId) {
          return NextResponse.json({ error: "axisASignalId and axisBSignalId are required for check_independence." }, { status: 400 });
        }
        return NextResponse.json(await checkAxisIndependence({ projectId, axisASignalId: body.axisASignalId, axisBSignalId: body.axisBSignalId }));

      case "coverage_gaps":
        return NextResponse.json(await findCoverageGaps(projectId));

      case "alternate_axis_pair":
        return NextResponse.json(await suggestAlternateAxisPair(projectId, body.excludeSignalIds ?? []));

      case "predetermined_elements":
        return NextResponse.json(await explainPredeterminedElements(projectId));

      case "wildcards":
        return NextResponse.json(await explainWildcards(projectId));

      default:
        return NextResponse.json({ error: `Unknown task: ${body.task}` }, { status: 400 });
    }
  } catch (err) {
    return errorResponse(err);
  }
}
