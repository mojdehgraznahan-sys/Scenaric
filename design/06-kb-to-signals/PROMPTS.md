# Knowledge Base → Signals: Claude Code prompts

Goal: when a user reaches the Signals page, it is already populated with **forces** derived from their Knowledge Base and **events** for each force. The user reviews and edits; they don't start from blank. Manual "+ Add event", "Add force" and per-pole "✦ Suggest" stay.

Run the prompts in order.

**Visual reference:** `Signals Library Standalone v2.html` (in this folder) is a single self-contained file showing the target UI with mock data and mock AI. Open it alongside these prompts. The main column is the Signals page (Knowledge Base banner, force tags, neutral titles, pre-filled add-event window). The right column stands in for the Knowledge Base page ("+ Add to Signals") and the Ask AI chips. Only the `HOST` block at the bottom is mock; everything above it is final UI. The same code also lives in the full prototype (`components/signals-v2.jsx`, `page-signals.jsx`, `page-knowledge.jsx`, `app-shell.jsx`, `ask-ai.jsx`, `data.js`).

Contracts used throughout:

```
insight { id, source_type, category, actor_type?, confidence, source_name, quote, paraphrase }
force   { id, title, body, category, impact 1-5, uncertainty, poles: [a, b],
          origin: 'kb'|'research'|'user'|'ai', fromInsights?: insightId[] }
event   { id, title, body, category, status 'observed'|'possible', date, likelihood?, impact,
          source?, origin: 'kb'|'ai'|'user', fromInsight?: insightId,
          links: [{ sigId, side: 'a'|'b', toward }] }
```

---

## Prompt 1: Fix the Knowledge Base → Signals link

Bug: each insight's button navigates to `/app/signals?mergeInsight=<id>`. The router reads `parts[1]` as the page id, so the page id becomes `signals?mergeInsight=ei1`, and the Signals page never reads the param.

1. **Router.** In `components/app-shell.jsx`, strip the query string before resolving the page: `const page = (parts[1] || "projects").split("?")[0];`. Do the same anywhere else the hash is split into a page id.
2. **Read the param.** In `components/page-signals.jsx`, parse `mergeInsight` from the hash query, look it up in the project's insights, and pass `insights`, `mergeInsight` and `onMergeDone` (which navigates to `/app/signals`, clearing the param) to `SignalsLibraryV2`.
3. **Open the add-event modal pre-filled.** In `SignalsLibraryV2`, when `mergeInsight` is set, open `SLAddEventModal` with `preset = { fromInsight }`:
   - Title: "Add an insight as an event". Subtitle: "Edit the headline so it reads as one thing that happened, then confirm the force it pulls on."
   - A quote block above the form: `FROM KNOWLEDGE BASE · {source_name}` and the insight's quote in italics.
   - Pre-fill the headline with the paraphrase, status = "It happened", and source = `source_name`.
   - The existing force auto-suggest runs on the pre-filled headline, so the force and pole are proposed straight away.
   - On save, write `origin: "kb"` and `fromInsight: insight.id`. Closing or saving calls `onMergeDone`.
4. **Knowledge Base button.** Rename "+ Merge into Signal →" to **"+ Add to Signals →"**. If any event has `fromInsight === ins.id`, or any force lists the insight in `fromInsights`, show "✓ In Signals" (green, no button) instead.

Acceptance:
- Clicking "+ Add to Signals" on any insight opens the Signals page with the modal pre-filled and a force suggested.
- Saving adds the event under that force. Returning to the Knowledge Base shows "✓ In Signals" on that insight.
- A refresh with the query still in the URL doesn't break the page.

---

## Prompt 2: Derive forces from the Knowledge Base (backend)

Add an AI step that runs after insight extraction finishes (and again when new sources are processed). Endpoint `signals.derive.forces`.

**Input:** focal question, horizon, industry, onboarding answers (`{awake}`, `{decision}`, `{given}`, `{open}`, `{actors}`), all insights (`id, category, quote, paraphrase, source_name, confidence`), and any existing forces.

