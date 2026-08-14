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
- **No desirability scoring on scenarios.** Schwartz's method treats all 4 quadrant logics as equally plausible futures to prepare for, not futures to rank by preference — scoring or labeling a scenario as "desirable"/"undesirable" reintroduces the motivated-reasoning bias the method exists to avoid. The only per-scenario judgment is `plausible`/`plausibility` (could this coherently occur). Desirability-adjacent judgment belongs only at the strategy level (Step 12/Strategic Options wind-tunnel scoring: how well a given strategy performs across all 4 scenarios) — never as a field, score, sort order, or badge on the scenario object itself.

## When reviewing or building a feature, check:

1. Which of the 9 tiles does this feature belong to? State it explicitly.
2. Does its behavior match that step's book definition above — not a generic "AI brainstorm" version of it?
3. Does it respect the hard constraints list (2×2, ordering, discrimination, grounding)?
4. Does its copy/UI language use Schwartz's own terms (focal question, driving forces, scenario logic, signposts) rather than inventing new terminology for the same concept?
5. If uncertain whether a proposed feature fits the method at all, flag it and ask rather than building a plausible-sounding but non-canonical addition.

Reference: `Scenaric Backend Build Plan.html` in this project has the full data model, endpoints, and per-step AI prompts already built to this spec — treat it as the executable version of this skill.

## Where research mode (live web/news) is allowed vs. forbidden

Deep research (live web/news lookups, external LLM knowledge) is powerful but must
only touch the method at two points — everywhere else, AI reasons closed-book over
the project's own already-grounded data.

| Step | Research allowed? | What it does here |
|---|---|---|
| 1. Focal question | No | Closed-book drafting/sharpening from user-provided text only |
| 2. Key forces (local) | **Yes — exploratory** | Scans for local-actor forces (customers/suppliers/competitors/regulators) the user hasn't uploaded anything about; lands as unconfirmed suggestions only |
| 3. Driving forces (macro/STEEP) | **Yes — exploratory** | Broad macro-trend sweep across STEEP categories; same unconfirmed-suggestion path as step 2 |
| 4. Rank forces | No | Deterministic scoring/bucketing over existing signals, temp=0 |
| 5. Scenario logics | No | Structured synthesis over the project's own axes/signals |
| 6. Narrative + Storyline | No (at generation time) | Reasons only over the project's grounded storyline/signal graph. News may enter earlier via the step-8 ingestion pipeline as a signal, never fetched live inside a narrative/storyline prompt |
| 7. Implications | No | Closed-book, grounded in the narrative's own text |
| 8. Indicators/signposts | **Yes — ongoing monitoring** | Daily ingestion job evaluates each indicator's status/trend against fresh news/geopolitical evidence; distinct from steps 2-3's one-shot exploratory research |
| + Strategic options | No | Closed-book over the project's own scenarios/implications; relies on step 8 to keep the world-model current, never re-fetches live data itself |

Rules that apply wherever research is allowed (steps 2, 3, 8):
- Every external suggestion is visibly labeled as external/inferred, never merged into project data silently.
- Steps 2/3 suggestions require explicit user confirmation before becoming a signal/insight.
- Step 8's ingestion job may update indicator status automatically, but every status change must cite the specific news item that triggered it (grounded_in on the reading row) — never an ungrounded model judgment.
- Research calls never happen inside steps 4-7 or Strategic Options, even opportunistically — if a feature request implies fetching live data inside one of those steps, flag it per the "when uncertain" checklist below rather than building it.

**One narrow, explicit exception:** Settings' "Ask AI about this project" freeform box has a
separate **"Research"** send action (distinct from its default "Send") that the user must
deliberately click — it's the only way Step 1 reasoning ever touches live web search
(`settings.research_chat` on `RESEARCH_MODE_ALLOWED_STEPS`, `askSettingsChat({ research: true })`
in `ai-settings-tasks.ts`/`ai-settings-chat.ts`). It answers one-off competitive/regulatory/
geopolitical/tariff/market questions and badges the answer as live-researched, unverified
content — it does not change the default closed-book "Send" path, and it is not itself a Step 1
generation prompt (it never drafts/sharpens/critiques the focal question). Don't treat this as
precedent for adding research to any other closed-book step without the same explicit,
user-invoked, clearly-labeled shape.
