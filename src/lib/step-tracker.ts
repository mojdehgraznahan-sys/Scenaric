// The 9-tile methodology tracker shown on the Home dashboard (page-dashboard.tsx) — shared
// with server-side code (ai-home-tasks.ts's explain_progress) so both walk the exact same
// tiles the user actually sees, rather than a second, independently-drifting copy. Plain
// constants only, no "use client"/"use server" — safe to import from either side.
export const STEP_LABELS = [
  "Focal question",
  "Key forces",
  "Driving forces",
  "Rank forces",
  "Scenario logics",
  "Narratives",
  "Implications",
  "Monitoring",
  "Strategy",
];
// "Narratives" and "Implications" both used to route to the old Narrative page; that page is
// retired (design/storyline_handoff/) and Futures now owns narrative generation/reading.
// "Implications" has no direct replacement page (Strategy still reads the implications table,
// but nothing generates new rows since Narrative's "Generate implications" button is gone) —
// routing it to Futures is the closest-available destination, not a perfect fit.
export const STEP_ROUTES = ["/settings", "/knowledge", "/signals", "/matrix", "/futures", "/futures", "/futures", "/monitoring", "/strategy"];
// Maps each of the 9 tracker tiles to the canonical 8-step count used by the Projects
// dashboard (Key forces + Driving forces both complete once step 2 is reached).
export const STEP_GATE = [1, 2, 2, 3, 4, 5, 6, 7, 8];
