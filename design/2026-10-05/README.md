# Scenaric — Decisions handoff (Monitoring, Strategy, Home CEO view)

This package turns Monitoring and Strategy into an action loop. Events are tracked, the changes are traced to scenarios, recommendations are made, and the user steers toward a chosen target future. A visual CEO view on Home summarises it all.

Run the packages **in order**. Each folder holds a `PROMPTS.md` with self-contained prompts for Claude Code. Paste them **one prompt per message**, and finish one package before starting the next. Where a folder has a standalone HTML, that file is the visual and behavioural reference. Open it in a browser: the UI is final, and only the data layer is mock.

| # | Folder | What it delivers | Reference HTML |
|---|---|---|---|
| 01 | `01-shared-decision-layer/` | Tables, RLS, the daily scan job, roll-up maths, action-card engine, shared UI pieces | `decision-data.js` (seed + model spec) |
| 02 | `02-monitoring/` | Monitoring v2 page | `Monitoring Standalone.html` |
| 03 | `03-strategy/` | Strategy v2 page | `Strategy Standalone.html` |
| 04 | `04-home-ceo-view/` | Home CEO view, plus the Setup/CEO switch | `Home CEO View Standalone.html` |
| 05 | `05-nav-and-labels/` | Nav order, "+ Add Signal" removal, Storyline wording | none (small edits) |

## Prerequisites
- Signals Library v2 and Matrix v2 (`CLAUDE_CODE_MATRIX_V2_PROMPTS.md`) are merged. Events, forces, poles and event-to-force links must exist.
- Storyline nodes can link to events.

## Methodology guardrails (apply to every prompt)
1. **Likelihood belongs to events only.** A scenario never gets a probability or a percentage. Scenarios get *momentum*: relative evidence, labelled Building / Edging up / Steady / Easing / Fading.
2. **A target future is a strategic choice** stored on the strategy, never a score on the scenario. All four scenarios stay visible, and every option is wind-tunnelled across all four.
3. **Every recommendation cites its evidence**: an event, a signpost or a news item.
4. **External findings stay unconfirmed until a person accepts them.** Nothing found by the daily scan enters the project automatically.
5. Events that fit no force can lead to a new force, then a Matrix check, then a re-axis. The re-axis workflow and the historic snapshot from Matrix v2 are reused, not rebuilt.

## The loop
News → event likelihood changes → scenario momentum, storyline progress and signposts → threshold crossed → action card → accepted in Strategy → route move status changes → shown on Home and in the briefing. New, unmatched events go to the Signals inbox, and from there possibly to a re-axis.