**System prompt:**

> You are helping a strategy team build scenarios for the decision: `{focal}`, over `{horizon}`, in `{industry}`.
>
> Below are insights extracted from their own documents, interviews, surveys and web sources. Group them into **driving forces**. A driving force is something that matters to this decision and could go **two different ways** over the horizon.
>
> For each force, return:
> - `title`: a **neutral noun phrase naming what varies**. It must not say which way it goes. Good: "Pace of enterprise AI adoption in SEA", "Volatility of SEA currencies", "ASEAN trade and regulatory integration". Bad: "AI adoption accelerates" (picks a side), "EU CBAM" (names a policy, not what varies), "SEA middle class doubles by 2030" (a prediction).
> - `poles`: two short, parallel phrases, 2–4 words each, describing the two outcomes. Each must read naturally as "{title}: {pole}". Example: "Pace of enterprise AI adoption" → ["Adoption stalls", "Adoption accelerates"].
> - `body`: one sentence, 30 words or fewer, saying what the force is about. Start with "How…" or "Whether…". No statistics unless they come from a cited insight.
> - `category`: Social, Technology, Economic, Ecological or Political.
> - `impact` 1–5: how much the force would change `{decision}`, not how important it is to the industry.
> - `uncertainty`: Low, Medium or High over `{horizon}`.
> - `fromInsights`: the ids of the insights that support it. **At least one.**
> - `rationale`: one sentence on why these insights belong together.
>
> Rules:
> - Use only the insights given. Do not invent forces with no supporting insight; those come from a separate research step.
> - Treat `local_actor` insights (customers, suppliers, competitors) as evidence for a driving force, not as forces of their own.
> - Don't create a force that duplicates an existing one (check meaning, not wording). Instead, return it under `attachToExisting: [{ sigId, insightIds }]`.
> - Return 4 to 9 forces. List insights that fit nowhere in `unused`.

**Writing check (run server-side before saving; regenerate once if it fails):**
- The title contains no direction verb (accelerates, deepens, surges, stalls, shifts, dominates, doubles) and no year.
- The two poles differ from each other, and neither repeats the title word for word.
- The body is a single sentence.

**Output:** `{ forces: [...], attachToExisting: [...], unused: [insightId] }`. Save the forces with `origin: "kb"`. Log the run to `ai_runs` as `signals.derive.forces`.

---

## Prompt 3: Derive events for each force (backend)

Endpoint `signals.derive.events`. Runs right after Prompt 2, and per force when one is added.

**Input:** each force (title, poles, body, `fromInsights`), the full text of those insights, the project context, and the existing events.

**System prompt:**

> For each force, propose events that show which way it is moving. An event is **one occurrence**: who did what, where, and when. Someone reading the news must be able to say "that happened" or "it hasn't happened yet".
>
> Two kinds:
> 1. **Observed (from the Knowledge Base).** Turn each supporting insight into a past event if it describes something that has already occurred or been measured. Write the headline as a full sentence with an actor and a verb, past or present tense, 18 words or fewer. Example: insight "78% of respondents rated currency volatility as their top operating concern" → event "78% of surveyed SEA customers name currency swings their top operating concern". Set `status: "observed"`, `source` = the insight's `source_name`, `fromInsight` = the insight id, and `origin: "kb"`. Skip any insight that is opinion with no occurrence behind it.
> 2. **Possible (inferred).** Add **at least one possible event per pole**, so the user would see the force coming whichever way it goes. Headline: a specific actor and action, 18 words or fewer, no hedging words ("may", "could", "increasingly"). Give a `date` window inside `{horizon}`, a `likelihood` (Low/Medium/High) with a one-line reason, `impact` 1–5 on `{decision}`, and `origin: "kb"` if it builds directly on a KB insight, otherwise `"ai"`.
>
> Rules:
> - At most 4 events per force in total.
> - No trends ("rising pressure on…"), and no restating the force.
> - Don't duplicate an existing event, even if it's worded differently.
> - Every event links to its force with `side` = `a` or `b`.
> - Flag anything that would break the whole scenario frame as `wildcard: true`, with a `precursor`.

