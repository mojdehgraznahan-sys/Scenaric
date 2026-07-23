"use server";

// §5 — Step 2: Key forces (build order §14 item 4b Phase 2). Fires from the Knowledge
// Base's "Extract insights" button — runs once per eligible source (status: "complete",
// extracted_text populated, not already processed) and writes the resulting insights.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runStructured, AIGenerationFailedError } from "@/lib/ai/client";
import { createClient } from "@/lib/supabase/server";

const ExtractInsightsSchema = z.object({
  sufficient_evidence: z.boolean(),
  insights: z
    .array(
      z.object({
        text: z.string(),
        quote: z.string(),
        actor_type: z.string(),
        confidence: z.enum(["high", "medium", "low"]),
      })
    )
    .max(8),
});

const TASK_PROMPT = `Task: Extract key local-environment forces from ONE source document/
transcript. Key forces = stakeholders and actors that directly interact
with the focal decision (customers, competitors, regulators the org
negotiates with directly, suppliers, partners, internal capability
constraints) — NOT macro trends (those are Step 3, driving forces).

Input: { project_focal_question: string, source_id: string,
         source_text: string /* full extracted text, chunked if long */ }

Extraction rules:
- Only extract statements actually present in source_text. Quote or
  tightly paraphrase — do not synthesize claims the source doesn't make.
- Each insight must include a verbatim \`quote\` (<= 40 words) copied from
  source_text as evidence. If you cannot produce a real quote, drop the
  insight.
- Classify each insight's STEEP category ONLY if it's a driving force;
  key forces (this step) are tagged \`local_actor\` instead.
- \`actor_type\` names WHICH kind of local actor this insight is about —
  one of: "competitor", "regulator", "customer", "supplier", "partner",
  "internal_capability". This is distinct from the fixed \`local_actor\`
  category tag above; do not repeat "local_actor" as the actor_type.
- Cap output at the 8 highest-signal insights per source. Do not pad to
  hit a round number.

Output schema:
{ sufficient_evidence: boolean,
  insights: [{ text: string, quote: string, actor_type: string,
               confidence: "high"|"medium"|"low" }] }`;

export interface ExtractInsightsResult {
  sourcesProcessed: number;
  insightsCreated: number;
  failures: { sourceId: string; sourceName: string }[];
}

export async function extractInsightsForProject(projectId: string): Promise<ExtractInsightsResult> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("focal_question, refined_focal_question")
    .eq("id", projectId)
    .single();
  if (projectError) throw projectError;
  const focalQuestion = project.refined_focal_question ?? project.focal_question;

  const { data: candidates, error: sourcesError } = await supabase
    .from("sources")
    .select("id, name, extracted_text")
    .eq("project_id", projectId)
    .eq("status", "complete")
    .not("extracted_text", "is", null);
  if (sourcesError) throw sourcesError;

  const { data: existingInsights, error: insightsError } = await supabase
    .from("insights")
    .select("source_id")
    .eq("project_id", projectId);
  if (insightsError) throw insightsError;
  const alreadyProcessed = new Set(existingInsights.map((i) => i.source_id));

  const eligible = candidates.filter((s) => !alreadyProcessed.has(s.id));

  const result: ExtractInsightsResult = { sourcesProcessed: 0, insightsCreated: 0, failures: [] };

  for (const source of eligible) {
    result.sourcesProcessed += 1;
    try {
      const output = await runStructured({
        step: "insights.extract",
        projectId,
        taskPrompt: TASK_PROMPT,
        input: {
          project_focal_question: focalQuestion,
          source_id: source.id,
          source_text: source.extracted_text,
        },
        schema: ExtractInsightsSchema,
        effort: "medium",
      });

      if (!output.sufficient_evidence || output.insights.length === 0) continue;

      const { error: insertError } = await supabase.from("insights").insert(
        output.insights.map((insight) => ({
          project_id: projectId,
          source_id: source.id,
          text: insight.text,
          quote: insight.quote,
          actor_type: insight.actor_type,
          confidence: insight.confidence,
          category: "local_actor" as const,
        }))
      );
      if (insertError) throw insertError;
      result.insightsCreated += output.insights.length;
    } catch (err) {
      if (err instanceof AIGenerationFailedError) {
        result.failures.push({ sourceId: source.id, sourceName: source.name });
      } else {
        throw err;
      }
    }
  }

  revalidatePath("/knowledge");
  return result;
}
