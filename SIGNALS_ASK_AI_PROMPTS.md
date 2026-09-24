# Signals page — "Ask AI" canned prompts

Every prompt below is grounded in what the user already gave during onboarding. The interview answers are the highest-value input the product has and they are currently unused after Step 1 — these prompts spend them.

**Onboarding fields available for injection** (from `focal_interviews.answers` + `projects`):

| Token | Source | What it holds |
|---|---|---|
| `{focal}` | projects.focal_question | The chosen focal question |
| `{horizon}` | projects.horizon | e.g. "3–5 years" |
| `{industry}`, `{company}` | projects | Sector and org name |
| `{awake}` | A | What keeps them awake at night |
| `{decision}` | A | The decision that must be made |
| `{owner}` | A | Who decides, by when |
| `{stakes}` | A | What breaks if they get it wrong |
| `{o1} {o2} {o3}` | B | The three questions they'd ask an oracle |
| `{good}` `{bad}` `{turns}` | C | Best case, worst case, turning points |
| `{given}` | D | What they consider inevitable |
| `{open}` | D | What they consider genuinely uncertain |
| `{actors}` | D | Who they depend on but don't control |

**Methodology constraints** (per `SCHWARTZ_METHODOLOGY_SKILL.md`):
- Groups 1 and 2 are steps 2–3 → **research mode allowed**, output lands as *unconfirmed suggestions* requiring explicit confirmation.
- Groups 3 and 4 are step 4 → **closed-book, temp=0**, reasoning only over signals already in the project.
- Every AI output is labelled grounded / inferred / external. Never silently merged.

---

## Group 1 — Find signals I've missed (research on, unconfirmed suggestions)

### 1.1 "Scan for forces I haven't captured"
> The user's focal question is: `{focal}`, over a horizon of `{horizon}`, in `{industry}`.
>
> They have already captured these signals: `{existing_signal_titles}`.
>
> Identify 6–10 forces relevant to this focal question that are **absent** from that list. Split them into:
> - **Key forces (step 2)** — customers, suppliers, competitors, regulators this organisation directly interacts with.
> - **Driving forces (step 3)** — macro Social / Technological / Economic / Ecological / Political forces outside their control.
>
> Do not restate a force they already have in different words — check semantic overlap, not just string match. For each, give: one-sentence description, category, why it bears on this specific focal question (not the industry generally), and a source type. Mark every item as external/unverified.

### 1.2 "Turn my oracle questions into forces"
> During onboarding this user said that if an oracle would answer truthfully about their business, they would ask:
> 1. `{o1}` 2. `{o2}` 3. `{o3}`
>
> Each of those questions points at an underlying force whose outcome is unknown. For each question, name the force it implies, classify it as key force (local actor) or driving force (macro/STEEP), and describe the two or three ways it could plausibly resolve over `{horizon}`.
>
> These are the user's own stated unknowns — treat them as high-priority candidates, not speculation. Flag any that duplicate a signal already in the project.

### 1.3 "Profile the actors I don't control"
> The user named these as parties they depend on but do not control: `{actors}`.
>
> For each one, research and report: their current strategic posture, any recent moves or announced intentions relevant to `{focal}`, and the single most consequential thing they could do over `{horizon}` that would change this user's decision. Produce one candidate key force (step 2) per actor.
>
> Attribute every claim to a source type and label as external/unverified. If you find nothing substantive on an actor, say so — do not fill the gap with plausible-sounding generalities.

### 1.4 "What would make my worst case happen?"
> The user's stated worst case at the end of `{horizon}` is: `{bad}`. They said the pivotal turning points they'd want to see coming are: `{turns}`.
>
> Working backwards from that outcome, identify the forces that would have to move for it to materialise. Prioritise forces with observable present-day precursors over abstract risks. For each: name it, classify key vs driving, state the precursor that would be visible today, and note whether the project already has a signal covering it.

### 1.5 "Blind-spot sweep"
> Signals currently in this project cluster in these categories: `{category_distribution}`.
>
> Given the focal question `{focal}`, identify which STEEP categories are under-represented relative to what this decision actually depends on, then propose 2–3 forces in each thin category. Explicitly call out any category where thin coverage is *appropriate* rather than padding it — an under-weighted category is only a gap if the focal question depends on it.

---

## Group 2 — Sharpen what's already here (closed-book)

### 2.1 "Is this a force or an event?"
> Review every signal in this project. A force is a persistent driver that can resolve in more than one direction over `{horizon}`. An event is a single occurrence — usually evidence *for* a force, not a force itself.
>
> Flag each signal as force / event / ambiguous. For each event, name the underlying force it is evidence of, and propose merging it as supporting evidence rather than leaving it as a standalone signal. Do not modify anything — return recommendations only.

### 2.2 "Split the compound signals"
> Some signals bundle two independent things that could resolve in opposite directions ("regulatory and economic pressure"). These break the axis-independence requirement later.
>
> Identify every signal in this project that contains more than one independently-resolving driver, and propose the clean split. For each split, state whether the two halves are genuinely independent or correlated.

### 2.3 "De-duplicate"
> Compare all signals in this project semantically, not by string match. Identify pairs or clusters describing the same underlying force in different vocabulary. For each cluster propose a single merged signal with the clearest wording, and list which source signals it absorbs.

