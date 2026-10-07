import { describe, expect, it } from "vitest";
import { buildHistFromHistory, compassPosition, health, levers, momentum, progress, windowPoints, type TrackedEvent } from "./decision-model";

// Verbatim from design/2026-10-05/01-shared-decision-layer/decision-data.js's
// window.FM_DECISIONS.tracked, with `phase` (smallint) translated to the phase enum
// storyline_nodes already uses (0042_decision_layer.sql keeps one phase vocabulary, not two).
const SC1 = "sc1"; // Pacific Connector
const SC2 = "sc2"; // Fragmented Frontier
const SC3 = "sc3"; // Walled Gardens
const SC4 = "sc4"; // Bamboo Curtain
const ALL_SCENARIOS = [SC1, SC2, SC3, SC4];

const TRACKED: TrackedEvent[] = [
  { eventId: "ev5", impact: 4, phase: "catalysts", lever: "influence", supports: [SC1, SC2], hist: [2, 2, 2, 2, 2, 1, 1] },
  { eventId: "evi5", impact: 4, phase: "catalysts", lever: "influence", supports: [SC1, SC2], hist: [1, 1, 1, 1, 2, 2, 2] },
  { eventId: "ev6", impact: 3, phase: "first_order", lever: "influence", supports: [SC1, SC2], hist: [2, 2, 2, 3, 3, 3, 3] },
  { eventId: "ev8", impact: 5, phase: "catalysts", lever: "watch", supports: [SC1, SC3], hist: [1, 1, 1, 1, 1, 1, 1] },
  { eventId: "ev1", impact: 3, phase: "precursors", lever: "watch", supports: [SC1, SC2], hist: [4, 4, 4, 4, 4, 4, 4] },
  { eventId: "ev7", impact: 4, phase: "catalysts", lever: "watch", supports: [SC2, SC3, SC4], hist: [3, 3, 3, 3, 3, 3, 3] },
  { eventId: "evi4", impact: 4, phase: "catalysts", lever: "watch", supports: [SC3, SC4], hist: [2, 2, 2, 2, 3, 3, 3] },
  { eventId: "evi2", impact: 4, phase: "catalysts", lever: "influence", supports: [SC3, SC4], hist: [2, 2, 2, 2, 2, 1, 1] },
  { eventId: "ev4", impact: 4, phase: "catalysts", lever: "watch", supports: [SC2, SC4], hist: [3, 4, 4, 4, 4, 4, 4] },
];

describe("momentum", () => {
  it("matches the handoff's own stated acceptance value: Fragmented Frontier has the highest momentum", () => {
    const scores = ALL_SCENARIOS.map((id) => ({ id, score: momentum(id, TRACKED).score }));
    const highest = scores.reduce((a, b) => (b.score > a.score ? b : a));
    expect(highest.id).toBe(SC2);
    // ev5(-4) + evi5(+4) + ev6(+3) + ev4(+4) = +7, label "Building" (score >= 6)
    expect(highest.score).toBe(7);
    expect(momentum(SC2, TRACKED).label).toBe("Building");
  });

  it("drops zero-delta events from contrib and sorts the rest by |score| desc", () => {
    const m = momentum(SC1, TRACKED);
    // ev8 and ev1 support sc1 but have delta 0 (flat history) — excluded from contrib entirely.
    expect(m.contrib.some((c) => c.event.eventId === "ev8")).toBe(false);
    expect(m.contrib.some((c) => c.event.eventId === "ev1")).toBe(false);
    expect(m.contrib.map((c) => Math.abs(c.score))).toEqual([...m.contrib.map((c) => Math.abs(c.score))].sort((a, b) => b - a));
  });
});

describe("health", () => {
  it("matches the handoff's own stated acceptance value: Pacific Connector = At risk", () => {
    const h = health(SC1, TRACKED, ALL_SCENARIOS);
    // ev5 (impact 4, supports sc1) weakened -> "a supporting event with impact >= 4 is
    // weakening" fires At risk on its own; evi4 (a blocker) also rising, same conclusion.
    expect(h.label).toBe("At risk");
    expect(h.weakening.map((t) => t.eventId)).toContain("ev5");
    expect(h.blockersRising.map((t) => t.eventId)).toContain("evi4");
  });

  it("excludes an already-occurred blocker from blockersRising (ev4 hit level 4 for sc1)", () => {
    const h = health(SC1, TRACKED, ALL_SCENARIOS);
    // ev4 supports sc2/sc4, not sc1, so it's a "blocker" for sc1; its delta is +1 (rising) but
    // it already reached level 4 (Occurred) — "rising" stops mattering once it's happened.
    expect(h.blockersRising.map((t) => t.eventId)).not.toContain("ev4");
  });
});

