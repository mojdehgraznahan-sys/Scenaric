"use server";

// Matrix backend — Step 4, Rank forces (§7, per design/handoff/2026-07-30/scenaric.pdf).
// Plain CRUD/deterministic logic only; the AI calls for this step (orthogonality check,
// bucket classification) live in ./ai-matrix.ts, matching the signals.ts / ai-signals.ts
// split already used for the Signals Library — kept as a one-directional dependency
// (ai-matrix.ts imports from here, never the reverse) to avoid a circular import between the
// two "use server" files. Impact/uncertainty <-> x/y mapping lives in ../matrix-mapping.ts: a
// "use server" file may only export async Server Actions, so the pure helpers can't live (or
// be re-exported) here.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { SteepCategory } from "./signals";
import {
  CATEGORY_COLOR,
  UNCERTAINTY_WEIGHT,
  deriveLabel,
  impactToY,
  yToImpact,
  uncertaintyToX,
  xToUncertainty,
  type Uncertainty,
  type MatrixBucket,
} from "../matrix-mapping";

type SupabaseClient = ReturnType<typeof createClient>;
type SignalRow = Database["public"]["Tables"]["signals"]["Row"];
type DotRow = Database["public"]["Tables"]["matrix_dots"]["Row"];

export interface MatrixDotData {
  signalId: string;
  x: number;
  y: number;
  impact: number;
  uncertainty: Uncertainty;
  aiImpact: number | null;
  aiUncertainty: Uncertainty | null;
  userImpact: number | null;
  userUncertainty: Uncertainty | null;
  // Null until classifyMatrixBuckets (ai-matrix.ts) has run for this signal — a real,
  // honestly-represented intermediate state now that classification is its own AI step,
  // separate from scoring/positioning. getMatrixBuckets/getAxisCandidates only surface
  // already-classified signals in their bucket groups.
  bucket: MatrixBucket | null;
  bucketRationale: string | null;
  signal: { title: string; body: string; category: SteepCategory; source: string };
  label: string;
  color: string;
}

// Shared by getMatrixData and getMatrixBuckets: fetches every scored signal (effective
// impact+uncertainty both non-null) together with its matrix_dots row, creating a
// default-positioned dot for any scored signal that doesn't have one yet (e.g. just scored
// for the first time) without ever clobbering an existing — possibly dragged — position.
// Bucket is read directly from the persisted column, never recomputed here.
async function fetchScoredSignalsWithDots(supabase: SupabaseClient, projectId: string): Promise<MatrixDotData[]> {
  const { data: signals, error: signalsError } = await supabase
    .from("signals")
    .select("id, title, body, category, source, impact, uncertainty, ai_impact, ai_uncertainty, user_impact, user_uncertainty")
    .eq("project_id", projectId);
  if (signalsError) throw signalsError;

  const scored = signals.filter((s): s is SignalRow & { impact: number; uncertainty: Uncertainty } => s.impact != null && s.uncertainty != null);

  const { data: existingDots, error: dotsError } = await supabase
    .from("matrix_dots")
    .select("id, signal_id, x, y, is_critical_axis, bucket, bucket_rationale, project_id, created_at")
    .eq("project_id", projectId);
  if (dotsError) throw dotsError;

  const dotBySignalId = new Map<string, DotRow>(existingDots.map((d) => [d.signal_id, d]));

  const missing = scored.filter((s) => !dotBySignalId.has(s.id));
  if (missing.length > 0) {
    const { error: upsertError } = await supabase.from("matrix_dots").upsert(
      missing.map((s) => ({
        project_id: projectId,
        signal_id: s.id,
        x: uncertaintyToX(s.uncertainty),
        y: impactToY(s.impact),
      })),
      { onConflict: "project_id,signal_id", ignoreDuplicates: true }
    );
    if (upsertError) throw upsertError;

    const { data: refreshed, error: refreshedError } = await supabase
      .from("matrix_dots")
      .select("id, signal_id, x, y, is_critical_axis, bucket, bucket_rationale, project_id, created_at")
      .eq("project_id", projectId);
    if (refreshedError) throw refreshedError;
    for (const d of refreshed) dotBySignalId.set(d.signal_id, d);
  }

  return scored.map((s) => {
    const dot = dotBySignalId.get(s.id)!;
    return {
      signalId: s.id,
      x: dot.x,
      y: dot.y,
      impact: s.impact,
      uncertainty: s.uncertainty,
      aiImpact: s.ai_impact,
      aiUncertainty: s.ai_uncertainty,
      userImpact: s.user_impact,
      userUncertainty: s.user_uncertainty,
      bucket: dot.bucket,
      bucketRationale: dot.bucket_rationale,
      signal: { title: s.title, body: s.body, category: s.category, source: s.source },
      label: deriveLabel(s.title),
      color: CATEGORY_COLOR[s.category],
    };
  });
}

export interface MatrixData {
  dots: MatrixDotData[];
  pendingScoringCount: number;
  pendingScoringIds: string[];
}

