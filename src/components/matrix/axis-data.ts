// Matrix axis helpers — ported verbatim from the handoff page-matrix.jsx.
// assessIndependence() (the old hashed pseudo-random "sync %" heuristic) has been removed —
// replaced by the real AI-backed checkAxisIndependence (src/lib/actions/ai-matrix.ts).
import type { Signal } from "@/lib/types";

// Per-signal axis metadata: short axis name + the two poles.
export const SIGNAL_AXIS: Record<string, { axis: string; pos: string; neg: string }> = {
  sg1: { axis: "Carbon Policy", pos: "Strict", neg: "Lax" },
  sg2: { axis: "AI Adoption", pos: "Fast", neg: "Slow" },
  sg3: { axis: "Talent Values", pos: "Purpose", neg: "Pay" },
  sg4: { axis: "Geopolitical Alignment", pos: "Aligned", neg: "Decoupled" },
  sg5: { axis: "Consumer Growth", pos: "High", neg: "Low" },
  sg6: { axis: "Climate Risk", pos: "Severe", neg: "Mild" },
  sg7: { axis: "Channel Shift", pos: "Mobile", neg: "Web" },
  sg8: { axis: "Market Openness", pos: "Open", neg: "Closed" },
  sg9: { axis: "FX Stability", pos: "Stable", neg: "Volatile" },
};

export function axisMeta(sig?: Signal): { axis: string; pos: string; neg: string } {
  if (!sig) return { axis: "—", pos: "High", neg: "Low" };
  return (
    SIGNAL_AXIS[sig.id] || {
      axis: (sig.title || "").split(" ").slice(0, 2).join(" "),
      pos: "High",
      neg: "Low",
    }
  );
}

export const SCENARIO_NAME_POOL = [
  "Pacific Connector", "Fragmented Frontier", "Walled Gardens", "Bamboo Curtain",
  "Open Horizons", "Sovereign Silos", "Tidal Shift", "Monsoon Markets",
  "Archipelago", "Crosscurrents", "Safe Harbor", "Riptide",
  "High Tide", "Trade Winds", "Storm Front", "Calm Waters",
];

export function pickNames(seedStr: string, count: number): string[] {
  // Deterministic shuffle of the pool seeded by string; return first `count`.
  let h = seedStr.split("").reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0);
  const rand = () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return h / 0x7fffffff;
  };
  const pool = [...SCENARIO_NAME_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
