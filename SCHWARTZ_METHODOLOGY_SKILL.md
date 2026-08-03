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
mechanism for that step: an AI-sequenced, ordered narrative of events for ONE
scenario (one matrix quadrant), showing how today's world plausibly reaches that
specific end state. Treat it as an implementation choice in service of step 6, not
an independent step, and hold it to the same rigor:

- **It belongs to step 6, always.** Never number it as its own tile or imply Schwartz
  described a "storyline" step — the 8/9-tile count above does not change.
- **"Signal," "driving force," and "rank force" are the same thing.** Any force that
  was identified in step 3 and ranked in step 4 — whether or not it became one of
  the project's 2 scenario axes. Use these terms interchangeably; don't invent a
  fourth name for the same concept.
- **Built from the signals OTHER than the axes.** The 2 signals selected as this
  project's scenario axes define the quadrant itself (that's step 4/5's job, already
  done by the time Storyline runs) — Storyline's job is explaining how you plausibly
  get there using the *rest* of the signal library (plus predetermined elements).
  A storyline auto-suggest/find-signal call must exclude the project's current axis
  signals from its candidate pool; including them is a bug, not a richer chain.
- **Strictly grounded, never freeform — for AI output.** Every AI-generated node must
  trace to a real signal/insight via `signal_insight_links`, or to a predetermined
  element. No AI-generated node may be invented prose with no underlying project
  data — that risks contradicting the Narrative page and breaks the same
  anti-hallucination discipline used everywhere else. A human manually editing their
  own storyline node is not bound by this — they're accountable for what they type
  the same way any other manual data entry is; this rule constrains the model, not
  the user.
- **The same signal can, and usually does, appear in multiple sibling scenarios'
  storylines.** Nothing about being used in one scenario's chain excludes a signal
  from another's — each of the 4 scenarios can legitimately draw on overlapping
  parts of the same signal library, playing a different role/sequence position in
  each, because each scenario is still a different end-state even when some of the
  same forces are in play. Never treat "already used elsewhere" as a reason to
  exclude a signal from a scenario's own storyline (only THIS scenario's own
  already-used signals should be excluded from its own gap-filling suggestions).
- **One-directional causality, fixed phases.** A node in phase N may only justify
  nodes in phase N or later — never backward. The 5 phases (Precursors → Catalysts →
  First-order effects → Second-order effects → Scenario realized) are fixed, never
  renamed or reordered per scenario. This is an endpoint-level invariant, not just an
  AI-output-filtering step — manual edits that would create a backward edge must be
  rejected too, not silently allowed because a human made the edit.
- **Consistency with Narrative.** Storyline and the Narrative page's prose must tell
  the same causal story for a given scenario — if they diverge, that's a bug, not
  acceptable creative variance between two views.
- **Thin chains are a signal, not just a display issue.** Fewer than 4 total nodes on
  a scenario's storyline is a sign the scenario isn't adequately grounded yet — surface
  it (`thin_chain`/`thinChain` on the read path), don't let the UI render a sparse
  chain silently as if it were a deliberate, complete result.
- **Doubles as future indicator groundwork.** The causal chain Storyline builds is
  the same territory step 8 (indicators) draws from — keep the data model shared
  (signals/insights linked to scenario + phase) so indicators can be derived from
  real storyline nodes later, not re-invented from scratch.

## Signpost — a non-canonical, live-news-grounded cousin of step 8, not step 8 itself

Step 8 in the table above is Schwartz's own "selection of leading indicators" —
static, generated once per scenario as part of the normal build order, gated into
`steps_complete`. **Signpost is a different, product-level addition**: a
scenario-specific early-warning indicator generated on demand from the Storyline
page, using AI + a live web search, not the build-order indicator step. Do not
conflate the two, store them in the same table, or let UI copy imply Signpost
satisfies the step-8 gate.

- **Scenario-specific and discriminating**, same rule as step 8's own indicators:
  reject any candidate that would equally well signal a sibling scenario — a
  signpost that fits every quadrant isn't one.
- **Checkable, dated, or thresholded**, same phrasing discipline as step 8 — never a
  vague directional claim.
- **Grounded in real, live citations, not the project's own stored data.** This is
  the one place in the product where "grounded" means real-time web search results
  (URL + title) rather than the project's signals/insights — cite what was actually
  found, never a fabricated source.
- **Always labeled as the product's own extension**, same as Strategic Options —
  never implied to be Schwartz's step 8 itself in UI copy or docs.

## Plausibility / confidence score — live, re-checkable, and separate from `scenarios.plausible`

`scenarios.plausible` (step 5's own boolean + `implausibility_note`) is a **static**
judgment made once, at scenario-build time, about whether a quadrant's axis-pole
combination is internally coherent (see step 5's hard constraints below). It is
never re-evaluated after the scenario is built.

**Plausibility score is a different, separate, product-level concept**: a live
estimate (0-100 + rationale + citations) of how plausible a scenario currently
looks *given the state of the world right now*, generated via AI + live web search,
explicitly re-checkable and expected to shift over time as real-world events unfold.
Never store it in or derive it from `scenarios.plausible`, and never present a stale
plausibility check as current without a visible "last checked" timestamp — the whole
point of this concept is that yesterday's check can be wrong today.

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
