// Matrix axis helpers — ported verbatim from the handoff page-matrix.jsx.
import type { Signal } from "@/lib/types";

export type AssessState = "independent" | "correlated" | "uncertain";
export interface AssessResult {
  state: AssessState;
  rationale: string[];
}

// Heuristic orthogonality check between two axis signals.
export function assessIndependence(signals: Signal[], library: Signal[]): AssessResult | null {
  if (!signals || signals.length !== 2) return null;
  const [a, b] = signals;
  const countInCat = (cat: string) => (library || []).filter((s) => s.category === cat).length;
  const aCount = countInCat(a.category);
  const bCount = countInCat(b.category);

  // Stable pseudo "sync %" derived from the pair (demo heuristic).
  const seed = (a.id + "|" + b.id)
    .split("")
    .reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
  const syncPct = 55 + (Math.abs(seed) % 30); // 55–84%

  // STATE 3 — not enough evidence in one of the categories.
  if (aCount < 2 || bCount < 2) {
    const thinCat = aCount <= bCount ? a.category : b.category;
    const thinN = Math.min(aCount, bCount);
    return {
      state: "uncertain",
      rationale: [
        `Only ${thinN} signal${thinN === 1 ? "" : "s"} available in the ${thinCat} category.`,
        "Add more signals related to both axes to improve this check.",
      ],
    };
  }

  // STATE 2 — shared primary STEEP driver ⇒ likely correlated.
  if (a.category === b.category) {
    return {
      state: "correlated",
      rationale: [
        `Both axes rely heavily on signals from the ${a.category} category.`,
        `Historical signals show these forces moving in sync ${syncPct}% of the time.`,
      ],
    };
  }

  // STATE 1 — independent.
  return {
    state: "independent",
    rationale: [
      `Axes draw on different STEEP categories (${a.category} vs ${b.category}).`,
      "No shared primary drivers detected in the available signals.",
    ],
  };
}

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
