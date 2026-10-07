// Monitoring + Strategy decision layer: tracked event likelihoods, scenario links,
// discovered events, action cards, target-scenario routes and briefings.
// Likelihood lives on EVENTS only. Scenarios get momentum (relative evidence), never probability.
window.FM_DECISIONS = {
  lastScan: "Today 06:00",
  sourcesScanned: 214,
  window: ["Jul 12", "Jul 26", "Aug 9", "Aug 23", "Sep 6", "Sep 20", "Oct 4"],
  levels: ["Ruled out", "Low", "Medium", "High", "Occurred"],
  phases: ["Precursors", "Catalysts", "First-order", "Second-order", "Realised"],
  // hist: one likelihood level per window point (0 Ruled out … 4 Occurred)
  tracked: [
    { evId: "ev5", title: "ASEAN customs harmonisation clears final ratification", force: "ASEAN trade harmonisation", pole: "Openness", impact: 4, phase: 1, lever: "influence", supports: ["sc1", "sc2"],
      hist: [2, 2, 2, 2, 2, 1, 1], change: { date: "Sep 18", source: "Inquirer", cite: "Philippine Senate defers vote on the ASEAN customs protocol to the 2027 session." } },
    { evId: "evi5", title: "Singapore and Indonesia sign a cross-border data-flow pact", force: "ASEAN trade harmonisation", pole: "Openness", impact: 4, phase: 1, lever: "influence", supports: ["sc1", "sc2"],
      hist: [1, 1, 1, 1, 2, 2, 2], change: { date: "Sep 4", source: "Straits Times", cite: "Trade ministers publish a joint negotiating text; signing targeted for H1 2028." } },
    { evId: "ev6", title: "Enterprise AI capex in SEA passes $20B", force: "Gen AI enterprise adoption", pole: "Adoption accelerates", impact: 3, phase: 2, lever: "influence", supports: ["sc1", "sc2"],
      hist: [2, 2, 2, 3, 3, 3, 3], change: { date: "Aug 20", source: "IDC", cite: "Q2 regional AI spend tracker revised up 34%; run-rate now $17.8B." } },
    { evId: "ev8", title: "US–China tariff climbdown", force: "US-China decoupling", pole: "Decoupling reverses", impact: 5, phase: 1, lever: "watch", supports: ["sc1", "sc3"],
      hist: [1, 1, 1, 1, 1, 1, 1], change: null },
    { evId: "ev1", title: "Indonesia raises e-commerce foreign-ownership cap to 67%", force: "ASEAN trade harmonisation", pole: "Openness", impact: 3, phase: 0, lever: "watch", supports: ["sc1", "sc2"],
      hist: [4, 4, 4, 4, 4, 4, 4], change: null },
    { evId: "ev7", title: "Indonesia mandates in-country data residency", force: "ASEAN trade harmonisation", pole: "Fragmentation", impact: 4, phase: 1, lever: "watch", supports: ["sc2", "sc3", "sc4"],
      hist: [3, 3, 3, 3, 3, 3, 3], change: null },
    { evId: "evi4", title: "Vietnam requires local hosting for platforms above 1M users", force: "ASEAN trade harmonisation", pole: "Fragmentation", impact: 4, phase: 1, lever: "watch", supports: ["sc3", "sc4"],
      hist: [2, 2, 2, 2, 3, 3, 3], change: { date: "Sep 2", source: "VnExpress", cite: "Ministry of Information publishes Decree 53 amendments for public consultation." } },
    { evId: "evi2", title: "Malaysia caps foreign ownership of data centres at 49%", force: "ASEAN trade harmonisation", pole: "Fragmentation", impact: 4, phase: 1, lever: "influence", supports: ["sc3", "sc4"],
      hist: [2, 2, 2, 2, 2, 1, 1], change: { date: "Sep 24", source: "The Edge", cite: "MITI withdraws the draft after hyperscaler and chamber submissions." } },
    { evId: "ev4", title: "US adds 14 SEA-based firms to the Entity List", force: "US-China decoupling", pole: "Decoupling deepens", impact: 4, phase: 1, lever: "watch", supports: ["sc2", "sc4"],
      hist: [3, 4, 4, 4, 4, 4, 4], change: { date: "Jul 22", source: "FT", cite: "Commerce Department adds SEA subsidiaries to export-control list." } },
  ],
  signposts: [
    { id: "sp1", scenario: "sc1", name: "Single ASEAN customs window goes live", state: "not yet" },
    { id: "sp2", scenario: "sc1", name: "SG–ID data-flow pact signed", state: "approaching" },
    { id: "sp3", scenario: "sc2", name: "A third sovereign AI stack launches in ASEAN", state: "hit", hitAt: 3 },
    { id: "sp4", scenario: "sc2", name: "Two or more ASEAN-6 diverge on content-moderation law", state: "approaching" },
    { id: "sp5", scenario: "sc3", name: "Vietnam local-hosting decree enacted", state: "approaching" },
    { id: "sp6", scenario: "sc3", name: "US–China tariff rollback announced", state: "not yet" },
    { id: "sp7", scenario: "sc4", name: "Entity List extended to SEA subsidiaries", state: "hit", hitAt: 1 },
    { id: "sp8", scenario: "sc4", name: "Capital controls in any ASEAN-6 market", state: "not yet" },
  ],
  // New developments found by the daily scan, not yet in the project.
  inbox: [
    { id: "nx1", title: "Thailand and Singapore launch a joint sandbox for cross-border AI models", source: "Nikkei Asia", time: "3h", fits: true, force: "Gen AI enterprise adoption", pole: "Adoption accelerates", supports: ["sc1", "sc2"], likelihood: "Observed" },
    { id: "nx2", title: "Gulf sovereign funds commit $12B to SEA data centres on local-ownership terms", source: "Bloomberg", time: "9h", fits: false, proposal: "New force: Sovereign compute capital", supports: [], likelihood: "Observed" },
    { id: "nx3", title: "Vietnam drafts a national-LLM requirement for public-sector procurement", source: "Reuters", time: "1d", fits: false, proposal: "New force: Sovereign compute capital", supports: [], likelihood: "Medium" },
    { id: "nx4", title: "Indonesia's OJK proposes onshore cloud for all payment processors", source: "Jakarta Post", time: "2d", fits: true, force: "ASEAN trade harmonisation", pole: "Fragmentation", supports: ["sc3", "sc4"], likelihood: "Medium" },
  ],
  // Action cards emitted by Monitoring when a threshold is crossed.
  actions: [
    { id: "a1", raised: "1d", urgency: "Urgent", audience: "CEO", scenario: "sc1", trigger: "Target catalyst weakening", evidence: "ev5",
      title: "Pause the Singapore single-HQ consolidation",
      body: "Customs ratification dropped from Medium to Low. The HQ move only pays off once a single customs window exists. Hold Phase 2 and keep capital in the federated build-out.",
      effect: { move: "m5", status: "paused" } },
    { id: "a2", raised: "3d", urgency: "High", audience: "CEO", scenario: "sc3", trigger: "Blocker rising", evidence: "evi4",
      title: "Arm the Vietnam hosting hedge",
      body: "Vietnam's local-hosting rule moved to High. Pre-qualify an in-country hosting partner now so the switch takes weeks, not quarters. Est. $2.4M.",
      effect: { move: "h1", status: "armed" } },
    { id: "a3", raised: "5d", urgency: "Medium", audience: "CSO", scenario: "sc1", trigger: "Influenceable event gaining", evidence: "evi5",
      title: "Join the SG–ID data-flow working group",
      body: "The pact moved from Low to Medium and is a lever you can push. Submit cross-border use cases through the Singapore Business Federation before the text closes.",
      effect: { move: "m4", status: "active" } },
    { id: "a4", raised: "6d", urgency: "Medium", audience: "CEO", scenario: "sc1", trigger: "Event passed threshold", evidence: "ev6",
      title: "Bring the HCMC AI talent hub forward to Q1",
      body: "AI capex moved to High, so the talent crunch will arrive early. The hub pays off in all four futures, which makes it a no-regret move.",
      effect: { move: "m2", status: "active" } },
    { id: "a5", raised: "2d", urgency: "Medium", audience: "CSO", scenario: null, trigger: "Frame check", evidence: "nx2",
      title: "Add 'Sovereign compute capital' as a force",
      body: "Two of the last four discoveries don't fit any force, and both point at state-directed compute. Add the force in Signals and test it in the Matrix at the next review.",
      effect: { navigate: "/app/signals" } },
  ],
  // Route to target. lane: noregret | shaping | hedge. when: Now | 2027 | 2028 | 2029–30
  routes: {
    sc1: [
      { id: "m1", lane: "noregret", when: "Now", title: "Federated regional architecture: core platform", link: { kind: "option", ref: "st1" }, status: "active" },
      { id: "m2", lane: "noregret", when: "2027", title: "HCMC AI talent hub", link: { kind: "event", ref: "ev6" }, status: "planned" },
      { id: "m3", lane: "shaping", when: "Now", title: "Industry coalition for customs ratification", link: { kind: "event", ref: "ev5" }, status: "active", push: true },
      { id: "m4", lane: "shaping", when: "2027", title: "SG–ID data-flow working group", link: { kind: "event", ref: "evi5" }, status: "planned", push: true },
      { id: "m5", lane: "shaping", when: "2028", title: "Singapore single regional HQ", link: { kind: "signpost", ref: "sp1" }, status: "planned" },
      { id: "m6", lane: "shaping", when: "2029–30", title: "Premium consumer launch, Bangkok + Jakarta", link: { kind: "signpost", ref: "sp2" }, status: "planned" },
      { id: "h1", lane: "hedge", when: "2027", title: "Pre-qualified Vietnam hosting partner", link: { kind: "signpost", ref: "sp5" }, status: "held" },
      { id: "h2", lane: "hedge", when: "2028", title: "Minority stakes in local champions", link: { kind: "signpost", ref: "sp8" }, status: "held" },
      { id: "h3", lane: "hedge", when: "2027", title: "Indonesia country-JV playbook", link: { kind: "event", ref: "ev7" }, status: "held" },
    ],
  },
  revision: {
    since: "Aug 12",
    items: [
      { kind: "Re-sequence", text: "Move the Singapore single HQ from 2028 to 2029, after the customs vote." },
      { kind: "New move", text: "Explore a sovereign-compute partnership in Vietnam, prompted by the two unfitted discoveries." },
      { kind: "Re-score", text: "Singapore-anchored expansion: in Pacific Connector, downgrade from robust to conditional." },
    ],
  },
};

