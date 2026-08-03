// Bridges the real backend shape (storyline_nodes/storyline_edges, src/lib/actions/storyline.ts)
// onto the existing canvas UI's StoryNode/StoryEdge (data.ts) — built for a different, mock
// dataset before this feature had a backend. Node/edge ids ARE the real row ids throughout
// (never re-minted), so a card's id can go straight into updateStorylineNode/deleteStorylineEdge
// etc. without any lookup table.
import type { Database } from "@/lib/supabase/types";
import type { Signal } from "@/lib/types";
import { PHASES, type Phase } from "@/lib/storyline-mapping";
import type { StoryNode, StoryEdge, StoryPhase } from "./data";

type StorylineNodeRow = Database["public"]["Tables"]["storyline_nodes"]["Row"];
type StorylineEdgeRow = Database["public"]["Tables"]["storyline_edges"]["Row"];

// Generic phase descriptions — the mock data's per-scenario date ranges ("Late 2026 – 2027")
// were invented; real per-node `year` already carries the actual date, shown on each card.
export const REAL_PHASES: StoryPhase[] = [
  { id: "precursors", range: "", desc: "Conditions already true today." },
  { id: "catalysts", range: "", desc: "Near-term triggering events." },
  { id: "first_order", range: "", desc: "Direct consequences emerge." },
  { id: "second_order", range: "", desc: "Compounding effects propagate." },
  { id: "realized", range: "", desc: "The scenario's end state." },
];

// Same Strong/Moderate/Weak → 0-1 weighting pieces.tsx already uses for edge confidence —
// reused here so a node's "strength" bar reads on the same scale. types.ts's Row typing for
// this column is a plain `string | null` (hand-written, not narrowed to the enum), so this is
// a lookup with a fallback rather than an exhaustive Record.
const STRENGTH_WEIGHT: Record<string, number> = {
  Strong: 1,
  Moderate: 0.65,
  Weak: 0.3,
};

export function toStoryNode(row: StorylineNodeRow, signal: Signal | undefined): StoryNode {
  return {
    id: row.id,
    phase: row.phase,
    cat: row.category,
    title: row.title,
    body: row.body || "",
    year: row.year != null ? String(row.year) : "—",
    strength: STRENGTH_WEIGHT[row.strength ?? ""] ?? 0.65,
    signalId: row.signal_id,
    // No real per-node source/impact/uncertainty — pulled from the originating signal when
    // this node is grounded in one (the "realized" capstone node has none, same graceful
    // defaults signal-card.tsx already falls back to).
    source: signal?.source,
    impact: signal?.impact ?? undefined,
    uncertainty: signal?.uncertainty ?? undefined,
  };
}

export function toStoryEdge(row: StorylineEdgeRow): StoryEdge {
  return {
    id: row.id,
    from: row.from_node_id,
    to: row.to_node_id,
    relationship: row.relationship,
    confidence: row.confidence,
  };
}

// UI phase id === backend Phase already (both use the real "precursors"/"catalysts"/...
// enum now — REAL_PHASES above replaces the old mock's abbreviated "prec"/"cat" ids), so
// persisting a drag-to-new-phase move just needs a narrowing cast back to the real type.
export function toBackendPhase(phaseId: string): Phase {
  return PHASES.includes(phaseId as Phase) ? (phaseId as Phase) : "precursors";
}
