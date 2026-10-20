// Futures + Event chains (design/futures_chains_handoff/) — pure helpers ported from the
// standalone's bc-data.js/bc2-data.js. Deliberately NOT a 1:1 port: the standalone stores event
// timing as a `t` (0-1) fraction of the start-to-target-year span and derives a real year from
// it on render (yearOf); the real schema stores `year` as an actual smallint column, so working
// directly in year-ints throughout is simpler and avoids reintroducing the fraction. `buildChain`
// (the standalone's local-seed-pool fallback for "no chain yet") is also dropped — the real app
// calls generateChain once instead, per the handoff's own Prompt 5 override.
export function horizonRange(horizon: string): [number, number] {
  const n = String(horizon || "").match(/\d+/g);
  if (!n) return [5, 10];
  const lo = +n[0];
  const hi = /\+/.test(horizon) ? lo + 5 : +n[n.length - 1];
  return [lo, Math.max(lo, hi)];
}

export function yearOptions(horizon: string, startYear: number): number[] {
  const [lo, hi] = horizonRange(horizon);
  const out: number[] = [];
  for (let i = lo; i <= hi; i++) out.push(startYear + i);
  return out;
}

// {Y} = target year, {S} = start year — render every stored string through this, never store a
// resolved year inside prose, so changing the target year rewrites every story correctly.
export function fmt(s: string | null | undefined, targetYear: number, startYear: number): string {
  return String(s ?? "")
    .replace(/\{Y\}/g, String(targetYear))
    .replace(/\{S\}/g, String(startYear));
}

export function chainSize(yrs: number): number {
  const y = Math.max(1, yrs);
  return Math.min(3 * y, y + 2);
}

// Re-spreads events evenly across startYear+1..targetYear so no single year holds more than 3,
// preserving relative order. Ported from the standalone's BC.spread, adapted to real year ints.
export function spread<T extends { year: number }>(events: T[], startYear: number, targetYear: number): T[] {
  const yrs = Math.max(1, targetYear - startYear);
  const sorted = [...events].sort((a, b) => a.year - b.year);
  const m = sorted.length;
  return sorted.map((e, i) => ({ ...e, year: startYear + Math.max(1, Math.ceil(((i + 1) * yrs) / m)) }));
}

export function yearCounts<T extends { year: number }>(events: T[]): Map<number, number> {
  const counts = new Map<number, number>();
  events.forEach((e) => counts.set(e.year, (counts.get(e.year) ?? 0) + 1));
  return counts;
}

// Matches scenario_ratings.stance's generated-column rule exactly (0052_futures_chains.sql) —
// used client-side for immediate feedback right after a rating click, before the server
// round-trip confirms the real stored stance.
export function desirClass(desirability: number | null): "want" | "live" | "avoid" {
  if (desirability == null) return "live";
  if (desirability >= 4) return "want";
  if (desirability <= 2) return "avoid";
  return "live";
}

export const DESIR: [number, string, string][] = [
  [1, "Must avoid", "#B91C1C"],
  [2, "Undesirable", "#C2410C"],
  [3, "Could live with", "#4B5563"],
  [4, "Desirable", "#047857"],
  [5, "Ideal", "#047857"],
];

// Visual 2x2 reading order — matches scenarios.quadrant's own TL/TR/BL/BR enum directly, no
// separate mapping needed (top-left, top-right, bottom-left, bottom-right).
export const GRID_ORDER = ["TL", "TR", "BL", "BR"] as const;

export const LIKELIHOOD_LABELS = ["Very unlikely", "Unlikely", "Even odds", "Likely", "Very likely"];
export const IMPACT_LABELS = ["Minor", "Some", "Moderate", "Major", "Decisive"];

export function chainEventScore(e: { likelihood: number | null; impact: number | null }): number {
  return e.likelihood && e.impact ? e.likelihood * e.impact : 0;
}

export function chainEventTier(score: number): [string, string, string] {
  if (score >= 15) return ["High", "#B91C1C", "#FEF2F2"];
  if (score >= 8) return ["Medium", "#92400E", "#FFFBEB"];
  if (score) return ["Low", "#374151", "#F3F4F6"];
  return ["Unranked", "#9CA3AF", "#fff"];
}
