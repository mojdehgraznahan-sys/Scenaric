# Storyline: Signals → Events (copy pass)

Context: the Storyline chain is made of **events** (things that happen), not signals/forces. This pass changes user-facing copy only. Do not rename variables, props, files, data keys (`FM_DATA.signals`, `signalCount`, `reviewSignals`, `SignalCard`, `SignalPickerModal`) or localStorage keys — that's a separate refactor.

Run the prompts in order. Each is self-contained.

---

## Prompt 1 — Storyline page copy

In `components/page-storyline.jsx`, change these user-facing strings. Copy only — leave identifiers, comments and logic untouched.

| Location | Before | After |
|---|---|---|
| Header stat label | `SIGNALS` | `EVENTS` |
| Chain strength panel | `{n} signals chained` | `{n} events chained` |
| Re-axis review panel | `{n} signal(s) need review` | `{n} event(s) need review` |
| Backward-arrows explainer | `…late-stage signal influences a precursor.` | `…late-stage event influences a precursor.` |
| Gap card body | `No signals connect "X" to "Y"` | `No events connect "X" to "Y"` |
| Gap card button | `Find signals` | `Find events` |
| `insertBetween` placeholder node title | `"New signal"` | `"New event"` |
| `insertBetween` toast | `"Signal inserted"` | `"Event inserted"` |
| Arrow midpoint "+" button `title` | `Insert signal here` | `Insert event here` |
| Empty state body | `Drag signals from your library…` | `Drag events from your library…` |
| Empty state button | `Browse Signals Library` | `Browse events` |
| Connect-coachmark title | `Connect this signal` | `Connect this event` |
| Connect-coachmark body | `…connect this signal to another…` | `…connect this event to another…` |

Keep pluralisation logic intact (`event{n === 1 ? "" : "s"}`). "Browse events" still navigates to the Signals page — events live there, grouped under their force.

Acceptance: `grep -nE "\b[Ss]ignals?\b|SIGNALS" components/page-storyline.jsx` returns only comments and identifiers (e.g. `FM_DATA.signals`), no rendered text.

---

## Prompt 2 — Add-to-storyline modal copy

In `components/signal-picker-modal.jsx`, change these user-facing strings. Copy only.

| Location | Before | After |
|---|---|---|
| Header subtitle | `Pick from your Signals Library or create a new one.` | `Pick from your events or create a new one.` |
| Add toast | `Added 1 signal to {col}` / `Added {n} signals to {col}` | `Added 1 event to {col}` / `Added {n} events to {col}` |
| Create tab field label | `Connect from existing signal (optional)` | `Connect from existing event (optional)` |
| Selection footer | `1 signal selected` / `{n} signals selected` | `1 event selected` / `{n} events selected` |
| Search placeholder | `Search signals by name, source, or keyword...` | `Search events by name, source, or keyword...` |
| Empty search result | `No signals match. Try adjusting filters.` | `No events match. Try adjusting filters.` |
| Create tab field label | `Signal title` | `Event title` |

The modal title already reads "Add event to storyline" — leave it.

Acceptance: same grep on `components/signal-picker-modal.jsx` shows no rendered "signal" text.

---

## Prompt 3 — Verify

1. Open Storyline with an empty scenario: empty state says "Drag events from your library…" and the button reads "Browse events" (navigates to Signals).
2. Add an event via "Add event to chain": modal subtitle, search placeholder, selection footer and toast all say "event".
3. Hover an arrow and click "+": node titled "New event", toast "Event inserted".
4. Header stat reads EVENTS; chain strength reads "N events chained".
5. No console errors.

---

# Part 2 — Wire Storyline to real events

Prompts 1–3 changed copy only. Prompts 4–7 make the chain actually use events from the shared event list. Run in order; each depends on the previous.

Reference — event contract (from `components/signals-v2.jsx`):

```
force { id, title, body, category, impact 1-5, uncertainty, poles: [a, b] }
event { id, title, body, category, status 'observed'|'possible', date,
        likelihood? 'Low'|'Medium'|'High', impact 1-5, wildcard?, precursor?,
        source?, origin?, links: [{ sigId, side: 'a'|'b', toward }] }
api: addEvent(e) · updateEvent(id, patch) · linkEvent(eventId, force, side)
     generateForPole(force, side) → drafts[]
```

---

## Prompt 4 — Picker sources from the shared event list

In `components/signal-picker-modal.jsx`:

