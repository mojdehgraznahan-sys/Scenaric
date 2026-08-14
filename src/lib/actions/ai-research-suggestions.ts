"use server";

// Steps 2/3 exploratory research (SCHWARTZ_METHODOLOGY_SKILL.md's "Where research mode
// (live web/news) is allowed vs. forbidden" section) — the only two build-order steps besides
// step 8 allowed to run live web/news lookups. Both scans below are read-only web_search calls
// that stage their results into research_suggestions (0029_research_suggestions.sql,
// status:'suggested', source:'external_research') — never inserted directly as signals/
// insights. Promotion only happens via confirmResearchSuggestion, mirroring the Dashboard News
// Feed's news_items -> addNewsItemToSignals staging pattern (ai-news-items.ts).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { runStructured } from "@/lib/ai/client";
import { AIWebSearchError, NotFoundError } from "@/lib/ai/errors";
import { createClient } from "@/lib/supabase/server";
import { createSignal } from "./signals";
import { scoreOneSignal } from "./ai-signals";
import type { Database } from "@/lib/supabase/types";

export type ResearchSuggestionRow = Database["public"]["Tables"]["research_suggestions"]["Row"];
type SignalRow = Database["public"]["Tables"]["signals"]["Row"];

const LocalForceScanSchema = z.object({
  sufficient_evidence: z.boolean(),
  gap: z.string().nullable(),
  items: z
    .array(
      z.object({
        actor_name: z.string(),
        actor_type: z.enum(["competitor", "regulator", "customer", "supplier", "partner", "internal_capability"]),
        // 2-3 sentences: who they are and why they matter to the focal question — not a quote,
        // this is the model's own summary of what it found via web_search.
        description: z.string(),
        citation_title: z.string(),
        citation_url: z.string(),
      })
    )
    .max(8),
});

const LOCAL_FORCE_SCAN_TASK_PROMPT = `Task: Search the live web for REAL, currently-active local/task-
environment actors (Step 2, Key forces — customers, suppliers, competitors, regulators,
partners the org would directly interact with) relevant to this project's focal question,
that are not already covered by its existing local-actor insights.

Input: { focal_question: string, industry: string, horizon: string,
         existing_actors: [{ actor_name: string, actor_type: string }]
         /* avoid resurfacing one of these — check semantic overlap, not just exact name match */ }

Rules:
- Every item must be a real, currently-relevant actor you actually found via web_search —
  never a fabricated company/agency/name. cite the real source you found it in.
- \`actor_type\` is exactly one of: competitor, regulator, customer, supplier, partner,
  internal_capability.
- \`description\` is 2-3 sentences explaining who this actor is and the specific mechanism by
  which they bear on the focal question — not generic company-profile text.
- citation_title/citation_url must be the real title/URL you found this actor referenced in —
  never invented.
- Skip anything semantically the same as an existing_actors entry.
- If web_search turns up nothing genuinely new and relevant, return sufficient_evidence:false
  and a gap explaining why — do not pad with tangential results to look complete.
- Cap at 8 items per call.

Output schema:
{ sufficient_evidence: boolean, gap: string | null,
  items: [{ actor_name: string, actor_type: "competitor"|"regulator"|"customer"|"supplier"|
            "partner"|"internal_capability", description: string, citation_title: string,
            citation_url: string }] }`;

const MacroTrendSweepSchema = z.object({
  sufficient_evidence: z.boolean(),
  gap: z.string().nullable(),
  items: z
    .array(
      z.object({
        title: z.string(),
        body: z.string(),
        category: z.enum(["Social", "Technology", "Economic", "Ecological", "Political"]),
        citation_title: z.string(),
        citation_url: z.string(),
      })
    )
    .max(8),
});

const MACRO_TREND_SWEEP_TASK_PROMPT = `Task: Search the live web for REAL, currently-relevant
macro-environmental STEEP trends (Step 3, Driving forces — Social, Technological, Economic,
Ecological, Political forces outside the org's direct control) relevant to this project's
focal question, that are not already covered by its existing signals.

Input: { focal_question: string, industry: string, horizon: string,
         existing_signals: [{ title: string, category: string }]
         /* avoid resurfacing one of these — check semantic overlap, not just exact title match */ }

Rules:
- Every item must be a real, currently-relevant macro trend you actually found via web_search —
  never a fabricated statistic, report, or trend.
- Each item needs exactly one STEEP category: Social, Technology, Economic, Ecological, or
  Political.
- Write \`title\` as a factual trend statement (<=8 words), \`body\` as a 2-sentence
  explanation of the mechanism connecting it to the focal question.
- citation_title/citation_url must be the real title/URL you found this trend reported in —
  never invented.
- Skip anything semantically the same as an existing_signals entry.
- If web_search turns up nothing genuinely new and relevant, return sufficient_evidence:false
  and a gap explaining why — do not pad with tangential results to look complete.
- Cap at 8 items per call.

Output schema:
{ sufficient_evidence: boolean, gap: string | null,
  items: [{ title: string, body: string,
            category: "Social"|"Technology"|"Economic"|"Ecological"|"Political",
            citation_title: string, citation_url: string }] }`;