---

## Group 3 — Impact and uncertainty (step 4 — closed-book, temp = 0)

### 3.1 "Score impact against my actual decision"
> Score every signal in this project on **impact**, defined strictly as: how much this force's resolution would change the answer to `{focal}`, given that `{owner}` must decide and that failure means `{stakes}`.
>
> Do NOT score general industry importance. A force can be enormous in the sector and low-impact for this decision — say so when that's the case.
>
> Score 1–5 with a one-sentence justification citing which part of the focal question or stakes it bears on. Return a ranked list, and separately name the three signals whose scores you are least confident about and why.

### 3.2 "Score uncertainty honestly"
> Score every signal on **uncertainty over `{horizon}`**: how unpredictable the direction of resolution is within that window specifically.
>
> Apply these disciplines:
> - A force can be volatile day-to-day yet highly predictable in direction over `{horizon}` — that is LOW uncertainty.
> - The user stated they consider these effectively inevitable: `{given}`. Test that claim against the evidence in the project rather than accepting it — if a signal they treat as given is actually contestable over this horizon, flag it prominently. Misclassified predetermineds are the most common failure in scenario work.
> - The user stated these are genuinely uncertain: `{open}`. Test these too — if one is more determined than they think, say so.
>
> Score 1–5 with justification, and list the disagreements with the user's own classification first.

### 3.3 "Find my critical uncertainties"
> Using the impact and uncertainty scores already in this project, identify the signals sitting in the high-impact **and** high-uncertainty quadrant — the critical uncertainties that can become scenario axes.
>
> Then stress-test the shortlist:
> - Which pairs are genuinely independent, and which are correlated enough that they'd collapse into one effective axis?
> - Which are phrased as a spectrum with two nameable poles, and which are currently binary yes/no framings that need rewording?
> - Does the pair you'd recommend actually discriminate between meaningfully different futures for `{focal}`, or do all four quadrants imply the same decision?
>
> Recommend one axis pair and one runner-up pair, each with the reasoning. Flag if no pair is defensible yet.

### 3.4 "Check my predetermined elements"
> List every signal scored low-uncertainty / high-impact — the predetermined elements. For each, state the evidence that makes it near-certain over `{horizon}` and rate the strength of that evidence.
>
> Then apply the hard test: a predetermined element must hold true across *all four* scenario quadrants. Any element that only holds in some futures is not predetermined — it is a critical uncertainty that has been misfiled. Name any that fail.

---

## Group 4 — Pressure-test (closed-book, adversarial)

### 4.1 "What would a sceptic say I've got wrong?"
> Take the position of a well-informed sceptic reviewing this project's signal set before the scenario matrix is built.
>
> Argue: which signals are conventional-wisdom filler that everyone in `{industry}` would list; which high scores reflect what is easy to research rather than what matters to `{focal}`; and what this set would miss entirely if the future rhymes with nothing in recent memory.
>
> Be specific and cite signals by name. Do not soften — the value here is the objection, not the balance.

### 4.2 "What did I say keeps me awake — is it covered?"
> The user said what keeps them awake at night is: `{awake}`. Their best case is `{good}` and their worst case is `{bad}`.
>
> Audit the current signal set against those three statements. For each, state whether the project has signals that would let the user see it coming, name them if so, and identify the gap if not. End with the single most important missing signal, and why its absence matters more than the others.

### 4.3 "Wildcards"
> Identify low-probability, high-impact discontinuities relevant to `{focal}` over `{horizon}` that the current signal set does not cover — the ones that would invalidate the whole scenario frame rather than move a variable inside it.
>
> Limit to 3–5. Each must be specific enough to have an observable early precursor; name that precursor. Exclude generic catastrophes with no discriminating early indicator. Label all as wildcards, not forces to be ranked on the matrix.

---

## Implementation notes

**Chip labels** (what the user sees on the page — keep them short and plain):

*Find* — Scan for missing forces · From my open questions · Profile my dependencies · Work back from my worst case · Blind-spot sweep
*Sharpen* — Force or event? · Split compound signals · De-duplicate
*Rank* — Score impact · Score uncertainty · Find critical uncertainties · Check predetermineds
*Test* — Sceptic's review · Cover my key concerns · Wildcards

**Context assembly.** One `buildSignalsContext(projectId)` helper should assemble focal question, horizon, industry, the interview answers, all current signals with scores, and the category distribution — so every prompt draws from the same snapshot. Truncate signal bodies; send titles + descriptions, not full source text.

**Empty-state routing.** With zero signals, show only Group 1. Groups 2–4 need existing signals; grey them out with "add signals first" rather than letting them run on an empty set.

**Research mode is per-prompt, not per-page.** Group 1 sets research on and writes unconfirmed suggestions. Groups 2–4 must run closed-book at temp 0 — if any of them fires a web call, that is a methodology violation.

**Scores are proposals.** Group 3 output populates a review queue, never writing directly to `signals.impact` / `signals.uncertainty`. The user confirms before the Matrix reads them.

**Log everything** to `ai_runs` with the prompt id (`signals.find.scan`, `signals.rank.impact`, …) so you can see which prompts testers actually use.