export async function getMatrixData(projectId: string): Promise<MatrixData> {
  const supabase = createClient();
  const dots = await fetchScoredSignalsWithDots(supabase, projectId);

  const { data: allSignals, error } = await supabase
    .from("signals")
    .select("id, impact, uncertainty")
    .eq("project_id", projectId);
  if (error) throw error;

  const unscored = allSignals.filter((s) => s.impact == null || s.uncertainty == null);

  return {
    dots,
    pendingScoringCount: unscored.length,
    pendingScoringIds: unscored.map((s) => s.id),
  };
}

export interface MatrixBucketGroups {
  critical_uncertainty: MatrixDotData[];
  predetermined: MatrixDotData[];
  background: MatrixDotData[];
  wildcard: MatrixDotData[];
  // Scored + positioned, but classifyMatrixBuckets hasn't assigned a bucket yet — distinct
  // from MatrixData's pendingScoringIds (which is "not even scored"), a state that couldn't
  // exist before classification became its own separate AI step.
  pendingClassificationIds: string[];
}

// GET .../matrix/buckets — pure read, no classification side effect (that's
// classifyMatrixBuckets's job, ai-matrix.ts, kept separate per the spec's own POST/GET
// split). critical_uncertainty feeds the axis picker (see getAxisCandidates below);
// predetermined/background/wildcard are the separate rails.
export async function getMatrixBuckets(projectId: string): Promise<MatrixBucketGroups> {
  const supabase = createClient();
  const dots = await fetchScoredSignalsWithDots(supabase, projectId);

  const groups: MatrixBucketGroups = {
    critical_uncertainty: [],
    predetermined: [],
    background: [],
    wildcard: [],
    pendingClassificationIds: [],
  };

  for (const d of dots) {
    if (d.bucket == null) {
      groups.pendingClassificationIds.push(d.signalId);
      continue;
    }
    groups[d.bucket].push(d);
  }

  // impact * uncertainty_weight descending — same ranking as before the bucket persistence
  // change, just now over the persisted bucket group instead of a live-filtered list.
  groups.critical_uncertainty.sort((a, b) => {
    const rank = b.impact * UNCERTAINTY_WEIGHT[b.uncertainty] - a.impact * UNCERTAINTY_WEIGHT[a.uncertainty];
    if (rank !== 0) return rank;
    return a.signal.title.localeCompare(b.signal.title);
  });

  return groups;
}

// POST .../matrix/axis-candidates, folded into getMatrixBuckets per this task's own "keep
// that endpoint working or fold it into this one, your call" — every existing caller
// (assertAxisCandidates, build-scenarios-modal.tsx's candidate picker) only needs this array,
// so their call sites don't change.
export async function getAxisCandidates(projectId: string): Promise<MatrixDotData[]> {
  return (await getMatrixBuckets(projectId)).critical_uncertainty;
}

export interface UpdateMatrixDotResult {
  x: number;
  y: number;
  impact: number;
  uncertainty: Uncertainty;
}

// Persists a manual drag. Bucket can no longer be computed here — Wildcard membership depends
// on the signal's content (a real judgment, not a threshold), which a drag can't determine —
// so this clears the now-stale bucket to null and returns without one; the caller
// (store.tsx's wrapper) immediately follows up with ai-matrix.ts's reclassifySignal. Kept as
// two separate calls rather than one, so this file stays a plain-CRUD leaf module with no
// dependency on ai-matrix.ts (avoids a circular import between the two "use server" files).
export async function updateMatrixDotPosition(projectId: string, signalId: string, x: number, y: number): Promise<UpdateMatrixDotResult> {
  const supabase = createClient();
  const clampedX = Math.max(0, Math.min(100, x));
  const clampedY = Math.max(0, Math.min(100, y));
  const impact = yToImpact(clampedY);
  const uncertainty = xToUncertainty(clampedX);

  const { error: dotError } = await supabase.from("matrix_dots").upsert(
    { project_id: projectId, signal_id: signalId, x: clampedX, y: clampedY, bucket: null, bucket_rationale: null },
    { onConflict: "project_id,signal_id" }
  );
  if (dotError) throw dotError;

  const { error: signalError } = await supabase
    .from("signals")
    .update({ user_impact: impact, user_uncertainty: uncertainty, impact, uncertainty })
    .eq("id", signalId);
  if (signalError) throw signalError;

  revalidatePath("/matrix");
  return { x: clampedX, y: clampedY, impact, uncertainty };
}

// Server-side boundary for axis selection — the client (page-matrix.tsx, build-scenarios-
// modal.tsx) already only lets a user pick a critical_uncertainty dot as an axis, but that's
// a UI convenience, not a guarantee. Reuses getAxisCandidates itself as the single source of
// truth for "what's a valid axis candidate" rather than re-deriving the bucket check a third
// time. Called by checkAxisIndependence and buildScenarios before either does real work.
export async function assertAxisCandidates(projectId: string, signalIds: string[]): Promise<void> {
  const candidates = await getAxisCandidates(projectId);
  const candidateIds = new Set(candidates.map((c) => c.signalId));
  const invalid = signalIds.filter((id) => !candidateIds.has(id));
  if (invalid.length > 0) {
    throw new Error(
      `Axis selection rejected: signal(s) ${invalid.join(", ")} are not in the Critical Uncertainties bucket ` +
        `(impact >= 4, uncertainty High). Schwartz's method requires axes to come from the highest-impact/` +
        `highest-uncertainty forces only.`
    );
  }
}
