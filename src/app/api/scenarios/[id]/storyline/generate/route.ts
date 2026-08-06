import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { autoSuggestStoryline, markStorylineStatus } from "@/lib/actions/ai-storyline";
import { generateScenarioGrounding } from "@/lib/actions/ai-grounding";
import { describeError } from "@/lib/api/error-response";

// Two medium-effort model calls, one with web search enabled — no after()/waitUntil()
// available on this Next.js version (14.2.35) to run them in the background, so this awaits
// both within a generous budget instead. Adjust to your hosting plan's actual cap.
//
// Sequential, not concurrent: generateScenarioGrounding's plausibility half now reads
// storyline_nodes/storyline_edges (to judge the chain's causal coherence), and
// autoSuggestStoryline replaces those rows wholesale (delete then insert) — running both at
// once would race grounding's read against storyline's write, reading a stale or
// half-written chain. Storyline must fully commit first. This makes total latency additive
// instead of the max of the two, which is why this budget is generous.
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
  // immediately, even before the storyline call below has actually started.
  await markStorylineStatus(supabase, scenario.project_id, scenarioId, { status: "generating", error_message: null });

  // Each call is independent for reporting purposes (one failing shouldn't hide the other's
  // result) even though they now run sequentially rather than concurrently. The storyline half
  // already manages scenario_storylines.status internally (autoSuggestStoryline); the
  // grounding half has no persisted status column (deliberate — plausibility_checks is
  // append-only history, no "failed" concept), so its outcome is reported directly in this
  // response instead. POST /refresh-grounding is the retry path for a failed grounding half.
  let storylineResult: { status: "fulfilled"; value: Awaited<ReturnType<typeof autoSuggestStoryline>> } | { status: "rejected"; reason: unknown };
  try {
    storylineResult = { status: "fulfilled", value: await autoSuggestStoryline(scenarioId) };
  } catch (reason) {
    storylineResult = { status: "rejected", reason };
  }

  let groundingResult: { status: "fulfilled"; value: Awaited<ReturnType<typeof generateScenarioGrounding>> } | { status: "rejected"; reason: unknown };
  try {
    groundingResult = { status: "fulfilled", value: await generateScenarioGrounding(scenarioId) };
  } catch (reason) {
    groundingResult = { status: "rejected", reason };
  }

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
            plausibilityScore: groundingResult.value.plausibility.score,
            signpostsSufficientEvidence: groundingResult.value.signposts.sufficientEvidence,
            signpostCount: groundingResult.value.signposts.signposts.length,
          }
        : { ok: false, error: describeError(groundingResult.reason) },
  });
}
