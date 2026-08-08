"use server";

// §5 — Step 2: Key forces (build order §14 item 4b Phase 2). Fires from the Knowledge
// Base's "Extract insights" button — runs once per eligible source (status: "complete",
// extracted_text populated, not already processed) and writes the resulting insights.
// Type-agnostic: runs identically for Docs/Audio/Survey/Web — each source's extracted_text
// already holds the right content per type (Gemini's transcript for Audio, same as any
// other source), so no separate audio-specific pipeline is needed.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runStructured, AIGenerationFailedError } from "@/lib/ai/client";
import { createClient } from "@/lib/supabase/server";

const SOURCE_TYPE_LABEL: Record<string, "Docs" | "Audio" | "Survey" | "Web"> = {
  doc: "Docs",
  audio: "Audio",
  survey: "Survey",
  web: "Web",
  // The news-feed connector's items (ai-news-feed.ts) are web-sourced too — reuses the
  // "Web" label/tab rather than introducing a 5th insights.source_type value (the DB
  // constraint only allows Docs/Audio/Survey/Web, 0009_insight_source_type_speaker.sql).
  web_feed: "Web",
};

const ExtractInsightsSchema = z.object({
  sufficient_evidence: z.boolean(),
  insights: z
    .array(
      z.object({
        text: z.string(),
        quote: z.string(),
        actor_type: z.string(),
        category: z.enum(["Social", "Technology", "Economic", "Ecological", "Political", "local_actor"]),
        confidence: z.enum(["high", "medium", "low"]),
      })
    )
    .max(8),
});

const TASK_PROMPT = `Task: Extract key forces from ONE source document/transcript relevant to
the focal question — local/task-environment actors (stakeholders and actors that
directly interact with the focal decision: customers, competitors, regulators the org
negotiates with directly, suppliers, partners, internal capability constraints) AND
macro-environmental STEEP trends (Social, Technological, Economic, Ecological, Political
forces outside the org's direct control) both belong in the same output list.

Input: { project_focal_question: string, source_id: string,
         source_type: "Docs"|"Audio"|"Survey"|"Web",
         source_text: string /* full extracted text or transcript, chunked if long */,
         speaker_name?: string, speaker_role?: string /* present only when this source is
         attributed to a known participant — use to attribute quotes correctly, e.g. for
         an interview transcript with multiple speakers */ }

Extraction rules:
- Only extract statements actually present in source_text. Quote or tightly paraphrase —
  do not synthesize claims the source doesn't make.
- Each insight must include a verbatim \`quote\` (<= 40 words) copied from source_text as
  evidence. If you cannot produce a real quote, drop the insight.
- Every insight MUST have a \`category\`: one of "Social", "Technology", "Economic",
  "Ecological", "Political" (a macro STEEP trend) or "local_actor" (a local/task-
  environment force). Never omit this — if genuinely ambiguous between two categories,
  pick the closest one and set confidence: "low" rather than skipping classification.
- \`actor_type\` names WHICH kind of local actor this insight is about — one of:
  "competitor", "regulator", "customer", "supplier", "partner", "internal_capability".
  Still required even when category is a STEEP trend, not local_actor — use your best
  judgment for which actor the trend most directly concerns.
- If speaker_name is provided and an insight is clearly attributable to that speaker (as
  opposed to another speaker or a general statement), you may reference them in \`text\`,
  but do not fabricate attribution when the source has multiple unattributed speakers.
- Cap output at the 8 highest-signal insights per source. Do not pad to hit a round number.

Output schema:
{ sufficient_evidence: boolean,
  insights: [{ text: string, quote: string, actor_type: string,
               category: "Social"|"Technology"|"Economic"|"Ecological"|"Political"|"local_actor",
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
    .select("id, name, type, extracted_text")
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
      const sourceType = SOURCE_TYPE_LABEL[source.type];

      // Real backend data only — never guessed from the transcript itself. Not gated on
      // source.type === "audio": an interview record can legitimately link to any source.
      const { data: interview } = await supabase
        .from("interviews")
        .select("participant_name, role")
        .eq("source_id", source.id)
        .limit(1)
        .maybeSingle();

      const output = await runStructured({
        step: "insights.extract",
        projectId,
        taskPrompt: TASK_PROMPT,
        input: {
          project_focal_question: focalQuestion,
          source_id: source.id,
          source_type: sourceType,
          source_text: source.extracted_text,
          ...(interview?.participant_name ? { speaker_name: interview.participant_name } : {}),
          ...(interview?.role ? { speaker_role: interview.role } : {}),
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
          category: insight.category,
          confidence: insight.confidence,
          source_type: sourceType,
          speaker_name: interview?.participant_name ?? null,
          speaker_role: interview?.role ?? null,
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