**Writing check:** the headline has a subject and a verb, is 18 words or fewer, and contains none of may, could, might, increasingly or trend. Regenerate failures once, then drop them.

**Output:** `{ events: [...] }`. Insert them as real events (not drafts). The user reviews them on the page.

---

## Prompt 4: Populate the Signals page on first visit

1. **Trigger.** When insight extraction finishes, run Prompt 2 then Prompt 3 in the background. Show progress on the Knowledge Base page: "Building your forces… 3 of 5 insights grouped". When it's done, toast: "6 forces and 14 events ready in Signals" with an **Open Signals** action.
2. **First visit.** If the user opens Signals before the job finishes, show the force grid as skeleton cards with "Building forces from your Knowledge Base…", not an empty page.
3. **Provenance banner** (top of the page, under the header, neutral grey, not orange):
   > **From your Knowledge Base:** {n} forces and {m} events, drawn from {k} of {total} insights. The rest came from research. Check the wording before you place them on the matrix.
   >
   > *{x} insights not used yet →* (links to the Knowledge Base, filtered to unused insights)
4. **Force card tag.** Under the force title, show `FROM YOUR KNOWLEDGE BASE · {n} INSIGHTS` in 9.5px mono grey, with a tooltip listing the source names. Forces with other origins show no tag.
5. **Keep the manual tools.** "+ Add event", "Add force", "✦ Suggest" per pole and the inbox all stay as they are.
6. **Research top-up (optional, behind a project setting).** If fewer than 4 forces come back, run the "Find forces I've missed" prompt (Prompt 6, chip 2) in research mode, and save the results with `origin: "research"`.

Acceptance:
- On a fresh project with uploaded sources, Signals opens with forces and events, and none of the force cards is empty on both sides.
- Every `kb` force traces back to at least one insight.

---

## Prompt 5: Rewrite existing force titles so they read correctly

The seed data mixes force names with predictions and policy names. Update `data.js`, and run a one-off migration on stored projects (`signals.rewrite.titles`, same title rules as Prompt 2).

| id | Before | After |
|---|---|---|
| sg1 | EU Carbon Border Adjustment Mechanism | Cost of EU carbon border tariffs for SEA exporters |
| sg2 | Gen AI enterprise adoption accelerates | Pace of enterprise AI adoption in SEA |
| sg3 | Gen Z workforce expectations shift | Competition for young tech talent |
| sg4 | US-China decoupling deepens | US–China technology decoupling |
| sg5 | SEA middle-class doubles by 2030 | Growth of SEA's middle class |
| sg6 | Climate adaptation costs surge | Cost of climate risk for coastal SEA operations |
| sg7 | Mobile-first commerce dominates | Concentration of SEA commerce in super-apps |
| sg8 | ASEAN trade harmonisation stalls | ASEAN trade and regulatory integration |
| sg9 | Currency volatility regime | Volatility of SEA currencies |

- Rewrite each body as one "How…" / "Whether…" sentence (see `data.js`).
- **Leave `poles` unchanged.** Event links match on pole text through `toward`.
- Migration: for stored forces with no `origin`, copy the new title, body, `origin` and `fromInsights` from the seed. Don't touch user-created forces.
- Also add the three KB-derived seed events (`evk1`–`evk3`) and backfill any `ev[ik]*` ids that are missing.

---

## Prompt 6: Cut the Signals page "Ask AI" prompts to four

`SIGNALS_ASK_AI_PROMPTS.md` defines 16 chips. That's too many for one panel, and half of them belong on other pages. Replace the Signals page chip list in `components/ask-ai.jsx` with **four chips**, and show the generic chips only on other pages.

