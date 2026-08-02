# Skill: Schwartz Scenario-Planning Methodology Guardrail

Use this skill whenever building, editing, or reviewing ANY page, endpoint, or AI
prompt in Scenaric. It keeps the product loyal to Peter Schwartz's 8-step method
from "The Art of the Long View," extended by Scenaric's one product addition
(Strategic Options). Do not deviate from these definitions to make a feature
"feel richer" — precision to the method is the product's core value proposition.

## The 8 steps (book) + Scenaric's 9th tile

| # | Schwartz's step (book definition) | Scenaric tile | Must NOT be confused with |
|---|---|---|---|
| 1 | Identify the focal issue or decision — a real pending decision, bounded by a stated time horizon, specific about who decides and what changes | Focal question | A generic industry topic ("the future of X") |
| 2 | Key forces in the local/task environment — customers, suppliers, competitors, regulators the org directly interacts with | Key forces | Macro/STEEP trends (that's step 3) |
| 3 | Driving forces — macro-environmental forces (Social, Technological, Economic, Ecological, Political) outside the org's direct control | Driving forces | Local actors/stakeholders (step 2) |
| 4 | Rank by importance and uncertainty — plot all forces; the 2 most important AND most uncertain become axes; everything else sorts into Predetermined/Background/Wildcard | Rank forces | Picking axes by narrative interest instead of the impact×uncertainty rule |
| 5 | Select scenario logics — the causal argument for why each 2×2 quadrant is an internally coherent world, not just two adjectives mashed together | Scenario logics | Just naming/labeling quadrants without a mechanism |
| 6 | Flesh out the scenarios — full causal chain from today's precursors to the realized future, written as history remembered from the future | Narrative (+ Storyline, see below) | Implications (step 7) or indicators (step 8) |
| 7 | Implications — what each scenario means for the actual focal decision | Implications | Restated scenario facts; must be decision-actionable |
| 8 | Selection of leading indicators / signposts — concrete, checkable, near-term events that reveal which scenario is unfolding, and that discriminate between scenarios | Indicators | Vague directional claims ("regulation increases") |
| + | (not in the book — product extension, standard GBN/Shell "wind-tunnelling" practice) | Strategic options | Never present this as if Schwartz named it a formal step — always flag it as an extension |

## Storyline — a non-canonical visualization of step 6, not a new step

The book never prescribes a concrete artifact for "flesh out the scenarios" beyond
writing the narrative as remembered history. Storyline is Scenaric's own visual
mechanism for that step: a causal chain/timeline of signals and events showing how
today's world reaches one specific scenario. Treat it as an implementation choice
in service of step 6, not an independent step, and hold it to the same rigor:

- **It belongs to step 6, always.** Never number it as its own tile or imply Schwartz
  described a "storyline" step — the 8/9-tile count above does not change.
- **Strictly grounded, never freeform.** Every node must trace to a real signal/insight
  via `signal_insight_links`, or to a predetermined element. No node may be invented
  prose with no underlying project data — that risks contradicting the Narrative page
  and breaks the same anti-hallucination discipline used everywhere else.
- **One-directional causality, fixed phases.** A node in phase N may only justify
  nodes in phase N or later — never backward. The 5 phases (Precursors → Catalysts →
  First-order effects → Second-order effects → Scenario realized) are fixed, never
  renamed or reordered per scenario.
- **Consistency with Narrative.** Storyline and the Narrative page's prose must tell
  the same causal story for a given scenario — if they diverge, that's a bug, not
  acceptable creative variance between two views.
- **Thin chains are a signal, not just a display issue.** If a scenario's storyline
  skips from present-day signals straight to the realized end-state with no
  intermediate nodes, treat that as a sign the scenario logic (step 5) isn't
  adequately grounded yet — flag it rather than letting the UI render a sparse chain
  silently.
- **Doubles as future indicator groundwork.** The causal chain Storyline builds is
  the same territory step 8 (indicators/signposts) draws from — keep the data model
  shared (signals/insights linked to scenario + phase) so indicators can be derived
  from real storyline nodes later, not re-invented from scratch.

## Hard constraints (never violate these when building any page/endpoint)

- **Exactly 2 axes, 4 quadrants.** Never let a scenario set drift to 3 axes or fewer/more than 4 scenarios per axis-set.
- **Axes must come from the high-impact/high-uncertainty quadrant of the Rank Forces matrix.** Never let a UI/endpoint allow picking axes from Predetermined or Background/Wildcard quadrants.
- **Axes must be independent.** Every axis-pair selection must pass (or flag) the orthogonality/independence check before "Build Scenario Matrix" is enabled. Correlated axes collapsing to 2 effective scenarios is a methodology violation, not a style choice.
- **Storyline causal ordering is one-directional.** A node in phase N may only justify nodes in phase N or later — never backward. The 5 phases (Precursors → Catalysts → First-order effects → Second-order effects → Scenario realized) are fixed, never renamed or reordered per scenario.
- **Predetermined elements hold across all 4 quadrants.** They must never contradict any one scenario's logic — check this explicitly whenever generating scenario logics.
- **Indicators must discriminate.** An indicator that would equally signal two different scenarios fails the step-8 definition and should be rejected, not just deprioritized.
- **Every AI output is grounded or explicitly flagged as inference/external.** No step's AI output may present unsourced content as if it were derived from the project's own data — see the anti-hallucination scaffold in `Scenaric Backend Build Plan.html` §3.
- **Strategic Options is always labeled as the product's own extension**, never implied to be part of Schwartz's 8 named steps, in UI copy, onboarding, and docs.

## When reviewing or building a feature, check:

1. Which of the 9 tiles does this feature belong to? State it explicitly.
2. Does its behavior match that step's book definition above — not a generic "AI brainstorm" version of it?
3. Does it respect the hard constraints list (2×2, ordering, discrimination, grounding)?
4. Does its copy/UI language use Schwartz's own terms (focal question, driving forces, scenario logic, signposts) rather than inventing new terminology for the same concept?
5. If uncertain whether a proposed feature fits the method at all, flag it and ask rather than building a plausible-sounding but non-canonical addition.

Reference: `Scenaric Backend Build Plan.html` in this project has the full data model, endpoints, and per-step AI prompts already built to this spec — treat it as the executable version of this skill.
