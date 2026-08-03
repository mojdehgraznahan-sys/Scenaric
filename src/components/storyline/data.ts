// Storyline — causal-chain UI types + layout/style constants. Node/edge data itself is real
// (storyline_nodes/storyline_edges via story-adapter.ts) — this file no longer holds any mock
// dataset.
import type { SteepCategory, Quadrant } from "@/lib/types";

export interface StoryPhase {
  id: string;
  range: string;
  desc: string;
}
export interface StoryNode {
  id: string;
  phase: string;
  // Nullable: the one signal-less "realized" capstone node a chain may have has no STEEP
  // category of its own (it restates the scenario itself, not a signal).
  cat: SteepCategory | null;
  title: string;
  body: string;
  year: string;
  strength?: number;
  source?: string;
  uncertainty?: "High" | "Medium" | "Low";
  impact?: number;
  // The real signals.id this node is grounded in — null only for the "realized" capstone
  // node. Lets the UI link a card back to its originating signal.
  signalId?: string | null;
}
export interface StoryEdge {
  // Real storyline_edges.id once persisted — undefined only for the brief window between an
  // optimistic local edge and its createStorylineEdge() response landing.
  id?: string;
  from: string;
  to: string;
  relationship: string;
  confidence: string;
}

export const CAT_STYLE: Record<SteepCategory, { bg: string; fg: string; dot: string }> = {
  Social: { bg: "#F5F3FF", fg: "#8B5CF6", dot: "#8B5CF6" },
  Technology: { bg: "#EFF6FF", fg: "#3B82F6", dot: "#3B82F6" },
  Economic: { bg: "#ECFDF5", fg: "#10B981", dot: "#10B981" },
  Ecological: { bg: "#F0FDFA", fg: "#14B8A6", dot: "#14B8A6" },
  Political: { bg: "#FEF2F2", fg: "#EF4444", dot: "#EF4444" },
};

// Auto-layout constants — match spec.
export const CARD_W = 260;
export const COL_GAP = 80;
export const ROW_GAP = 24;
export const COL_PITCH = CARD_W + COL_GAP; // 340

export const DEFAULT_COLUMN_LABELS = [
  "Precursors",
  "Catalysts",
  "First-order effects",
  "Second-order",
  "Scenario realized",
];

export const RELATIONSHIPS = ["Leads to", "Amplifies", "Blocks", "Enables"];
export const CONFIDENCES = ["Strong", "Moderate", "Weak"];

export const edgeKey = (e: { from: string; to: string }) => e.from + ">" + e.to;

export const QUADRANT_LABELS: Record<Quadrant, string> = {
  TL: "Predetermined",
  TR: "Critical",
  BL: "Background",
  BR: "Wildcards",
};