| # | Chip label | Merges | Mode |
|---|---|---|---|
| 1 | Generate events from my forces | 5.1 | research, unconfirmed |
| 2 | Find forces I've missed | 1.1 scan + 1.2 oracle questions + 1.3 actors + 1.5 blind-spot sweep | research, unconfirmed |
| 3 | Tidy my forces (merge, split, reword) | 2.1 force or event? + 2.2 split + 2.3 de-duplicate + the Prompt 2 title rules | closed-book, temp 0 |
| 4 | Do my forces cover what keeps me up at night? | 4.2 + 1.4 work back from worst case | closed-book |

**Moved off the Signals page:**
- To **Matrix**: 3.1 score impact, 3.2 score uncertainty, 3.3 find critical uncertainties, 3.4 check predetermined elements, 4.1 sceptic's review. These are step-4 tasks and belong where the scores are used.
- To **Storyline**: 4.3 wildcards.

**Merged prompt texts:**

**Chip 2: Find forces I've missed.**
> Focal question `{focal}`, horizon `{horizon}`, industry `{industry}`. Existing forces: `{force_titles}`. Category spread: `{category_distribution}`. The user's oracle questions: `{o1}`, `{o2}`, `{o3}`. Parties they depend on but don't control: `{actors}`.
>
> Propose up to 6 driving forces that are **missing** from the list. Check against existing forces by meaning, not wording. Each oracle question and each named actor should be covered by an existing force or a new one; say which. Only call out a thin STEEP category if this decision actually depends on it.
>
> Use the Prompt 2 format and title rules (neutral title, two poles, one-sentence body). Add a `why` that cites the oracle question, actor or category gap the force addresses. Label everything external/unverified. Nothing is saved until the user accepts.

**Chip 3: Tidy my forces.**
> Review every force in this project. Do not change anything; return recommendations only, at most 8, most important first:
> - `reword`: the title picks a side, names a policy or contains a prediction. Give a neutral rewrite using the Prompt 2 rules.
> - `is_event`: it's a single occurrence. Name the force it is evidence for, and propose moving it into that force's events.
> - `split`: it bundles two drivers that could move in opposite directions. Give the two forces, and say whether they are independent.
> - `merge`: two or more forces describe the same driver. Give the merged title and list which forces it absorbs.
>
> Each recommendation gets an **Apply** button in the UI. Applying a merge re-links the absorbed forces' events to the merged force.

**Chip 4: Do my forces cover what keeps me up at night?**
> The user said what keeps them up at night is `{awake}`, their worst case is `{bad}`, and the turning points they want to see coming are `{turns}`. For each of the three, name the forces and events that would give early warning, or say there's a gap. Work back from the worst case: which forces would have to move for it to happen, and is there an observable event today for each? End with the **single most important missing force or event**, offered as an addable suggestion.

**UI rules:**
- On Signals, show the four chips under "SUGGESTED" in the order above. With zero forces, show only chips 1–2. Grey out 3–4 with the hint "add forces first".
- Off Signals, keep the generic chips (critical uncertainties, highest downside, stress-test strategy, weekly summary).
- Results come back as cards with Add / Apply / Dismiss buttons. Nothing is written until the user accepts.
- Update `SIGNALS_ASK_AI_PROMPTS.md` to match: four Signals prompts, plus the moved prompts listed under their new pages.

---

## Prompt 7: Verify

1. On a fresh project, upload sources → the Knowledge Base shows extraction, then "Building your forces…" → the toast appears → Open Signals.
2. Signals shows the provenance banner, the KB tag on derived forces, and events on both sides of most forces.
3. Every force title is neutral. No title contains accelerates, deepens, surges, stalls, shifts, dominates, doubles or a year.
4. Knowledge Base → "+ Add to Signals" on an unused insight → the modal opens pre-filled with the quote and a suggested force → save → the event appears under that force, and the insight now shows "✓ In Signals".
5. "+ Add event", "Add force" and "✦ Suggest" still work.
6. Ask AI on Signals shows exactly four chips. Matrix shows the scoring prompts.
7. Refresh: everything persists, and there are no console errors.
