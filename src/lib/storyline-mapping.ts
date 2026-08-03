// Plain (non-"use server") module: storyline phase constants + causality helper, shared by
// src/lib/actions/storyline.ts (manual CRUD) and ai-storyline.ts (auto-suggest/find-signal).
// Kept out of both — a "use server" file may only export async Server Actions, so these
// plain constants/functions can't live (or be re-exported) in either directly. Same reason
// matrix-mapping.ts exists separately from matrix.ts/ai-matrix.ts.

export const PHASES = ["precursors", "catalysts", "first_order", "second_order", "realized"] as const;
export type Phase = (typeof PHASES)[number];

export const PHASE_ORDER: Record<Phase, number> = {
  precursors: 0,
  catalysts: 1,
  first_order: 2,
  second_order: 3,
  realized: 4,
};

// One-directional causality (§9 of the Backend Build Plan; SCHWARTZ_METHODOLOGY_SKILL.md's
// "Storyline causal ordering is one-directional" hard constraint): an edge may only point
// from a node's phase to the same or a later phase, never backward. Single source of truth
// for this rule — used both to silently filter a bulk AI-generated chain and to reject a
// single manual edge creation/update.
export function isPhaseOrderValid(fromPhase: Phase, toPhase: Phase): boolean {
  return PHASE_ORDER[toPhase] >= PHASE_ORDER[fromPhase];
}