export interface RunScanResult {
  sufficientEvidence: boolean;
  gap: string | null;
  suggestionsCreated: number;
}

export interface RunScanOptions {
  /** Steers (never restricts) this one call toward a specific angle — e.g. "competitors only,
   *  emphasize recent moves" — without changing the output schema or actor_type/category enum.
   *  Same spirit as ai-news-feed.ts's focusTopics param. Omitted by default; every existing
   *  caller (this page's generic scan buttons, Signals' "Scan for driving forces") is
   *  unaffected. */
  focus?: string;
}

// Step 2 — Key forces. "Scan for local actors (web)" on the Knowledge Base page.
export async function runLocalForceScan(projectId: string, options: RunScanOptions = {}): Promise<RunScanResult> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("focal_question, refined_focal_question, industry, horizon")
    .eq("id", projectId)
    .single();
  if (projectError) throw projectError;

  const { data: existingInsights, error: insightsError } = await supabase
    .from("insights")
    .select("text, actor_type")
    .eq("project_id", projectId)
    .eq("category", "local_actor");
  if (insightsError) throw insightsError;

  let output: z.infer<typeof LocalForceScanSchema>;
  try {
    output = await runStructured({
      step: "signals.local_force_scan",
      projectId,
      taskPrompt: options.focus ? `${LOCAL_FORCE_SCAN_TASK_PROMPT}\n\nFOCUS (this call only): ${options.focus}` : LOCAL_FORCE_SCAN_TASK_PROMPT,
      input: {
        focal_question: project.refined_focal_question ?? project.focal_question,
        industry: project.industry,
        horizon: project.horizon,
        existing_actors: existingInsights.map((i) => ({ actor_name: i.text, actor_type: i.actor_type ?? "" })),
      },
      schema: LocalForceScanSchema,
      effort: "medium",
      webSearch: { maxUses: 5 },
      maxTokens: 6000,
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) throw new AIWebSearchError(err);
    throw err;
  }

  if (!output.sufficient_evidence || output.items.length === 0) {
    return { sufficientEvidence: false, gap: output.gap, suggestionsCreated: 0 };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("research_suggestions")
    .upsert(
      output.items.map((item) => ({
        project_id: projectId,
        step: "key_forces" as const,
        title: item.actor_name,
        body: item.description,
        actor_type: item.actor_type,
        citation_title: item.citation_title,
        citation_url: item.citation_url,
      })),
      { onConflict: "project_id,step,title", ignoreDuplicates: true }
    )
    .select("id");
  if (insertError) throw insertError;

  revalidatePath("/knowledge");
  return { sufficientEvidence: true, gap: null, suggestionsCreated: inserted.length };
}

// Step 3 — Driving forces. "Scan for driving forces (web)" on the Signals Library page.
export async function runMacroTrendSweep(projectId: string, options: RunScanOptions = {}): Promise<RunScanResult> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("focal_question, refined_focal_question, industry, horizon")
    .eq("id", projectId)
    .single();
  if (projectError) throw projectError;

  const { data: existingSignals, error: signalsError } = await supabase.from("signals").select("title, category").eq("project_id", projectId);
  if (signalsError) throw signalsError;

  let output: z.infer<typeof MacroTrendSweepSchema>;
  try {
    output = await runStructured({
      step: "signals.macro_trend_sweep",
      projectId,
      taskPrompt: options.focus ? `${MACRO_TREND_SWEEP_TASK_PROMPT}\n\nFOCUS (this call only): ${options.focus}` : MACRO_TREND_SWEEP_TASK_PROMPT,
      input: {
        focal_question: project.refined_focal_question ?? project.focal_question,
        industry: project.industry,
        horizon: project.horizon,
        existing_signals: existingSignals.map((s) => ({ title: s.title, category: s.category })),
      },
      schema: MacroTrendSweepSchema,
      effort: "medium",
      webSearch: { maxUses: 5 },
      maxTokens: 6000,
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) throw new AIWebSearchError(err);
    throw err;
  }

  if (!output.sufficient_evidence || output.items.length === 0) {
    return { sufficientEvidence: false, gap: output.gap, suggestionsCreated: 0 };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("research_suggestions")
    .upsert(
      output.items.map((item) => ({
        project_id: projectId,
        step: "driving_forces" as const,
        title: item.title,
        body: item.body,
        category: item.category,
        citation_title: item.citation_title,
        citation_url: item.citation_url,
      })),
      { onConflict: "project_id,step,title", ignoreDuplicates: true }
    )
    .select("id");
  if (insertError) throw insertError;

  revalidatePath("/signals");
  return { sufficientEvidence: true, gap: null, suggestionsCreated: inserted.length };
}

export async function listResearchSuggestions(projectId: string, step: "key_forces" | "driving_forces"): Promise<ResearchSuggestionRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("research_suggestions")
    .select("*")
    .eq("project_id", projectId)
    .eq("step", step)
    .eq("status", "suggested")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

async function getOwnSuggestion(projectId: string, id: string): Promise<ResearchSuggestionRow> {
  const supabase = createClient();
  const { data, error } = await supabase.from("research_suggestions").select("*").eq("id", id).eq("project_id", projectId).maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError(`Research suggestion ${id} could not be found in project ${projectId}.`);
  return data;
}

export interface ConfirmResearchSuggestionResult {
  suggestion: ResearchSuggestionRow;
  signal?: SignalRow;
}

// Confirm-before-merge — the required UI step per SCHWARTZ_METHODOLOGY_SKILL.md before an
// external-research suggestion becomes real project data. Mirrors addNewsItemToSignals
// (ai-news-items.ts): idempotent re-click, and (for driving_forces) awaits scoring so the
// resulting signal is never left sitting unscored the way the fire-and-forget UI path would.
export async function confirmResearchSuggestion(projectId: string, id: string): Promise<ConfirmResearchSuggestionResult> {
  const supabase = createClient();
  const suggestion = await getOwnSuggestion(projectId, id);

  if (suggestion.status === "confirmed") {
    if (suggestion.confirmed_signal_id) {
      const { data: existing, error } = await supabase.from("signals").select("*").eq("id", suggestion.confirmed_signal_id).single();
      if (error) throw error;
      return { suggestion, signal: existing };
    }
    return { suggestion };
  }

  if (suggestion.step === "driving_forces") {
    const signal = await createSignal({
      projectId,
      category: suggestion.category ?? "Social",
      source: suggestion.citation_title ?? "External research",
      title: suggestion.title,
      body: suggestion.body,
      origin: "external_research",
    });
    await scoreOneSignal(projectId, signal.id);
    const { data: scoredSignal, error: scoredSignalError } = await supabase.from("signals").select("*").eq("id", signal.id).single();
    if (scoredSignalError) throw scoredSignalError;

    const { data: updatedSuggestion, error: updateError } = await supabase
      .from("research_suggestions")
      .update({ status: "confirmed", confirmed_signal_id: signal.id })
      .eq("id", id)
      .select()
      .single();
    if (updateError) throw updateError;

    revalidatePath("/signals");
    return { suggestion: updatedSuggestion, signal: scoredSignal };
  }

  // key_forces — create a sources row for provenance (same shape addNewsItemToSignals uses for
  // a promoted news item), then a single insights row, rather than routing back through
  // extractInsightsForProject: the scan call already produced the classified, cited candidate
  // directly, so re-extracting from its own summary would just be re-deriving what's already
  // known.
  const { data: insertedSource, error: sourceError } = await supabase
    .from("sources")
    .insert({
      project_id: projectId,
      name: suggestion.title,
      type: "external_research" as const,
      status: "complete" as const,
      storage_url: suggestion.citation_url,
      extracted_text: suggestion.body,
      uploaded_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    })
    .select("id")
    .single();
  if (sourceError) throw sourceError;

  const { data: insertedInsight, error: insightError } = await supabase
    .from("insights")
    .insert({
      project_id: projectId,
      source_id: insertedSource.id,
      text: suggestion.body,
      actor_type: suggestion.actor_type,
      category: "local_actor",
      confidence: "medium",
      source_type: "Web",
    })
    .select("id")
    .single();
  if (insightError) throw insightError;

  const { data: updatedSuggestion, error: updateError } = await supabase
    .from("research_suggestions")
    .update({ status: "confirmed", confirmed_insight_id: insertedInsight.id })
    .eq("id", id)
    .select()
    .single();
  if (updateError) throw updateError;

  revalidatePath("/knowledge");
  return { suggestion: updatedSuggestion };
}

export async function dismissResearchSuggestion(projectId: string, id: string): Promise<void> {
  const supabase = createClient();
  await getOwnSuggestion(projectId, id); // 404s if it's not this project's row
  const { error } = await supabase.from("research_suggestions").update({ status: "dismissed" }).eq("id", id).eq("project_id", projectId);
  if (error) throw error;
  revalidatePath("/knowledge");
  revalidatePath("/signals");
}