describe("levers", () => {
  it("splits supporting events by lever, and non-supporting events are blockers regardless of lever", () => {
    const l = levers(SC4, TRACKED);
    expect(l.influence.map((t) => t.eventId).sort()).toEqual(["evi2"]);
    expect(l.watch.map((t) => t.eventId).sort()).toEqual(["ev4", "ev7", "evi4"]);
    // ev5/evi5/ev6/ev8/ev1 don't support sc4 at all -> blockers, whatever their own lever is.
    expect(l.block.map((t) => t.eventId).sort()).toEqual(["ev1", "ev5", "ev6", "ev8", "evi5"]);
  });
});

describe("progress", () => {
  it("is non-monotonic across phases, same as the reference: the LAST fully-satisfied phase wins, not the first gap", () => {
    // sc1: precursors (ev1 alone, hist[-1]=4>=3) satisfied -> reached=1; catalysts
    // (ev5=1, evi5=2, ev8=1) all fail -> reached stays 1; first_order (ev6 alone, hist[-1]=3)
    // satisfied -> reached=3. The function doesn't stop at catalysts' failure.
    expect(progress(SC1, TRACKED)).toBe(3);
  });

  it("does NOT reach catalysts for sc4, contradicting the handoff's own stated acceptance text", () => {
    // design/2026-10-05's 01-shared-decision-layer/PROMPTS.md Prompt 2 claims "the Bamboo
    // Curtain storyline has reached Catalysts" against this exact seed data. It doesn't: sc4's
    // catalysts-phase events are ev7(hist[-1]=3), evi4(hist[-1]=3), evi2(hist[-1]=1),
    // ev4(hist[-1]=4) — evi2's 1 fails the "every event >= High" requirement, so catalysts is
    // never satisfied for sc4 and progress stays 0. This is a genuine inconsistency in the
    // handoff's own mock/acceptance-text pairing (one of several stale assumptions found while
    // implementing this package — see the Phase 1 plan's Findings section), not a bug in this
    // port: the math here is a faithful 1:1 translation of decision-data.js's own progress().
    expect(progress(SC4, TRACKED)).toBe(0);
  });
});

describe("windowPoints / buildHistFromHistory", () => {
  it("produces 7 points 14 days apart, ending at asOf", () => {
    const asOf = new Date("2026-10-04T00:00:00Z");
    const points = windowPoints(asOf);
    expect(points).toHaveLength(7);
    expect(points[6].toISOString()).toBe(asOf.toISOString());
    expect(points[0].toISOString()).toBe(new Date("2026-07-12T00:00:00Z").toISOString());
  });

  it("carries the latest level forward through each point, and uses the seed before the first row", () => {
    const points = windowPoints(new Date("2026-10-04T00:00:00Z"));
    const history = [
      { level: 2, observedAt: "2026-09-18T00:00:00Z" },
      { level: 1, observedAt: "2026-09-25T00:00:00Z" },
    ];
    const hist = buildHistFromHistory(history, points, 2);
    // Every point before Sep 18 falls back to the seed level (2); Sep 20 and Oct 4 pick up
    // the Sep 18 row (2) and then the Sep 25 row (1) respectively.
    expect(hist).toEqual([2, 2, 2, 2, 2, 2, 1]);
  });
});

describe("compassPosition", () => {
  it("is 0 when there are no events on the axis", () => {
    expect(compassPosition([])).toBe(0);
  });

  it("is positive when plus-pole events dominate, scaled by 2.4x and clamped to ±0.9", () => {
    const pos = compassPosition([
      { impact: 4, level: 4, isPlusPole: true },
      { impact: 2, level: 1, isPlusPole: false },
    ]);
    // numerator = 4*4 - 2*1 = 14; denominator = 4*4 + 2*4 = 24; 2.4 * 14/24 = 1.4 -> clamped to 0.9
    expect(pos).toBe(0.9);
  });

  it("clamps the minus side symmetrically", () => {
    const pos = compassPosition([{ impact: 5, level: 4, isPlusPole: false }]);
    expect(pos).toBe(-0.9);
  });
});
