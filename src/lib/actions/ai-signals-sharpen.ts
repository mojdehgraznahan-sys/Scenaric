"use server";

// Signals "Ask AI" Group 2 "Sharpen" (SIGNALS_ASK_AI_PROMPTS.md) — closed-book, effort:"low",
// thinking:false, never webSearch (these step names are deliberately absent from
// ai/client.ts's RESEARCH_MODE_ALLOWED_STEPS, so the runtime guard blocks any accidental web
// call as a structural safety net). Pure read + reasoning over buildSignalsContext — no writes
// to signals/research_suggestions/signal_score_proposals. 2.1's own prompt text says "Do not
// modify anything — return recommendations only"; 2.2/2.3 imply mutating existing signals that
// may already be scored/matrix-placed/insight-linked, real design surface the spec doesn't
// address — advisory-only for v1 here too, rendered straight into the Ask AI drawer.
import { z } from "zod";
import { runStructured } from "@/lib/ai/client";
import { buildSignalsContext } from "./signals-context";

// ---- 2.1 "Is this a force or an event?" ----
const ForceOrEventItemSchema = z.object({
  signal_id: z.string(),
  title: z.string(),
  verdict: z.enum(["force", "event", "ambiguous"]),
  underlying_force: z.string().nullable(),
  merge_recommendation: z.string().nullable(),
});
const SharpenForceOrEventSchema = z.object({
  flags: z.array(ForceOrEventItemSchema),
});

const SHARPEN_FORCE_OR_EVENT_TASK_PROMPT = `Task: Review every given signal. A FORCE is a
persistent driver that can resolve in more than one direction over the horizon. An EVENT is a
single occurrence — usually evidence FOR a force, not a force itself.

Input: { horizon: string, signals: [{ id: string, title: string, body: string, category: string }] }

Rules:
- Flag every signal as "force", "event", or "ambiguous".
- For every "event", set underlying_force to the force it is evidence of (name it, even if that
  force isn't itself in the signal list), and merge_recommendation to a one-sentence proposal
  for folding it in as supporting evidence rather than leaving it standalone.
- For "force"/"ambiguous", leave underlying_force and merge_recommendation null.
- Cover every signal given — no omissions. Do not propose modifying anything beyond this
  classification — recommendations only.

Output schema:
{ flags: [{ signal_id: string, title: string, verdict: "force"|"event"|"ambiguous",
            underlying_force: string | null, merge_recommendation: string | null }] }`;

export interface SharpenForceOrEventResult {
  flags: {
    signalId: string;
    title: string;
    verdict: "force" | "event" | "ambiguous";
    underlyingForce: string | null;
    mergeRecommendation: string | null;
  }[];
}

export async function runSharpenForceOrEvent(projectId: string): Promise<SharpenForceOrEventResult> {
  const ctx = await buildSignalsContext(projectId);
  if (ctx.signals.length === 0) return { flags: [] };

  const output = await runStructured({
    step: "signals.sharpen.force_or_event",
    projectId,
    taskPrompt: SHARPEN_FORCE_OR_EVENT_TASK_PROMPT,
    input: { horizon: ctx.horizon, signals: ctx.signals.map((s) => ({ id: s.id, title: s.title, body: s.body, category: s.category })) },
    schema: SharpenForceOrEventSchema,
    effort: "low",
    maxTokens: 6000,
  });

  return {
    flags: output.flags.map((f) => ({
      signalId: f.signal_id,
      title: f.title,
      verdict: f.verdict,
      underlyingForce: f.underlying_force,
      mergeRecommendation: f.merge_recommendation,
    })),
  };
}

// ---- 2.2 "Split the compound signals" ----
const SplitHalfSchema = z.object({ title: z.string(), body: z.string() });
const SplitCompoundItemSchema = z.object({
  signal_id: z.string(),
  title: z.string(),
  halves: z.tuple([SplitHalfSchema, SplitHalfSchema]),
  independent: z.boolean(),
  rationale: z.string(),
});
const SharpenSplitCompoundSchema = z.object({
  splits: z.array(SplitCompoundItemSchema),
});

