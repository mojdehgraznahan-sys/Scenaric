import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { autoSuggestStoryline, markStorylineStatus } from "@/lib/actions/ai-storyline";
import { generateScenarioGrounding } from "@/lib/actions/ai-grounding";
import { describeError } from "@/lib/api/error-response";

// Two concurrent medium-effort model calls, one with web search enabled — no after()/
// waitUntil() available on this Next.js version (14.2.35) to run them in the background, so
// this awaits both within a generous budget instead. Adjust to your hosting plan's actual cap.
export const maxDuration = 300;

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const scenarioId = params.id;
  const supabase = createClient();

  const { data: scenario, error: scenarioError } = await supabase
    .from("scenarios")
    .select("id, project_id")
    .eq("id", scenarioId)
    .maybeSingle();
  if (scenarioError) return NextResponse.json({ error: scenarioError.message }, { status: 500 });
  if (!scenario) return NextResponse.json({ error: `Scenario ${scenarioId} not found.` }, { status: 404 });

  // Belt-and-suspenders: autoSuggestStoryline re-asserts 'generating' itself as its first
  // action, but marking it here too means a client polling GET /storyline sees 'generating'
  // immediately, even before either call below has actually started.
  await markStorylineStatus(supabase, scenario.project_id, scenarioId, { status: "generating", error_message: null });

  // allSettled, not all — these are independent calls; one failing shouldn't cancel or hide
  // the other's result. The storyline half already manages scenario_storylines.status
  // internally (autoSuggestStoryline); the grounding half has no persisted status column
  // (deliberate — plausibility_checks is append-only history, no "failed" concept), so its
  // outcome is reported directly in this response instead. POST /refresh-grounding is the
  // retry path for a failed grounding half.
  const [storylineResult, groundingResult] = await Promise.allSettled([
    autoSuggestStoryline(scenarioId),
    generateScenarioGrounding(scenarioId),
  ]);

  return NextResponse.json({
    storyline:
      storylineResult.status === "fulfilled"
        ? {
            ok: true,
            sufficientEvidence: storylineResult.value.sufficientEvidence,
            gap: storylineResult.value.gap,
            nodeCount: storylineResult.value.nodes.length,
            edgeCount: storylineResult.value.edges.length,
          }
        : { ok: false, error: describeError(storylineResult.reason) },
    grounding:
      groundingResult.status === "fulfilled"
        ? {
            ok: true,
            confidenceScore: groundingResult.value.plausibility.score,
            signpostsSufficientEvidence: groundingResult.value.signposts.sufficientEvidence,
            signpostCount: groundingResult.value.signposts.signposts.length,
          }
        : { ok: false, error: describeError(groundingResult.reason) },
  });
}
