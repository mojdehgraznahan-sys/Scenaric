import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStoryline } from "@/lib/actions/storyline";
import { errorResponse } from "@/lib/api/error-response";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const scenarioId = params.id;
  const supabase = createClient();

  try {
    // No row yet if /generate has never been called for this scenario — a valid, non-error
    // state (maybeSingle, not single).
    const { data: storyline, error: storylineError } = await supabase
      .from("scenario_storylines")
      .select("*")
      .eq("scenario_id", scenarioId)
      .maybeSingle();
    if (storylineError) throw storylineError;

    const { nodes, edges, thinChain } = await getStoryline(scenarioId);

    // Most recent check only — plausibility_checks is append-only history, "current" is just
    // its latest row (same convention ai-grounding.ts itself relies on).
    const { data: plausibility, error: plausibilityError } = await supabase
      .from("plausibility_checks")
      .select("*")
      .eq("scenario_id", scenarioId)
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (plausibilityError) throw plausibilityError;

    const { data: signposts, error: signpostsError } = await supabase.from("signposts").select("*").eq("scenario_id", scenarioId);
    if (signpostsError) throw signpostsError;

    return NextResponse.json({ storyline, nodes, edges, thinChain, plausibility, signposts });
  } catch (err) {
    return errorResponse(err);
  }
}