const SHARPEN_SPLIT_COMPOUND_TASK_PROMPT = `Task: Identify every given signal that bundles two
independently-resolving drivers (e.g. "regulatory and economic pressure") — these break the
axis-independence requirement scenario-building depends on later.

Input: { signals: [{ id: string, title: string, body: string, category: string }] }

Rules:
- Only include a signal if it genuinely contains 2+ independently-resolving drivers — do not
  force a split on a signal that's just broadly worded but actually one driver.
- \`halves\` proposes exactly 2 clean, separately-titled signals the original should become.
- \`independent\` is true only if the two halves can plausibly resolve in different directions
  from each other; false if they're correlated enough that splitting doesn't add real
  discriminating power — state which, and why, in \`rationale\`.

Output schema:
{ splits: [{ signal_id: string, title: string,
             halves: [{ title: string, body: string }, { title: string, body: string }],
             independent: boolean, rationale: string }] }`;

export interface SharpenSplitCompoundResult {
  splits: {
    signalId: string;
    title: string;
    halves: [{ title: string; body: string }, { title: string; body: string }];
    independent: boolean;
    rationale: string;
  }[];
}

export async function runSharpenSplitCompound(projectId: string): Promise<SharpenSplitCompoundResult> {
  const ctx = await buildSignalsContext(projectId);
  if (ctx.signals.length === 0) return { splits: [] };

  const output = await runStructured({
    step: "signals.sharpen.split_compound",
    projectId,
    taskPrompt: SHARPEN_SPLIT_COMPOUND_TASK_PROMPT,
    input: { signals: ctx.signals.map((s) => ({ id: s.id, title: s.title, body: s.body, category: s.category })) },
    schema: SharpenSplitCompoundSchema,
    effort: "low",
    maxTokens: 6000,
  });

  return {
    splits: output.splits.map((s) => ({
      signalId: s.signal_id,
      title: s.title,
      halves: s.halves,
      independent: s.independent,
      rationale: s.rationale,
    })),
  };
}

// ---- 2.3 "De-duplicate" ----
const DedupeClusterSchema = z.object({
  source_signal_ids: z.array(z.string()).min(2),
  source_titles: z.array(z.string()).min(2),
  merged_title: z.string(),
  merged_body: z.string(),
});
const SharpenDedupeSchema = z.object({
  clusters: z.array(DedupeClusterSchema),
});

const SHARPEN_DEDUPE_TASK_PROMPT = `Task: Compare all given signals SEMANTICALLY, not by string
match. Identify pairs or clusters describing the same underlying force in different vocabulary.

Input: { signals: [{ id: string, title: string, body: string, category: string }] }

Rules:
- Only cluster signals that describe the same underlying uncertainty — near-duplicate
  vocabulary/framing of one force, not merely the same STEEP category or loosely related
  topic.
- For each cluster, propose one merged signal (merged_title, merged_body) using the clearest
  wording among the sources — never inventing content not present in at least one source.
- source_signal_ids/source_titles list every signal the merge absorbs (2 or more).
- If nothing genuinely duplicates, return an empty clusters array — do not force a merge to
  look complete.

Output schema:
{ clusters: [{ source_signal_ids: string[], source_titles: string[],
               merged_title: string, merged_body: string }] }`;

export interface SharpenDedupeResult {
  clusters: {
    sourceSignalIds: string[];
    sourceTitles: string[];
    mergedTitle: string;
    mergedBody: string;
  }[];
}

export async function runSharpenDedupe(projectId: string): Promise<SharpenDedupeResult> {
  const ctx = await buildSignalsContext(projectId);
  if (ctx.signals.length === 0) return { clusters: [] };

  const output = await runStructured({
    step: "signals.sharpen.dedupe",
    projectId,
    taskPrompt: SHARPEN_DEDUPE_TASK_PROMPT,
    input: { signals: ctx.signals.map((s) => ({ id: s.id, title: s.title, body: s.body, category: s.category })) },
    schema: SharpenDedupeSchema,
    effort: "low",
    maxTokens: 6000,
  });

  return {
    clusters: output.clusters.map((c) => ({
      sourceSignalIds: c.source_signal_ids,
      sourceTitles: c.source_titles,
      mergedTitle: c.merged_title,
      mergedBody: c.merged_body,
    })),
  };
}
