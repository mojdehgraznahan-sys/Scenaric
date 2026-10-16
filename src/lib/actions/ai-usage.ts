"use server";

// GET /projects/:id/ai-usage — Settings page's Billing tab. Rolls up ai_runs' token columns
// (0051_ai_runs_token_usage.sql) for one project via project_ai_token_totals, then estimates
// $ cost client-side since the Anthropic API never returns cost directly.
import { createClient } from "@/lib/supabase/server";

// claude-sonnet-5 is the one model every runStructured() call uses (client.ts's MODEL) —
// no per-call model selection exists today, so a single fixed rate table is accurate for
// every row. Base input/output rates are Anthropic's published per-1M-token price; the cache
// write/read rates are the standard ephemeral-cache multipliers (1.25x / 0.1x of the base
// input rate) applied to every call here, since runStructured always caches its system
// preamble (client.ts's cache_control). Revisit this table if MODEL ever changes or a
// call site gets a per-call model override.
const SONNET_5_RATE_PER_MTOK = {
  input: 2.0,
  output: 10.0,
  cacheWrite: 2.5,
  cacheRead: 0.2,
};

export interface ProjectAiUsage {
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  estimatedCostUsd: number;
}

export async function getProjectAiUsage(projectId: string): Promise<ProjectAiUsage> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("project_ai_token_totals", { p_project_id: projectId }).single();
  if (error) throw error;

  const inputTokens = data.input_tokens;
  const outputTokens = data.output_tokens;
  const cacheCreationInputTokens = data.cache_creation_input_tokens;
  const cacheReadInputTokens = data.cache_read_input_tokens;

  const estimatedCostUsd =
    (inputTokens * SONNET_5_RATE_PER_MTOK.input +
      outputTokens * SONNET_5_RATE_PER_MTOK.output +
      cacheCreationInputTokens * SONNET_5_RATE_PER_MTOK.cacheWrite +
      cacheReadInputTokens * SONNET_5_RATE_PER_MTOK.cacheRead) /
    1_000_000;

  return {
    callCount: data.call_count,
    inputTokens,
    outputTokens,
    cacheCreationInputTokens,
    cacheReadInputTokens,
    estimatedCostUsd,
  };
}
