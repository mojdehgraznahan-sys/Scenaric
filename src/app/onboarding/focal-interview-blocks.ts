// Static copy for onboarding's Step 1 interview (focal-interview.tsx) — kept separate from
// the component so it stays about state/flow, not copy. Question `id`s must exactly match the
// field names of OnboardingState's blockA/blockB/blockC/blockD (store.tsx) — FocalInterview
// indexes into those objects by these ids.

export const EYEBROW = "mb-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-brand-orange";

export const INDUSTRIES = ["Technology", "Financial Services", "Energy", "Healthcare", "Consumer Goods", "Public Sector"];

export const INTRO_COPY = {
  title: "Let's shape your focal question",
  subtitle: "Four short blocks of questions — the decision, the unknowns, both endings, then what's fixed versus open.",
  calloutTitle: "Who's this for, and what industry are they in? I'll research recent competitor moves, regulation, and market trends while we talk.",
};

export interface BlockQuestionCopy {
  id: string;
  label: string;
  placeholder?: string;
  optional?: boolean;
}

export interface BlockCopy {
  id: "A" | "B" | "C" | "D";
  stepperLabel: string;
  intro: string;
  questions: BlockQuestionCopy[];
  continueLabel: string;
}

export const FOCAL_INTERVIEW_BLOCKS: BlockCopy[] = [
  {
    id: "A",
    stepperLabel: "A · The focal decision",
    intro: "Let's start with a real pending decision, not an industry topic.",
    questions: [
      { id: "keepsAwake", label: "What keeps you awake at night?", placeholder: "e.g. committing to the wrong region and not being able to reverse it" },
      {
        id: "decision5to10yr",
        label: "What decision are you facing that will still matter in 5-10 years?",
        placeholder: "e.g. whether and how to enter Southeast Asia",
      },
      { id: "ownerAndDeadline", label: "Who actually makes that decision, and by when?", placeholder: "e.g. the executive team, board sign-off by Q2 2027" },
      { id: "ifWrongBreaks", label: "If you get this wrong, what breaks?", placeholder: "e.g. two years of capital and our credibility in APAC" },
    ],
    continueLabel: "Continue",
  },
  {
    id: "B",
    stepperLabel: "B · The unknowns",
    intro:
      "Imagine you had an oracle that would answer truthfully about the future of your business. What would you ask it? Your questions are the real uncertainties.",
    questions: [
      { id: "oracleQ1", label: "Question 1", placeholder: "e.g. will Indonesia's ownership rules hold through 2032?" },
      { id: "oracleQ2", label: "Question 2", placeholder: "e.g. who will own the distribution layer?", optional: true },
      { id: "oracleQ3", label: "Question 3", placeholder: "e.g. what will capital cost us?", optional: true },
    ],
    continueLabel: "Continue",
  },
  {
    id: "C",
    stepperLabel: "C · Good & bad outcomes",
    intro: "Now stand at the end of your horizon and look back. I want both endings, and the road to each.",
    questions: [
      { id: "bestCaseAndPath", label: "It has gone as well as it realistically could. Describe it — and what got you there." },
      { id: "worstCaseAndPivots", label: "Same year, it has gone badly. Describe it — and the pivotal events." },
      { id: "turningPoints", label: "Looking back from there, what turning points would you have wanted to see coming?" },
    ],
    continueLabel: "Continue",
  },
  {
    id: "D",
    stepperLabel: "D · Predetermined vs uncertain",
    intro: "Last block — this one separates what's already baked in from what's genuinely open. It also seeds your key forces.",
    questions: [
      {
        id: "inevitable",
        label: "What's effectively inevitable over that horizon?",
        placeholder: "e.g. demographics, installed base, committed capital, physics",
      },
      { id: "genuinelyUncertain", label: "What's genuinely uncertain — and would change your decision if it went either way?" },
      { id: "dependencies", label: "Which customers, suppliers, competitors or regulators do you depend on but don't control?" },
    ],
    continueLabel: "Draft my focal question",
  },
];

export const SKIP_BLOCK_LABEL = "Skip this block";
export const BLOCK_HELPER_TEXT = "Answer specifically — vague answers make vague scenarios.";
export const CANDIDATES_HEADING = "Drawn from your answers — pick the framing that's truest:";
export const PICKED_FOCAL_PROMPT = "Here's a focal question drawn from your answers — use it, or pick a different framing?";
