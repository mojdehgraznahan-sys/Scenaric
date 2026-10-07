# 02 — Monitoring v2

**Reference:** `Monitoring Standalone.html` in this folder. Open it in a browser. The `PAGE` script block is the final component (`components/page-monitoring.jsx`). Package 01 must be finished first.

Purpose: show which future is arriving, what moved it, and what to do about it. Monitoring runs **before** Strategy and feeds it.

---

## Prompt 1 — Replace the Monitoring page

Replace the current Monitoring page (the static indicator list with fake sparklines in `page-monitoring-settings.jsx`) with `PageMonitoring` from the reference. Keep `PageSettings` where it is. Wire it to `useDecisions(projectId)` from package 01. Sections, top to bottom:

1. **Header.** The title and a subtitle. "Last scan {time} · {N} sources" comes from `scan_runs`. Buttons: **Executive briefing**, which opens `DcBriefing`, and **{N} actions in Strategy →**.
2. **Target banner.** It has a border in the target scenario's colour and shows the route health label (coloured green, amber or red), plus counts of supporting events gaining and weakening and of blockers rising. It names the top weakening event. **View route** goes to Strategy. If there is no target yet, show "Choose a target future in Strategy" with a link.
3. **Scenario momentum.** One card per scenario, with the target outlined. Each card shows:
   - an arrow and the momentum label
   - a five-segment storyline bar ("Storyline: {phase} reached")
   - "Signposts: x hit · y approaching · z total"
   - the top 2 contributing events, marked +/−

   The caption must say that momentum is relative evidence, not probability.
4. **Tracked events.** Filter chips: All / Changed / Helps target / Works against. Rows are sorted by |delta × impact|. Each row shows:
   - the title, plus "good for target" or "bad for target" when it changed
   - force → pole and the storyline phase
   - the quoted cite with its source and date
   - scenario chips (target emphasised)
   - a trend badge (Rising / Falling / Stable / Occurred), a 12-week step sparkline (green if good for the target, red if bad, grey if unchanged), and "Medium → Low"
5. **Recommended actions.** The first 3 pending cards (compact) with Accept / Defer / Dismiss, then "+N more in Strategy".
6. **New events found.** The discovery inbox. Items that fit a force show the proposed force → pole and scenario chips, with Confirm and Reject. Items that fit nothing show "Fits no force. {proposal}", with **Send to Signals** and Reject. When ≥2 pending items don't fit, show the amber **"Your frame may be missing something"** panel with **Add force** (Signals) and **Review axes** (Matrix). Every decision has an Undo.

Match the reference's layout. It uses a two-column grid, `repeat(auto-fit,minmax(min(100%,420px),1fr))`: tracked events on the left, actions and inbox on the right. Below about 860px the two columns stack.

Acceptance:
- On the seed project, the banner reads "At risk", Fragmented Frontier shows "Building", and the frame panel appears.
- Confirming `nx1` inserts the event and removes it from pending.
- Every row with a change shows a cite. A row with a change but no cite is a bug.

---

## Prompt 2 — Edge cases and empty states

- **No tracked events yet:** show "Monitoring starts once your storyline links events to scenarios", with a link to Storyline.
- **No scan run yet:** hide the "last scan" line and show "First scan runs tonight at 06:00".
- **An event user-overridden in Signals:** show it as `changed_by: user` with "Updated by {name}" in place of a source.
- **Wildcards:** don't list them in Tracked events. Instead, add a collapsed "Wildcards · watched" row under the inbox that shows each wildcard's early sign.
- **Accessibility:** the sparkline gets `aria-label` "{event}: Medium to Low over 12 weeks". Filter chips are buttons with `aria-pressed`.
