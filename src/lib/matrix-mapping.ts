// Plain (non-"use server") module: impact/uncertainty <-> matrix x/y position helpers,
// shared by src/lib/actions/matrix.ts. Kept out of that file because a "use server" file
// may only export async Server Actions — no plain constants or sync functions.
import type { SteepCategory } from "./actions/signals";

export type Uncertainty = "Low" | "Medium" | "High";

export const CATEGORY_COLOR: Record<SteepCategory, string> = {
  Social: "#8B5CF6",
  Technology: "#3B82F6",
  Economic: "#10B981",
  Ecological: "#14B8A6",
  Political: "#EF4444",
};

export const UNCERTAINTY_WEIGHT: Record<Uncertainty, number> = { Low: 1, Medium: 2, High: 3 };

export function deriveLabel(title: string): string {
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 3);
  return (words[0][0] + words[1][0]).toUpperCase();
}

// Impact (1-5) -> y (0-100, inverted since y=0 is the top of the CSS box). Exact inverse of
// yToImpact below, so a never-dragged dot round-trips losslessly. Impact 4-5 land in the top
// half (y<50, matching the existing client dotState() quadrant test); impact 1-3 land bottom.
export function impactToY(impact: number): number {
  return ((5 - impact) / 4) * 100;
}
export function yToImpact(y: number): number {
  return Math.max(1, Math.min(5, Math.round(5 - (y / 100) * 4)));
}

// Uncertainty (3 discrete levels) -> x (0-100), even thirds: Low 0-33, Medium 34-66,
// High 67-100 — forward mapping uses each band's midpoint; reverse mapping uses the exact
// band edges. Bucket membership (below) is a separate, explicit rule over impact/uncertainty
// directly — NOT derived from which half of the matrix x happens to land in, since the
// Medium band straddles the visual 50% split.
export function uncertaintyToX(uncertainty: Uncertainty): number {
  return { Low: 16.5, Medium: 50, High: 83.5 }[uncertainty];
}
export function xToUncertainty(x: number): Uncertainty {
  if (x <= 33) return "Low";
  if (x <= 66) return "Medium";
  return "High";
}

// Schwartz's four ranking zones (§7 of the backend build plan). Deliberately NOT a pure
// function of (impact, uncertainty) — Wildcard membership depends on whether the signal
// describes a discrete, low-probability, high-consequence shock, which is a real content
// judgment a formula can't make. Bucket is AI-classified (src/lib/actions/ai-matrix.ts's
// classifyMatrixBuckets) and persisted to matrix_dots.bucket — read from there, never
// recomputed client-side. This type is kept here (not in ai-matrix.ts) since it's shared by
// both server actions and client components, and a "use server" file may only export async
// functions.
export type MatrixBucket = "critical_uncertainty" | "predetermined" | "background" | "wildcard";