1. **Library tab source.** Replace `window.FM_DATA.signals` with the project's shared event list (`store.events`, the same list the Signals page writes to). Pass it in as a prop (`events`, `forces`) from `page-storyline.jsx` — do not read globals.
2. **Group by force.** Render events in collapsible groups, one per force (`event.links[].sigId` → force title). Events linked to several forces appear under each. Unlinked events go in a final "Unassigned" group. Group header: force title + count.
3. **Row content.** Title, status badge (`Observed` grey / `Possible` with likelihood badge using existing `.sl-badge-High|Medium|Low` colours), date, and the pole the event pushes toward (`↗ {toward}`).
4. **Filters.** Keep the category filter. Add a status segmented control: `All · Observed · Possible`.
5. **Already in chain.** Events already on this scenario's chain stay visible but are disabled with an "In chain" tag (existing `chainTitles` logic, keyed by event id instead of title).
6. **Create tab.** On submit, call `api.addEvent({...form, status, likelihood, origin: "storyline", links: []})` instead of `FM_DATA.signals.unshift`. If a force is chosen in the form, follow with `api.linkEvent(newId, force, side)`. Add to the form: status (Observed/Possible), likelihood (shown only when Possible), force select (optional), pole select (shown once a force is picked). New events with no force land in the Signals inbox.
7. **Chain nodes reference events by id.** When an event is added to a column, store the node as `{ id: nodeId, eventId, phase }`. The node renders title/body/etc. from the event, not a copy. Existing nodes without `eventId` keep working as before (legacy).

Acceptance:
- An event added via "Ask AI → Add" on the Signals page appears in the picker under its force, with no reload.
- Creating an event in the picker makes it appear on the Signals page (under its force, or in the inbox if none was chosen).
- Editing an event's title on the Signals page updates its Storyline card.

---

## Prompt 5 — Force tag and likelihood on Storyline cards

In `components/page-storyline.jsx`, `SignalCard`:

1. Add a force tag row under the title: `↗ {toward}` (pole text), with the force title shown in its tooltip. If an event links to several forces, show the first and `+N`.
2. Add a status badge, top-right: `Observed` (grey, solid dot) or likelihood `High|Medium|Low` (existing badge colours, hollow dot).
3. Wildcard events (`wildcard: true`) get a small `Wildcard` tag next to the badge.
4. Legacy nodes with no `eventId` show no tag or badge. Do not invent values.
5. The detail side panel shows the same fields, plus a "View in Signals" link that navigates to the Signals page with that event open.

Keep card height stable — truncate the force tag to one line.

Acceptance: a chain with mixed observed/possible events reads at a glance which links have happened and which are pending.

---

## Prompt 6 — Gap-card suggestions from AI events

The gap card ("No events connect X to Y") currently uses a hardcoded `suggest` string.

1. Find the force(s) of the two events on either side of the gap (`from`, `to`). Call `api.generateForPole(force, side)` using the pole the `to` event pushes toward. Cache the result per gap for the session.
2. Replace the static "Suggested: …" text with up to 3 suggestion rows: title, likelihood badge, `Add` button. Reuse the dashed draft-row style from `SLDraftRow` in `signals-v2.jsx`.
3. **Add** = `api.addEvent({...draft, status: "possible", origin: "ai", links: [{ sigId, side, toward }]})`, then insert the new event as a node between `from` and `to` (same placement as `insertBetween`) and draw both arrows. Toast: "Event added and linked". The event also shows up on the Signals page under its force.
4. **Find events** opens the picker pre-filtered to that force.
5. Loading state: a 3-row skeleton. On error, fall back to the "Find events" button only.

Acceptance: clicking Add on a gap suggestion fills the gap on the canvas and adds the event to the Signals library in one step.

---

## Prompt 7 — Rename identifiers (signal → event)

Pure refactor; no behaviour or copy change.

| Before | After |
|---|---|
| `components/signal-picker-modal.jsx` | `components/event-picker-modal.jsx` |
| `SignalPickerModal` | `EventPickerModal` |
| `SignalCard` / `SignalCardPlaceholder` | `EventCard` / `EventCardPlaceholder` |
| `strength.signalCount` | `strength.eventCount` |
| `reviewSignals` / `allSignals` (Storyline only) | `reviewEvents` / `allEvents` |
| comments "Add-signal modal", "signals needing manual placement" | "Add-event modal", "events needing manual placement" |

1. Update every `<script src>` / import that references the renamed file, and the `window` export.
2. **Storage migration.** If any localStorage key for Storyline nodes contains `signal`, read the old key on load, write it under the new key, then delete the old one. Run once and guard with `fm.migrated.storylineEvents = 1`. Leave `fm.reaxReview` as is.
3. Do **not** rename `FM_DATA.signals` or anything on the Signals page — forces are still called signals there.

Acceptance: `grep -rn "SignalPickerModal\|SignalCard\|signalCount" components/` returns nothing; an existing Storyline chain still loads after refresh.

---

## Prompt 8 — Verify the full flow

1. Signals page → Ask AI → Add an event under a force.
2. Storyline → Add event to chain → the event is listed under that force → add it to Catalysts.
3. The card shows the force tag and likelihood badge.
4. Rename the event on the Signals page → the Storyline card updates.
5. Leave a gap between two columns → the gap card shows AI suggestions → Add one → node inserted with arrows; the event appears on the Signals page.
6. Create a new event in the picker with no force → it appears in the Signals inbox.
7. Refresh → the chain persists; no console errors.

---

## Still out of scope

- Monitoring/Strategy/Home CEO view still read `decision-data.js` mocks. Connecting them to the shared event list (so Storyline events show as happened or pending in Monitoring) is a separate pass.
- Chain strength weighting by likelihood (observed links count more than possible ones) — decide after Prompt 5 is live.
