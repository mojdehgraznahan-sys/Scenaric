# Handoff: Scenaric Backend (AI Scenario-Planning Engine)

## Overview
Scenaric is an AI-powered scenario-planning tool implementing Peter Schwartz's
"The Art of the Long View" methodology, extended with a 9th "Strategic
Options" step. This handoff is for building the **backend and AI layer**
behind an existing frontend prototype — data model, multi-project support,
and grounded/schema-enforced AI prompts for every methodology step.

## About the Design Files
Everything under `prototype/` is an **HTML/React (Babel, in-browser) design
reference** — a working click-through prototype with simulated data and
canned AI responses (see `data.js` and the `cannedReplies` array in
`ask-ai.jsx`). It is not production code. The task is to:
1. Recreate this frontend in the target codebase's real framework/build
   pipeline (or choose an appropriate one if none exists yet), preserving
   its exact layout, components, and interaction patterns.
2. Build the real backend + AI endpoints described in
   `Scenaric Backend Build Plan.html`, replacing every hardcoded/simulated
   value in `data.js` and every canned reply with live, grounded AI calls.

## Fidelity
**High-fidelity.** The prototype's layout, spacing, copy, colors, and
interaction states (drag-to-place matrix dots, causal-chain canvas,
stepper modals, etc.) are final design intent — recreate them precisely.
The AI *behavior* (what each button triggers, what it returns) is
specified in the build plan doc, not the prototype's canned code.

## Primary reference: `Scenaric Backend Build Plan.html`
Open this file first. It contains, in order:
- §1 — Mapping of Schwartz's 8 book steps → Scenaric's 9 UI tiles → pages.
- §2 — Full multi-project data model (every table, scoped by `project_id`).
- §3 — The shared anti-hallucination prompt scaffold used by every AI call
  (structured JSON output, `grounded_in` citations, `sufficient_evidence`
  escape hatch, schema validation with retry-once).
- §4–§12 — One section per methodology step, each with: the exact endpoint(s),
  the trigger (which button/page action calls it), and the full strict
  system prompt + JSON output schema for that step's AI call.
- §13 — Cross-cutting concerns: the Ask AI chat endpoint (replacing
  `ask-ai.jsx`'s canned replies) and server-derived project progress
  (`steps_complete`, replacing the client-set value in `data.js`).
- §14 — Recommended build order.

Implement the endpoints and prompts **as specified** — the schemas and
grounding rules are the anti-hallucination mechanism; do not loosen them
for convenience (e.g. don't drop `grounded_in`/`sufficient_evidence` fields
or switch to freeform text output).

## Screens / Pages (in the prototype)
| Page | File | Schwartz step |
|---|---|---|
| Landing | `components/landing.jsx` | — |
| Auth | `components/auth.jsx` | — |
| Onboarding (3-step wizard) | `components/onboarding.jsx` | Step 1 — Focal question |
| Projects dashboard | `components/page-projects.jsx` | multi-project home |
| Home / methodology tracker | `components/page-dashboard.jsx` | overview of all 9 tiles |
| Knowledge Base | `components/page-knowledge.jsx` | Step 2 — Key forces |
| Signals Library | `components/page-signals.jsx` | Step 3 — Driving forces |
| Impact × Uncertainty Matrix | `components/page-matrix.jsx` | Step 4 — Rank forces |
| Build/Re-axis Scenarios modals | `components/build-scenarios-modal.jsx`, `components/reaxis-modal.jsx` | Step 5 — Scenario logics |
| Storyline (causal chain canvas) | `components/page-storyline.jsx` | Step 6 — Narratives (causal graph) |
| Narrative (reading view + implications) | `components/page-narrative.jsx` | Steps 6–7 — Narratives, Implications |
| Monitoring | `components/page-monitoring-settings.jsx` (`PageMonitoring`) | Step 8 — Indicators |
| Settings | `components/page-monitoring-settings.jsx` (`PageSettings`) | project/account config |
| Strategy | `components/page-strategy.jsx` | Step 9 — Strategic options (product extension) |
| Ask AI (floating chat) | `components/ask-ai.jsx` | cross-cutting Q&A over project data |

## State Management
The prototype uses a single React Context (`StoreProvider` in `app.jsx`)
backed by `localStorage` (`usePersistentState`), keyed per browser, not
per real user/project in a database. The backend must replace every one
of these keys with server-side, project-scoped persistence — see the
data model in the build plan §2. Route/auth is a hash-based router
(`useRoute` in `app.jsx`); preserve the same route paths (`/app/signals`,
`/app/matrix`, etc.) when wiring to real navigation.

## Design Tokens
- Font: Geist (headings/body), Geist Mono (labels, numbers, badges) — see `styles.css`.
- Background: `#F5F5F5` (app shell), `#fff` (cards).
- Primary accent: `#F97316` (orange) / `#C2410C` (dark orange text-on-tint) / `#FFF7ED` (tint bg).
- Ink: `#1E1B2E` (near-black), `#374151`/`#6B7280`/`#9CA3AF` (text hierarchy).
- STEEP category colors: Social `#8B5CF6`, Technology `#3B82F6`, Economic `#10B981`, Ecological `#14B8A6`, Political `#EF4444`.
- Status colors: Alert `#EF4444`, Watch `#F59E0B`, On track/Complete `#10B981`.
- Border radius: 8–14px for cards/buttons, 999px for pills/avatars.
- Full CSS variables and utility classes: `prototype/styles.css`.

## Assets
No external image/icon assets — all icons are inline SVG in
`components/icons.jsx`. No brand/logo files beyond the inline SVG logo
mark in `icons.jsx` (`Icons.Logo`).

## Screenshots
`screenshots/` contains reference captures of the 8 main app pages
(Home, Knowledge Base, Signals Library, Matrix, Storyline, Narrative,
Strategy, Monitoring) for quick visual context without running the
prototype.

## Files in this bundle
- `Scenaric Backend Build Plan.html` — **primary spec**, open this first.
- `screenshots/` — reference screenshots of each page.
- `prototype/scenaric.html` — prototype entry point.
- `prototype/app.jsx` — router + global store (localStorage-backed).
- `prototype/data.js` — seed/simulated data; shows the exact shape every
  entity should have server-side (signals, scenarios, indicators, etc.).
- `prototype/styles.css` — design tokens and shared utility classes.
- `prototype/components/*.jsx` — one file per screen/modal, listed above.