(function () {
  const KEY = "scenaric.decisions.v1";
  const D = window.FM_DECISIONS;
  const initial = {
    target: "sc1",
    actions: Object.fromEntries(D.actions.map(a => [a.id, "pending"])),
    inbox: Object.fromEntries(D.inbox.map(n => [n.id, "pending"])),
    moves: {},
    revision: "proposed",
  };
  let state;
  try { state = Object.assign({}, initial, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { state = initial; }
  const subs = new Set();
  const DS = {
    get: () => state,
    set: (patch) => { state = Object.assign({}, state, typeof patch === "function" ? patch(state) : patch); localStorage.setItem(KEY, JSON.stringify(state)); subs.forEach(f => f(state)); },
    subscribe: (f) => { subs.add(f); return () => subs.delete(f); },
  };
  window.DecisionStore = DS;
  window.useDecisions = function () {
    const [s, setS] = React.useState(DS.get());
    React.useEffect(() => DS.subscribe(setS), []);
    return [s, DS.set];
  };

  // Derived model — shared by Monitoring, Strategy and the briefing.
  const delta = (t) => t.hist[t.hist.length - 1] - t.hist[0];
  window.DecisionModel = {
    delta,
    lvl: (n) => D.levels[n],
    momentum(scId) {
      const contrib = D.tracked.filter(t => t.supports.includes(scId)).map(t => ({ t, score: delta(t) * t.impact })).filter(c => c.score !== 0).sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
      const score = contrib.reduce((s, c) => s + c.score, 0);
      const label = score >= 6 ? "Building" : score >= 2 ? "Edging up" : score <= -6 ? "Fading" : score <= -2 ? "Easing" : "Steady";
      return { score, label, contrib };
    },
    progress(scId) {
      const ev = D.tracked.filter(t => t.supports.includes(scId));
      let reached = 0;
      D.phases.forEach((_, i) => { const p = ev.filter(t => t.phase === i); if (p.length && p.every(t => t.hist[t.hist.length - 1] >= 3)) reached = i + 1; });
      return reached;
    },
    levers(scId) {
      const sup = D.tracked.filter(t => t.supports.includes(scId));
      const block = D.tracked.filter(t => !t.supports.includes(scId));
      return { influence: sup.filter(t => t.lever === "influence"), watch: sup.filter(t => t.lever === "watch"), block };
    },
    health(scId) {
      const sup = D.tracked.filter(t => t.supports.includes(scId));
      const block = D.tracked.filter(t => !t.supports.includes(scId));
      const gaining = sup.filter(t => delta(t) > 0), weakening = sup.filter(t => delta(t) < 0);
      const blockersRising = block.filter(t => delta(t) > 0 && t.hist[t.hist.length - 1] < 4);
      const m = this.momentum(scId).score;
      const rivals = (window.FM_DATA.scenarios || []).filter(s => s.id !== scId && this.momentum(s.id).score >= 6);
      let label = "On course", tone = "low";
      if (m < 0 && rivals.length) { label = "Off course"; tone = "high"; }
      else if (weakening.some(t => t.impact >= 4) || blockersRising.length) { label = "At risk"; tone = "mid"; }
      else if (gaining.length <= weakening.length) { label = "Holding"; tone = "mid"; }
      return { label, tone, gaining, weakening, blockersRising, rivals };
    },
  };
})();
