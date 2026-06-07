// Storyline — causal-chain data + helpers. Ported verbatim from the handoff
// page-storyline.jsx (STORYLINE_DATA + layout constants + chain-strength logic).
import type { SteepCategory, Quadrant } from "@/lib/types";

export interface StoryPhase {
  id: string;
  range: string;
  desc: string;
}
export interface StoryNode {
  id: string;
  phase: string;
  cat: SteepCategory;
  title: string;
  body: string;
  year: string;
  strength?: number;
  source?: string;
  uncertainty?: "High" | "Medium" | "Low";
  impact?: number;
}
export interface StoryEdge {
  from: string;
  to: string;
  relationship: string;
  confidence: string;
}
export interface StoryData {
  title: string;
  summary: string;
  confidence: number;
  phases: StoryPhase[];
  nodes: StoryNode[];
  edges: StoryEdge[];
}

export const STORYLINE_DATA: Record<string, StoryData> = {
  sc1: {
    title: "Pacific Connector",
    summary: "How open markets + aligned geopolitics produce the best-case future for SEA expansion.",
    confidence: 0.32,
    phases: [
      { id: "prec", range: "2026", desc: "Initial conditions in place." },
      { id: "cat", range: "Late 2026 – 2027", desc: "Triggering events fire." },
      { id: "first", range: "2027 – 2028", desc: "Direct consequences emerge." },
      { id: "second", range: "2028 – 2029", desc: "Compounding effects propagate." },
      { id: "real", range: "2029 – 2030", desc: "New equilibrium for SEA." },
    ],
    nodes: [
      { id: "p1", phase: "prec", cat: "Political", title: "ASEAN unlocks digital trade pact", body: "Customs harmonisation removes friction for cross-border services.", year: "May 2026", strength: 0.7 },
      { id: "p2", phase: "prec", cat: "Economic", title: "SEA tech IPO pipeline doubles", body: "Capital floods regional growth equity; valuations re-rate.", year: "Q3 2026", strength: 0.6 },
      { id: "p4", phase: "cat", cat: "Political", title: "US-China standards climbdown", body: "Cloud, semiconductor, and AI standards re-converge.", year: "Q2 2027", strength: 0.5 },
      { id: "p3", phase: "first", cat: "Technology", title: "Enterprise AI capex +40% YoY", body: "Boards greenlight major AI infrastructure across SEA HQs.", year: "2027", strength: 0.8 },
      { id: "p5", phase: "first", cat: "Social", title: "Talent visa programme launches", body: "Singapore-led scheme attracts 200K knowledge workers in 18mo.", year: "Q4 2027", strength: 0.7 },
      { id: "p6", phase: "second", cat: "Economic", title: "SEA middle-class hits 400M", body: "Premium consumer categories see step-change in willingness to pay.", year: "2028", strength: 0.9 },
      { id: "p7", phase: "second", cat: "Technology", title: "Regional cloud federation live", body: "Cross-border data flows under a unified compliance regime.", year: "Q3 2028", strength: 0.8 },
      { id: "p8", phase: "real", cat: "Economic", title: "Regional GDP growth 5.8%", body: "Sustained over 3 years; productivity gap to OECD halves.", year: "2030", strength: 1.0 },
      { id: "p9", phase: "real", cat: "Political", title: "Single digital market ratified", body: "ASEAN matures into a functional integrated economic bloc.", year: "Late 2030", strength: 0.85 },
    ],
    edges: [
      { from: "p1", to: "p4", relationship: "Leads to", confidence: "Strong" },
      { from: "p2", to: "p4", relationship: "Enables", confidence: "Moderate" },
      { from: "p1", to: "p3", relationship: "Enables", confidence: "Moderate" },
      { from: "p2", to: "p3", relationship: "Amplifies", confidence: "Strong" },
      { from: "p4", to: "p3", relationship: "Amplifies", confidence: "Strong" },
      { from: "p4", to: "p7", relationship: "Enables", confidence: "Strong" },
      { from: "p3", to: "p7", relationship: "Leads to", confidence: "Moderate" },
      { from: "p3", to: "p6", relationship: "Leads to", confidence: "Moderate" },
      { from: "p5", to: "p6", relationship: "Amplifies", confidence: "Moderate" },
      { from: "p6", to: "p8", relationship: "Leads to", confidence: "Strong" },
      { from: "p7", to: "p8", relationship: "Amplifies", confidence: "Moderate" },
      { from: "p7", to: "p9", relationship: "Leads to", confidence: "Strong" },
    ],
  },
  sc2: {
    title: "Fragmented Frontier",
    summary: "Markets stay open but politics atomise. Speed and modularity beat scale.",
    confidence: 0.28,
    phases: [
      { id: "prec", range: "2026", desc: "Decoupling accelerates." },
      { id: "cat", range: "Late 2026", desc: "Sovereign mandates set the template." },
      { id: "first", range: "2027 – 2028", desc: "Multi-stack reality hardens." },
      { id: "second", range: "2028 – 2029", desc: "Federated architecture wins." },
      { id: "real", range: "2029 – 2030", desc: "Local champions outperform." },
    ],
    nodes: [
      { id: "f1", phase: "prec", cat: "Political", title: "US-China decoupling deepens", body: "Bifurcated standards force market-by-market technology choices.", year: "2026", strength: 0.8 },
      { id: "f2", phase: "cat", cat: "Political", title: "Indonesia sovereign cloud rule", body: "Data residency mandate becomes the SEA template.", year: "Q4 2026", strength: 0.7 },
      { id: "f3", phase: "first", cat: "Technology", title: "Three AI stacks emerge", body: "Western, Chinese, sovereign. Vendors pick lanes per market.", year: "2027", strength: 0.85 },
      { id: "f4", phase: "first", cat: "Political", title: "Vietnam follows Indonesia", body: "Country-level rules diverge sharply on content and AI training.", year: "Q2 2028", strength: 0.7 },
      { id: "f5", phase: "first", cat: "Economic", title: "FX bands breached repeatedly", body: "Cross-border unit economics become unmanageable globally.", year: "2028", strength: 0.6 },
      { id: "f6", phase: "second", cat: "Technology", title: "Federated architecture as default", body: "Local pods on local stacks; shared brand and product spine only.", year: "Q2 2029", strength: 0.9 },
      { id: "f7", phase: "second", cat: "Social", title: "Local talent premium spikes", body: "Country-specific compliance + AI skills command 2x premium.", year: "2029", strength: 0.65 },
      { id: "f8", phase: "real", cat: "Economic", title: "Local champions outperform", body: "Country pods deliver 30% higher growth than global average.", year: "2030", strength: 0.85 },
      { id: "f9", phase: "real", cat: "Technology", title: "Speed beats scale", body: "Speed-to-market with local fit outweighs cost-of-scale.", year: "2030", strength: 0.8 },
    ],
    edges: [
      { from: "f1", to: "f2", relationship: "Leads to", confidence: "Strong" },
      { from: "f1", to: "f3", relationship: "Leads to", confidence: "Strong" },
      { from: "f2", to: "f3", relationship: "Amplifies", confidence: "Strong" },
      { from: "f2", to: "f4", relationship: "Leads to", confidence: "Strong" },
      { from: "f1", to: "f5", relationship: "Enables", confidence: "Moderate" },
      { from: "f3", to: "f6", relationship: "Leads to", confidence: "Strong" },
      { from: "f4", to: "f6", relationship: "Amplifies", confidence: "Moderate" },
      { from: "f5", to: "f6", relationship: "Enables", confidence: "Moderate" },
      { from: "f3", to: "f7", relationship: "Leads to", confidence: "Moderate" },
      { from: "f6", to: "f8", relationship: "Leads to", confidence: "Strong" },
      { from: "f6", to: "f9", relationship: "Leads to", confidence: "Strong" },
      { from: "f7", to: "f8", relationship: "Amplifies", confidence: "Moderate" },
    ],
  },
  sc3: {
    title: "Walled Gardens",
    summary: "Geopolitical détente but rising protectionism. Local-for-local becomes mandatory.",
    confidence: 0.22,
    phases: [
      { id: "prec", range: "2026", desc: "Reshoring instincts harden." },
      { id: "cat", range: "2027", desc: "Industrial policy onshores." },
      { id: "first", range: "2027 – 2028", desc: "Local mandates spread." },
      { id: "second", range: "2028 – 2029", desc: "JV-first becomes the rule." },
      { id: "real", range: "2029 – 2030", desc: "Politically resilient, lower ROIC." },
    ],
    nodes: [
      { id: "w1", phase: "prec", cat: "Political", title: "US-China truce surprises", body: "Tech standards de-escalate, but protectionism remains.", year: "Q1 2027", strength: 0.55 },
      { id: "w2", phase: "prec", cat: "Economic", title: "Reshoring credits expanded", body: "SEA governments subsidise domestic manufacturing and data.", year: "2027", strength: 0.7 },
      { id: "w3", phase: "cat", cat: "Political", title: "Local-for-local mandates", body: "Data, IP, employment must be in-country for licensed services.", year: "2028", strength: 0.85 },
      { id: "w4", phase: "first", cat: "Technology", title: "Domestic AI compute scales", body: "National AI fabs and clouds capture latent demand.", year: "Q3 2028", strength: 0.65 },
      { id: "w5", phase: "second", cat: "Political", title: "Foreign equity caps tighten", body: "Minority stake limits become standard across SEA.", year: "2029", strength: 0.75 },
      { id: "w6", phase: "second", cat: "Economic", title: "JV-first becomes the rule", body: "Every entry requires a local JV partner with majority control.", year: "Q2 2029", strength: 0.85 },
      { id: "w7", phase: "real", cat: "Economic", title: "Market share holds", body: "Politically resilient operators retain footprint, lower ROIC.", year: "2030", strength: 0.7 },
      { id: "w8", phase: "real", cat: "Social", title: "Local talent leads", body: "Foreign exec presence falls below 10% in SEA.", year: "2030", strength: 0.6 },
    ],
    edges: [
      { from: "w1", to: "w3", relationship: "Leads to", confidence: "Moderate" },
      { from: "w2", to: "w3", relationship: "Amplifies", confidence: "Strong" },
      { from: "w2", to: "w4", relationship: "Enables", confidence: "Strong" },
      { from: "w3", to: "w4", relationship: "Amplifies", confidence: "Moderate" },
      { from: "w3", to: "w5", relationship: "Leads to", confidence: "Strong" },
      { from: "w3", to: "w6", relationship: "Leads to", confidence: "Strong" },
      { from: "w4", to: "w6", relationship: "Enables", confidence: "Moderate" },
      { from: "w5", to: "w7", relationship: "Leads to", confidence: "Moderate" },
      { from: "w6", to: "w7", relationship: "Leads to", confidence: "Strong" },
      { from: "w6", to: "w8", relationship: "Amplifies", confidence: "Moderate" },
    ],
  },
  sc4: {
    title: "Bamboo Curtain",
    summary: "Worst case: blocs harden, decoupling accelerates. Preserve optionality.",
    confidence: 0.18,
    phases: [
      { id: "prec", range: "Late 2026", desc: "Sino-Western tensions spike." },
      { id: "cat", range: "Q2 2027", desc: "Sanctions regime broadens." },
      { id: "first", range: "2027 – 2028", desc: "Markets bifurcate." },
      { id: "second", range: "2028 – 2029", desc: "SEA aligns into blocs." },
      { id: "real", range: "2029 – 2030", desc: "Strategic pullback, preserve optionality." },
    ],
    nodes: [
      { id: "b1", phase: "prec", cat: "Political", title: "Taiwan tensions spike", body: "Naval incident escalates into 90-day standoff.", year: "Late 2026", strength: 0.7 },
      { id: "b2", phase: "cat", cat: "Political", title: "Sino-Western relations rupture", body: "Comprehensive sanctions across tech, finance, shipping.", year: "Q2 2027", strength: 0.85 },
      { id: "b3", phase: "first", cat: "Economic", title: "Capital controls return", body: "Major SEA economies reimpose FX restrictions.", year: "2027", strength: 0.75 },
      { id: "b4", phase: "first", cat: "Technology", title: "Cross-border cloud sanctions", body: "Cloud services blocked across rival blocs; data must localise.", year: "Q4 2027", strength: 0.9 },
      { id: "b5", phase: "second", cat: "Political", title: "Tech sanctions hit consumer", body: "Consumer-facing services swept into sanction regimes.", year: "2028", strength: 0.8 },
      { id: "b6", phase: "second", cat: "Political", title: "SEA forced to pick sides", body: "Bilateral alignment for Indonesia, Vietnam, Philippines.", year: "2028", strength: 0.85 },
      { id: "b7", phase: "second", cat: "Economic", title: "Currency volatility 20%+", body: "Cross-border ops unviable for many revenue lines.", year: "2029", strength: 0.7 },
      { id: "b8", phase: "real", cat: "Economic", title: "Pullback from 2 SEA markets", body: "Indonesia and Philippines exited; Vietnam/Singapore consolidated.", year: "2029-30", strength: 0.85 },
      { id: "b9", phase: "real", cat: "Economic", title: "Optionality via minority stakes", body: "Hold passive positions in local champions; await regime shift.", year: "2030", strength: 0.65 },
    ],
    edges: [
      { from: "b1", to: "b2", relationship: "Leads to", confidence: "Strong" },
      { from: "b2", to: "b3", relationship: "Leads to", confidence: "Strong" },
      { from: "b2", to: "b4", relationship: "Leads to", confidence: "Strong" },
      { from: "b3", to: "b5", relationship: "Amplifies", confidence: "Moderate" },
      { from: "b3", to: "b7", relationship: "Leads to", confidence: "Strong" },
      { from: "b4", to: "b5", relationship: "Leads to", confidence: "Strong" },
      { from: "b4", to: "b6", relationship: "Leads to", confidence: "Moderate" },
      { from: "b5", to: "b8", relationship: "Leads to", confidence: "Strong" },
      { from: "b6", to: "b8", relationship: "Amplifies", confidence: "Strong" },
      { from: "b7", to: "b8", relationship: "Amplifies", confidence: "Moderate" },
      { from: "b6", to: "b9", relationship: "Enables", confidence: "Moderate" },
    ],
  },
};

