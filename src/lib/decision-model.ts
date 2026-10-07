// Decision layer roll-up math (design/2026-10-05/01-shared-decision-layer/decision-data.js,
// window.DecisionModel). Pure functions over already-fetched rows — no Supabase client, no
// fetching of its own, same spirit as src/lib/indicator-status.ts. Ported 1:1 from the
// reference mock so the numeric acceptance criteria in the design handoff ("Pacific Connector
// = At risk", "Fragmented Frontier has the highest momentum") hold against real data, not just
// the mock. Likelihood lives on EVENTS only (TrackedEvent.levels); a scenario never gets a
// probability, only the derived momentum/health below.
//
// "use server" is NOT added here on purpose — every file under src/lib/actions/ is "use
// server" and Next.js requires every top-level export there to be an async function; these are
// synchronous pure functions (same reason src/lib/indicator-status.ts lives outside actions/).

export const LIKELIHOOD_LEVELS = ["Ruled out", "Low", "Medium", "High", "Occurred"] as const;
export type LikelihoodLevel = 0 | 1 | 2 | 3 | 4;

export const STORYLINE_PHASES = ["precursors", "catalysts", "first_order", "second_order", "realized"] as const;
export type StorylinePhase = (typeof STORYLINE_PHASES)[number];

export type MomentumLabel = "Building" | "Edging up" | "Steady" | "Easing" | "Fading";
export type HealthLabel = "On course" | "Holding" | "At risk" | "Off course";
export type HealthTone = "low" | "mid" | "high";

// One tracked event's likelihood history over the monitoring window, plus how it relates to a
// given scenario — mirrors decision-data.js's `tracked` row shape exactly (`hist`, `impact`,
// `phase`, `supports`).
export interface TrackedEvent {
  eventId: string;
  impact: number; // 1-5
  phase: StorylinePhase;
  lever: "influence" | "watch" | null;
  supports: string[]; // scenario ids this event's likelihood rising helps
  hist: LikelihoodLevel[]; // one level per window point, oldest first
}

export interface MomentumContribution {
  event: TrackedEvent;
  score: number; // delta * impact; sign follows `supports`
}

export interface MomentumResult {
  score: number;
  label: MomentumLabel;
  contrib: MomentumContribution[]; // sorted by |score| desc, zero-score events excluded
}

export interface LeversResult {
  influence: TrackedEvent[];
  watch: TrackedEvent[];
  block: TrackedEvent[];
}

export interface HealthResult {
  label: HealthLabel;
  tone: HealthTone;
  gaining: TrackedEvent[];
  weakening: TrackedEvent[];
  blockersRising: TrackedEvent[];
  rivals: string[]; // scenario ids with momentum >= 6
}

// Last level minus first level over the tracked window. Positive = likelihood rose.
export function delta(event: TrackedEvent): number {
  return event.hist[event.hist.length - 1] - event.hist[0];
}

export function momentumLabelFor(score: number): MomentumLabel {
  if (score >= 6) return "Building";
  if (score >= 2) return "Edging up";
  if (score <= -6) return "Fading";
  if (score <= -2) return "Easing";
  return "Steady";
}

// Sum of delta*impact over every event supporting this scenario — relative evidence, never a
// probability. `contrib` is sorted by |score| descending (zero-score events dropped) so a
// caller can show "top 2 contributing events" directly.
export function momentum(scenarioId: string, tracked: TrackedEvent[]): MomentumResult {
  const contrib = tracked
    .filter((t) => t.supports.includes(scenarioId))
    .map((t) => ({ event: t, score: delta(t) * t.impact }))
    .filter((c) => c.score !== 0)
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  const score = contrib.reduce((sum, c) => sum + c.score, 0);
  return { score, label: momentumLabelFor(score), contrib };
}

// The highest storyline phase for which every event linked to this scenario at that phase has
// reached High (3) or above. Returns the count of phases reached (0-5), matching
// decision-data.js's `progress()` (an index into STORYLINE_PHASES, not the phase name itself —
// callers render `STORYLINE_PHASES[reached - 1]` when reached > 0).
export function progress(scenarioId: string, tracked: TrackedEvent[]): number {
  const supporting = tracked.filter((t) => t.supports.includes(scenarioId));
  let reached = 0;
  STORYLINE_PHASES.forEach((phase, i) => {
    const atPhase = supporting.filter((t) => t.phase === phase);
    if (atPhase.length > 0 && atPhase.every((t) => t.hist[t.hist.length - 1] >= 3)) reached = i + 1;
  });
  return reached;
}

