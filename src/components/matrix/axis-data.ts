// Matrix axis helpers — ported verbatim from the handoff page-matrix.jsx.
// assessIndependence() (the old hashed pseudo-random "sync %" heuristic) has been removed —
// replaced by the real AI-backed checkAxisIndependence (src/lib/actions/ai-matrix.ts).
import type { Signal } from "@/lib/types";

// Every real signal already carries its own two-sided framing (poleA/poleB, e.g. "Tariffs
// soften"/"Tariffs bite harder") — the axis's pos/neg are just that, never a generic "High"/
// "Low" stand-in. (Used to fall back to a hardcoded demo table keyed to old seed signal ids,
// which meant every real project's axis silently got fake pole labels.)
export function axisMeta(sig?: Signal): { axis: string; pos: string; neg: string } {
  if (!sig) return { axis: "—", pos: "High", neg: "Low" };
  return { axis: sig.title, pos: sig.poleB, neg: sig.poleA };
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
