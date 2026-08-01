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

// Margin (percent) kept clear at every edge of the plot's 0-100 coordinate space so a dot
// never renders flush against the border — otherwise its "Axis" label or hover tooltip (both
// anchored relative to the dot itself) gets clipped by the plot's own overflow-hidden (needed
// to clip the quadrant-background divs to the box's rounded corners). Used by impactToY/
// yToImpact below, by resolveDotCollisions' clamp, and reused as-is by page-matrix.tsx's drag
// clamp so a manually-dragged dot can't be parked at the raw edge either.
export const DOT_MARGIN = 6;

// Impact (1-5) -> y (DOT_MARGIN..100-DOT_MARGIN, inverted since y=0 is the top of the CSS
// box). Exact inverse of yToImpact below, so a never-dragged dot round-trips losslessly.
// Impact 4-5 land in the top half (y<50, matching the existing client dotState() quadrant
// test); impact 1-3 land bottom.
export function impactToY(impact: number): number {
  return DOT_MARGIN + ((5 - impact) / 4) * (100 - 2 * DOT_MARGIN);
}
export function yToImpact(y: number): number {
  const clamped = Math.max(DOT_MARGIN, Math.min(100 - DOT_MARGIN, y));
  return Math.max(1, Math.min(5, Math.round(5 - ((clamped - DOT_MARGIN) / (100 - 2 * DOT_MARGIN)) * 4)));
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

// Minimum center-to-center distance (in the 0-100 coordinate space matrix_dots persists)
// below which two dots are considered overlapping. Derived from the dot's actual rendered
// size — 36px (h-9 w-9 in page-matrix.tsx) + ~6px padding — against the plot's one fixed
// dimension, h-matrix = 460px (tailwind.config.ts): 42/460 ≈ 9.1%, rounded to 9. The plot's
// width is fluid (a `1fr` grid column, no fixed px), so there's no equally precise x-axis
// conversion available in a server action with no DOM access — applying this same normalized
// threshold to both axes via Euclidean distance is a deliberate simplification, not a bug.
export const MIN_DOT_DISTANCE = 9;

// Simple deterministic string hash (not cryptographic) — used only to pick a stable fallback
// push direction when two dots start out exactly coincident (the common case: impact x
// uncertainty only has 15 distinct grid cells, so identically-scored signals collide exactly).
// Never Math.random() — same signal ids must always resolve to the same layout.
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Collision-resolution pass for freshly auto-placed dots (§7's "rank forces" plot). Only
// `newDots` are moved; `fixedDots` — every already-persisted position, including ones a user
// has manually dragged — are treated as immovable obstacles, so this never fights a position
// the user already touched. Deterministic: same inputs (ids + starting positions) always
// produce the same output, run to run.
export function resolveDotCollisions(
  newDots: { id: string; x: number; y: number }[],
  fixedDots: { x: number; y: number }[]
): Map<string, { x: number; y: number }> {
  const positions = new Map(newDots.map((d) => [d.id, { x: d.x, y: d.y }]));
  const orderedIds = newDots.map((d) => d.id).sort();
  const MAX_PASSES = 6;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let moved = false;
    for (const id of orderedIds) {
      const p = positions.get(id)!;
      const obstacles = [...fixedDots, ...orderedIds.filter((o) => o !== id).map((o) => positions.get(o)!)];
      for (const o of obstacles) {
        let dx = p.x - o.x;
        let dy = p.y - o.y;
        let dist = Math.hypot(dx, dy);
        if (dist >= MIN_DOT_DISTANCE) continue;
        moved = true;
        if (dist < 1e-6) {
          // Exact coincidence — no direction to push along, so fall back to a stable
          // hash-derived angle instead of leaving the dot in place or picking randomly.
          const angle = (hashString(id) % 360) * (Math.PI / 180);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          dist = 1;
        }
        const push = (MIN_DOT_DISTANCE - dist) / dist;
        p.x = Math.max(DOT_MARGIN, Math.min(100 - DOT_MARGIN, p.x + dx * push));
        p.y = Math.max(DOT_MARGIN, Math.min(100 - DOT_MARGIN, p.y + dy * push));
      }
      positions.set(id, p);
    }
    if (!moved) break;
  }

  return positions;
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
