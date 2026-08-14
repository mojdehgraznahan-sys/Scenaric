import { NextResponse } from "next/server";
import {
  scanLocalActors,
  pullRecentNews,
  researchCompetitors,
  researchRegulations,
  researchSupplyChainGeopolitics,
  researchInternationalMarkets,
} from "@/lib/actions/ai-knowledge-tasks";
import { errorResponse } from "@/lib/api/error-response";

// Fixed task menu — never freeform (see ask-ai.tsx's context="knowledge" branch; freeform is
// the separate /knowledge/chat route). Same dispatch shape as /home/ask-ai.
export const maxDuration = 120;

type Task =
  | "scan_local_actors"
  | "pull_recent_news"
  | "research_competitors"
  | "research_regulations"
  | "research_supply_chain_geopolitics"
  | "research_international_markets";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const projectId = params.id;

  let body: { task?: Task };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    switch (body.task) {
      case "scan_local_actors":
        return NextResponse.json(await scanLocalActors(projectId));

      case "pull_recent_news":
        return NextResponse.json(await pullRecentNews(projectId));

      case "research_competitors":
        return NextResponse.json(await researchCompetitors(projectId));

      case "research_regulations":
        return NextResponse.json(await researchRegulations(projectId));

      case "research_supply_chain_geopolitics":
        return NextResponse.json(await researchSupplyChainGeopolitics(projectId));

      case "research_international_markets":
        return NextResponse.json(await researchInternationalMarkets(projectId));

      default:
        return NextResponse.json({ error: `Unknown task: ${body.task}` }, { status: 400 });
    }
  } catch (err) {
    return errorResponse(err);
  }
}
