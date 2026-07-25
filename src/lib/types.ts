// Scenaric.ai data model — derived from the prototype data.js (window.FM_DATA)

export type SteepCategory =
  | "Social"
  | "Technology"
  | "Economic"
  | "Ecological"
  | "Political";

export type Quadrant = "TL" | "TR" | "BL" | "BR";

export interface Project {
  name: string;
  role: string;
  focal_question: string;
  horizon: string;
  industry: string;
  summary: string;
  created: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  focal_question: string;
  horizon: string;
  industry: string;
  summary?: string;
  created?: string;
  stepsComplete: number;
  lastEdited: string;
  archived: boolean;
}

export interface Stats {
  sources: number;
  interviews: number;
  insights: number;
  voices: number;
  signals: number;
  scenarios: number;
  indicators: number;
}

export interface Source {
  id: string;
  name: string;
  type: "doc" | "audio" | "survey";
  status: "Complete" | "Processing";
  progress: number;
}

export interface Interview {
  id: string;
  initials: string;
  name: string;
  role: string;
  avatar_bg: string;
  avatar_fg: string;
  tag: SteepCategory;
  status: "Complete" | "Processing";
  quote: string;
}

export interface Signal {
  id: string;
  category: SteepCategory;
  source: string;
  title: string;
  // Nullable: a manually-added or freshly-AI-suggested signal can sit unscored
  // until it goes through impact/uncertainty scoring.
  impact: number | null;
  uncertainty: "Low" | "Medium" | "High" | null;
  body: string;
}

export interface Scenario {
  id: string;
  name: string;
  quadrant: Quadrant;
  color: string;
  tagline: string;
  summary: string;
  narrative: string;
  archived?: boolean;
  reaxedAt?: number; // timestamp set when scenario axes were migrated (re-axis)
}

export interface MatrixDot {
  id: string;
  sigId: string;
  x: number; // 0..100 percent (0 = left)
  y: number; // 0..100 percent (0 = top)
  label: string;
  color: string;
  category: SteepCategory;
  selected?: boolean;
}

export interface Indicator {
  id: string;
  name: string;
  scenario: string;
  status: "Watch" | "Alert" | "On track";
  trend: string;
  note: string;
}

export interface Strategy {
  id: string;
  name: string;
  robustIn: string[];
  risk: "Low" | "Medium" | "High";
  cost: "Low" | "Medium" | "High";
  notes: string;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  time: string;
  impact: "HIGH" | "MID";
}

export interface RecommendedAction {
  title: string;
  body: string;
}

export interface ChatMessage {
  role: "ai" | "user";
  text: string;
}

export interface ScenaricData {
  project: Project;
  projects: ProjectSummary[];
  stats: Stats;
  sources: Source[];
  interviews: Interview[];
  insights: string[];
  signals: Signal[];
  scenarios: Scenario[];
  axes: { x: string; y: string };
  quadrants: Record<Quadrant, string>;
  matrix_dots: MatrixDot[];
  indicators: Indicator[];
  strategies: Strategy[];
  news: NewsItem[];
  recommended: RecommendedAction[];
  chat_seed: ChatMessage[];
}
