"use server";

// Matrix backend — Step 4, Rank forces (§7, per design/handoff/2026-07-30/scenaric.pdf).
// Two AI calls: checkAxisIndependence (replaces the client-side assessIndependence() stub —
// a hashed pseudo-random "sync %" — with a real grounded judgment) and classifyMatrixBuckets
// (assigns each signal's Schwartz zone, persisted to matrix_dots.bucket — never recomputed
// client-side, since Wildcard membership is a content judgment, not a pure function of
// impact/uncertainty). Same runStructured pattern as ai-signals.ts/ai-insights.ts throughout.
import { z } from "zod";
import { runStructured, AIGenerationFailedError } from "@/lib/ai/client";
import { createClient } from "@/lib/supabase/server";
import { assertAxisCandidates } from "./matrix";
import type { SteepCategory } from "./signals";
import type { MatrixBucket, Uncertainty } from "@/lib/matrix-mapping";

const IndependenceSchema = z.object({
  state: z.enum(["independent", "correlated", "uncertain"]),
  rationale: z.array(z.string()).min(1).max(3),
});

const INDEPENDENCE_TASK_PROMPT = `Task: Assess whether two candidate scenario axes resolve independently
of one another. Schwartz's method requires the two axes to be able to
combine into all 4 plausible quadrants — correlated axes collapse the
matrix to effectively 2 scenarios, which is a methodology violation.

Input: { axis_a: {title, body, category}, axis_b: {title, body, category},
         library_signals: [{title, category}] /* full signal library for context */ }

Decision procedure (must follow, do not skip steps):
1. If axis_a and axis_b share a common underlying causal driver (one's
   outcome mechanically constrains the other's), return "correlated"
   and name the shared driver in rationale.
2. Else if the library contains fewer than 2 supporting signals for
   either axis's category, return "uncertain" — there isn't enough
   evidence in this project to judge independence either way. Do not
   guess in this case.
3. Else return "independent".

Every rationale bullet must reference axis_a/axis_b's actual content or
a named library signal — never a generic statement like "these seem
different."

Output schema:
{ state: "independent"|"correlated"|"uncertain",
  rationale: string[] /* 1-3 bullets, each grounded */ }`;

export interface IndependenceResult {
  state: "independent" | "correlated" | "uncertain";
  rationale: string[];
}

export async function checkAxisIndependence(input: {
  projectId: string;
  axisASignalId: string;
  axisBSignalId: string;
}): Promise<IndependenceResult> {
  const supabase = createClient();

  const { data: signals, error } = await supabase
    .from("signals")
    .select("id, title, body, category")
    .eq("project_id", input.projectId);
  if (error) throw error;

  const axisA = signals.find((s) => s.id === input.axisASignalId);
  const axisB = signals.find((s) => s.id === input.axisBSignalId);
  if (!axisA || !axisB) throw new Error("Axis signal not found in this project");

  // Reject before spending a model call on an already-invalid request.
  await assertAxisCandidates(input.projectId, [input.axisASignalId, input.axisBSignalId]);

  const output = await runStructured({
    step: "matrix.independence_check",
    projectId: input.projectId,
    taskPrompt: INDEPENDENCE_TASK_PROMPT,
    input: {
      axis_a: { title: axisA.title, body: axisA.body, category: axisA.category },
      axis_b: { title: axisB.title, body: axisB.body, category: axisB.category },
      library_signals: signals.map((s) => ({ title: s.title, category: s.category })),
    },
    schema: IndependenceSchema,
    effort: "medium",
  });

  return output;
}

const BucketClassificationSchema = z.object({
  bucket: z.enum(["critical_uncertainty", "predetermined", "background", "wildcard"]),
  rationale: z.string(),
});

// Adapted from §7's verbatim prompt: the spec's input schema shows `is_discrete_shock_
// candidate` as a pre-computed "heuristic pre-check" boolean. Deliberately not building a
// separate keyword-based heuristic for that — what counts as "shock" language needs real
// reading comprehension, not a keyword list — so this single call evaluates shock-candidacy
// itself as the literal first step of the same decision procedure, rather than requiring an
// upstream pre-call. One AI call per signal either way.
const BUCKET_CLASSIFICATION_TASK_PROMPT = `Task: Assign ONE signal to exactly one of Schwartz's four rank-forces
buckets, given its already-scored impact and uncertainty.

Input: { signal: {title, body, category, impact(1-5), uncertainty(Low/Med/High)} }

Decision procedure (apply literally, in order):
1. First, judge for yourself whether this signal describes a discrete,
   low-probability, high-consequence SHOCK (a sudden event — e.g. a facility
   fire, an export ban, a sudden leadership death) rather than a continuous
   trend. If it is such a shock candidate AND impact >= 4, return "wildcard"
   — regardless of the uncertainty value. Wildcards are never eligible as
   scenario axes.
2. Else if impact >= 4 AND uncertainty == "High", return "critical_uncertainty".
3. Else if impact >= 4 AND uncertainty == "Low", return "predetermined" — this
   signal must appear as a constant across all 4 future scenarios, never as
   an axis.
4. Else return "background".

Output schema:
{ bucket: "critical_uncertainty"|"predetermined"|"background"|"wildcard",
  rationale: string /* one sentence, cites impact/uncertainty values and,
  for wildcard, the shock mechanism */ }`;