// influence/watch = events supporting the scenario, split by the project's own lever
// classification (event_levers; null/unclassified events appear in neither). block = tracked
// events that do NOT support this scenario — candidates to reduce (influenceable) or hedge
// (watch-only), the UI distinction decision-ui.tsx already draws per event.lever.
export function levers(scenarioId: string, tracked: TrackedEvent[]): LeversResult {
  const supporting = tracked.filter((t) => t.supports.includes(scenarioId));
  const blocking = tracked.filter((t) => !t.supports.includes(scenarioId));
  return {
    influence: supporting.filter((t) => t.lever === "influence"),
    watch: supporting.filter((t) => t.lever === "watch"),
    block: blocking,
  };
}

// On course / Holding / At risk / Off course, per the reference rules exactly:
// - Off course: this scenario's momentum < 0 AND some rival scenario's momentum >= 6.
// - At risk: a supporting event with impact >= 4 is weakening, OR a blocker is rising (and
//   hasn't already fully occurred — level 4 "Occurred" isn't "rising", it's done).
// - Holding: gaining count <= weakening count.
// - On course: otherwise.
export function health(scenarioId: string, tracked: TrackedEvent[], allScenarioIds: string[]): HealthResult {
  const supporting = tracked.filter((t) => t.supports.includes(scenarioId));
  const blocking = tracked.filter((t) => !t.supports.includes(scenarioId));
  const gaining = supporting.filter((t) => delta(t) > 0);
  const weakening = supporting.filter((t) => delta(t) < 0);
  const blockersRising = blocking.filter((t) => delta(t) > 0 && t.hist[t.hist.length - 1] < 4);

  const thisMomentum = momentum(scenarioId, tracked).score;
  const rivals = allScenarioIds.filter((id) => id !== scenarioId && momentum(id, tracked).score >= 6);

  let label: HealthLabel = "On course";
  let tone: HealthTone = "low";
  if (thisMomentum < 0 && rivals.length > 0) {
    label = "Off course";
    tone = "high";
  } else if (weakening.some((t) => t.impact >= 4) || blockersRising.length > 0) {
    label = "At risk";
    tone = "mid";
  } else if (gaining.length <= weakening.length) {
    label = "Holding";
    tone = "mid";
  }

  return { label, tone, gaining, weakening, blockersRising, rivals };
}

// The monitoring window: 7 points, 14 days apart, ending today — matches
// decision-data.js's 7-point window exactly (12 weeks = 6*14 days between the first and last
// point). Shared by the decision-scan job (to resample event_likelihood_history onto these
// points) and the Monitoring/Home pages (so a sparkline's x-axis is the same window the
// momentum/health numbers above were computed over).
export const WINDOW_POINT_COUNT = 7;
export const WINDOW_STEP_DAYS = 14;

export function windowPoints(asOf: Date = new Date()): Date[] {
  const points: Date[] = [];
  for (let i = WINDOW_POINT_COUNT - 1; i >= 0; i--) {
    const d = new Date(asOf);
    d.setUTCDate(d.getUTCDate() - i * WINDOW_STEP_DAYS);
    points.push(d);
  }
  return points;
}

// Resamples an event's (irregular, change-only) likelihood history onto the fixed window
// points above, carrying the latest known level forward through each point — history is only
// ever written when the level actually changes, so most points fall between writes.
// `seedLevel` covers every point before the first real history row (there is always at least
// one row in practice, the scan seeds one on first tracking — see decision-scan.ts — but this
// stays safe against an empty array too).
export function buildHistFromHistory(
  history: { level: number; observedAt: string }[],
  points: Date[],
  seedLevel: LikelihoodLevel
): LikelihoodLevel[] {
  const sorted = [...history].sort((a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime());
  return points.map((point) => {
    let level: number = seedLevel;
    for (const row of sorted) {
      if (new Date(row.observedAt).getTime() <= point.getTime()) level = row.level;
      else break;
    }
    return level as LikelihoodLevel;
  });
}

// Where a scenario sits on one Matrix axis, from -0.9 to 0.9: 2.4 * (sum of signed
// impact*level over events on this axis's force) / (sum of impact*4). Sign is + for events
// aligned with the axis's "plus" pole. Feeds the Home compass's dashed 12-week trail; callers
// pass one `axisEvents` slice per window point to plot the trail, and the latest slice alone
// for "Today".
export function compassPosition(axisEvents: { impact: number; level: LikelihoodLevel; isPlusPole: boolean }[]): number {
  const numerator = axisEvents.reduce((sum, e) => sum + (e.isPlusPole ? 1 : -1) * e.impact * e.level, 0);
  const denominator = axisEvents.reduce((sum, e) => sum + e.impact * 4, 0);
  if (denominator === 0) return 0;
  const raw = 2.4 * (numerator / denominator);
  return Math.max(-0.9, Math.min(0.9, raw));
}
