// Settings-only copy for Settings → Project's "Onboarding answers" section
// (design/settings_onboarding_handoff/). Deliberately a SEPARATE module from onboarding's own
// src/app/onboarding/focal-interview-blocks.ts — that file's ids must match OnboardingState's
// blockA-D field names (store.tsx) for the live wizard; this one's ids match the token names
// src/lib/actions/projects.ts's OnboardingAnswers/getOnboardingAnswers already use
// (awake/decision/owner/stakes/o1-3/good/bad/turns/given/open/actors), since that's the shape
// this section reads and writes through. Same real question wording as onboarding — not a
// copy change, just a second, differently-keyed view onto it.
export interface InterviewQuestion {
  id: string;
  q: string;
  big?: boolean;
  opt?: boolean;
}

export interface InterviewBlock {
  tag: "A" | "B" | "C" | "D";
  eyebrow: string;
  intro: string;
  qs: InterviewQuestion[];
}

export const INTERVIEW: InterviewBlock[] = [
  {
    tag: "A",
    eyebrow: "THE FOCAL DECISION",
    intro: "Let's start with a real pending decision, not an industry topic.",
    qs: [
      { id: "awake", q: "What keeps you awake at night?", big: true },
      { id: "decision", q: "What decision are you facing that will still matter in 5-10 years?", big: true },
      { id: "owner", q: "Who actually makes that decision, and by when?" },
      { id: "stakes", q: "If you get this wrong, what breaks?" },
    ],
  },
  {
    tag: "B",
    eyebrow: "THE UNKNOWNS",
    intro:
      "Imagine you had an oracle that would answer truthfully about the future of your business. What would you ask it? Your questions are the real uncertainties.",
    qs: [
      { id: "o1", q: "Question 1" },
      { id: "o2", q: "Question 2", opt: true },
      { id: "o3", q: "Question 3", opt: true },
    ],
  },
  {
    tag: "C",
    eyebrow: "GOOD & BAD OUTCOMES",
    intro: "Now stand at the end of your horizon and look back. I want both endings, and the road to each.",
    qs: [
      { id: "good", q: "It has gone as well as it realistically could. Describe it — and what got you there.", big: true },
      { id: "bad", q: "Same year, it has gone badly. Describe it — and the pivotal events.", big: true },
      { id: "turns", q: "Looking back from there, what turning points would you have wanted to see coming?", big: true },
    ],
  },
  {
    tag: "D",
    eyebrow: "PREDETERMINED VS UNCERTAIN",
    intro: "Last block — this one separates what's already baked in from what's genuinely open. It also seeds your key forces.",
    qs: [
      { id: "given", q: "What's effectively inevitable over that horizon?", big: true },
      { id: "open", q: "What's genuinely uncertain — and would change your decision if it went either way?", big: true },
      { id: "actors", q: "Which customers, suppliers, competitors or regulators do you depend on but don't control?", big: true },
    ],
  },
];