export const CAT_STYLE: Record<SteepCategory, { bg: string; fg: string; dot: string }> = {
  Social: { bg: "#F5F3FF", fg: "#8B5CF6", dot: "#8B5CF6" },
  Technology: { bg: "#EFF6FF", fg: "#3B82F6", dot: "#3B82F6" },
  Economic: { bg: "#ECFDF5", fg: "#10B981", dot: "#10B981" },
  Ecological: { bg: "#F0FDFA", fg: "#14B8A6", dot: "#14B8A6" },
  Political: { bg: "#FEF2F2", fg: "#EF4444", dot: "#EF4444" },
};

const SOURCE_POOL: Record<SteepCategory, string[]> = {
  Political: ["Reuters", "FT", "Nikkei", "Politico", "AP"],
  Technology: ["Gartner", "IDC", "MIT Tech Review", "Wired"],
  Economic: ["Bloomberg", "World Bank", "Economist", "WSJ"],
  Social: ["Deloitte", "Pew", "Edelman"],
  Ecological: ["IPCC", "Bloomberg Green", "Carbon Brief"],
};

const PHASE_UNCERTAINTY: Record<string, Array<"High" | "Medium" | "Low">> = {
  prec: ["High", "High", "High", "Medium"],
  cat: ["High", "Medium", "Medium"],
  first: ["High", "Medium", "Medium", "Medium", "Low"],
  second: ["Medium", "Medium", "Medium", "Low", "Low"],
  real: ["Medium", "Low", "Low", "Low"],
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

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function enrichNode(node: StoryNode): StoryNode {
  const sources = SOURCE_POOL[node.cat] || ["Internal"];
  const uPool = PHASE_UNCERTAINTY[node.phase] || ["Medium"];
  const h = hash(node.id);
  return {
    ...node,
    source: node.source || sources[h % sources.length],
    uncertainty: node.uncertainty || uPool[h % uPool.length],
    impact: node.impact || Math.max(1, Math.min(5, Math.round((node.strength || 0.6) * 5))),
  };
}

export const edgeKey = (e: { from: string; to: string }) => e.from + ">" + e.to;

export const QUADRANT_LABELS: Record<Quadrant, string> = {
  TL: "Predetermined",
  TR: "Critical",
  BL: "Background",
  BR: "Wildcards",
};

export const AXES = { x: "Geopolitical Alignment", y: "Market Openness" };

export const SIGNPOSTS_BY_SCENARIO: Record<string, string[]> = {
  sc1: [
    "ASEAN customs harmonisation bill clears committee",
    "Singapore talent visa scheme exceeds 50K issued",
    "Enterprise AI capex run-rate crosses $40B in SEA",
    "US-China standards working group reconvenes",
  ],
  sc2: [
    "Second SEA country adopts Indonesia-style data residency",
    "Vietnam dong band breached for two consecutive quarters",
    "First Western hyperscaler announces sovereign-cloud variant",
    "Federated reference architecture appears in industry RFP",
  ],
  sc3: [
    "US-China bilateral working group resumes formal talks",
    "Local-equity floor proposed in Indonesian draft law",
    "National AI compute capacity announcement (any SEA market)",
    "Foreign equity caps debated in Vietnamese parliament",
  ],
  sc4: [
    "Naval incident in Taiwan Strait escalates beyond 14 days",
    "Capital controls reintroduced in any major SEA market",
    "Consumer-facing cloud service added to sanction list",
    "Reuters reports SEA alignment summit invitations",
  ],
};

export const GAP_BY_SCENARIO: Record<string, { from: string; to: string; suggest: string }> = {
  sc1: { from: "ASEAN unlocks digital trade pact", to: "Enterprise AI capex +40% YoY", suggest: "policy-pilot announcements, cross-border procurement RFPs" },
  sc2: { from: "Indonesia sovereign cloud rule", to: "Federated architecture as default", suggest: "vendor lane-pick announcements, reference customer migrations" },
  sc3: { from: "Local-for-local mandates", to: "JV-first becomes the rule", suggest: "minority-stake deal flow, foreign-equity cap debates" },
  sc4: { from: "Cross-border cloud sanctions", to: "Pullback from 2 SEA markets", suggest: "tariff retaliation events, manufacturing relocation announcements" },
};

const CONFIDENCE_WEIGHT: Record<string, number> = { Strong: 1, Moderate: 0.65, Weak: 0.3 };

export function computeChainStrength(nodes: StoryNode[], edges: StoryEdge[]) {
  if (!nodes.length) return { pct: 0, signalCount: 0, confidence: 0 };
  const evidence = edges.reduce((sum, e) => sum + (CONFIDENCE_WEIGHT[e.confidence] || 0.5), 0);
  const density = Math.min(1, evidence / Math.max(1, nodes.length * 1.5));
  const confidence = Math.round(density * 100);
  const pct = Math.min(100, Math.round((nodes.length / 14) * 50 + density * 50));
  return { pct, signalCount: nodes.length, confidence };
}