interface ClassifiableSignal {
  id: string;
  title: string;
  body: string;
  category: SteepCategory;
  impact: number;
  uncertainty: Uncertainty;
}

// Shared by classifyMatrixBuckets (batch) and reclassifySignal (below, single-item reclassify
// after a manual drag). Always UPDATEs an existing matrix_dots row — never inserts — so it's
// only ever called on a signal that already has a positioned dot, which both call sites
// guarantee (getMatrixData's auto-position runs first in store.tsx's refresh order; a drag
// only ever targets an already-rendered, already-positioned dot).
async function classifySignalBucket(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  signal: ClassifiableSignal
): Promise<{ bucket: MatrixBucket; rationale: string }> {
  const output = await runStructured({
    step: "matrix.classify_bucket",
    projectId,
    taskPrompt: BUCKET_CLASSIFICATION_TASK_PROMPT,
    input: {
      signal: { title: signal.title, body: signal.body, category: signal.category, impact: signal.impact, uncertainty: signal.uncertainty },
    },
    schema: BucketClassificationSchema,
    effort: "low",
  });

  const { error } = await supabase
    .from("matrix_dots")
    .update({ bucket: output.bucket, bucket_rationale: output.rationale })
    .eq("project_id", projectId)
    .eq("signal_id", signal.id);
  if (error) throw error;

  return output;
}

export interface ClassifyMatrixBucketsResult {
  classified: number;
  failures: { signalId: string; title: string }[];
}

// POST .../matrix/classify — batch-assigns bucket to every scored-but-unbucketed signal that
// already has a positioned matrix_dots row. Called from store.tsx's refreshMatrixData, after
// getMatrixData has had a chance to auto-position any newly-scored signal.
export async function classifyMatrixBuckets(projectId: string): Promise<ClassifyMatrixBucketsResult> {
  const supabase = createClient();

  const { data: unbucketedDots, error: dotsError } = await supabase
    .from("matrix_dots")
    .select("signal_id")
    .eq("project_id", projectId)
    .is("bucket", null);
  if (dotsError) throw dotsError;

  const result: ClassifyMatrixBucketsResult = { classified: 0, failures: [] };
  if (unbucketedDots.length === 0) return result;

  const { data: signals, error: signalsError } = await supabase
    .from("signals")
    .select("id, title, body, category, impact, uncertainty")
    .in(
      "id",
      unbucketedDots.map((d) => d.signal_id)
    );
  if (signalsError) throw signalsError;

  const scored = signals.filter((s): s is ClassifiableSignal => s.impact != null && s.uncertainty != null);

  for (const signal of scored) {
    try {
      await classifySignalBucket(supabase, projectId, signal);
      result.classified += 1;
    } catch (err) {
      if (err instanceof AIGenerationFailedError) {
        result.failures.push({ signalId: signal.id, title: signal.title });
      } else {
        throw err;
      }
    }
  }

  return result;
}

// Single-signal reclassify, called from store.tsx right after updateMatrixDotPosition
// (matrix.ts) persists a manual drag — that action clears the now-stale bucket to null but
// deliberately doesn't call back into this file itself (matrix.ts stays a plain-CRUD leaf
// module with no dependency on ai-matrix.ts, avoiding a circular import between the two
// "use server" files). Fetches the signal itself rather than trusting a caller-supplied
// title/body/category, so it can't be handed stale data.
export async function reclassifySignal(projectId: string, signalId: string): Promise<{ bucket: MatrixBucket; rationale: string }> {
  const supabase = createClient();

  const { data: signal, error } = await supabase
    .from("signals")
    .select("id, title, body, category, impact, uncertainty")
    .eq("id", signalId)
    .single();
  if (error) throw error;
  if (signal.impact == null || signal.uncertainty == null) {
    throw new Error("Cannot classify a signal with no impact/uncertainty score");
  }

  return classifySignalBucket(supabase, projectId, {
    id: signal.id,
    title: signal.title,
    body: signal.body,
    category: signal.category,
    impact: signal.impact,
    uncertainty: signal.uncertainty,
  });
}
