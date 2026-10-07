# 03 — Strategy v2

**Reference:** `Strategy Standalone.html` in this folder. The `PAGE` block is final (`components/page-strategy.jsx`). Keep the old page as `page-strategy-v1.jsx` until this one ships. Packages 01 and 02 must be finished first.

Purpose: steer toward the future you want while staying ready for the other three. Actions recommended by Monitoring arrive here.

---

## Prompt 1 — Target, route health and action queue

Replace `PageStrategy` with the reference and wire it to `useDecisions`.

1. **Header.** "Strategy" with the subtitle "Steer toward the future you want, and be ready for the other three." Button: **Executive briefing**.
2. **Target future picker.** Four selectable cards, each showing the scenario's name, tagline and current momentum label. Selecting one writes `strategy_targets`. The caption underneath is required: the target is a strategic choice, not a score on the scenario, and every move is still tested against all four futures.
3. **Route health strip.** The health label in large type with a coloured left rule, followed by a **Gaining** list and a **Pulling you off course** list (weakening events plus rising blockers).
4. **Recommended actions.** All pending cards (full body). Each card has Accept / Defer / Dismiss and a toggle to show handled cards. Accepting a card applies its `effect`: a move status changes, or the user is navigated to the target page, as with frame-check cards. Accepting should also let the user set an optional owner and due date. Add these as an inline popover on Accept, which isn't in the reference.

Acceptance:
- Accepting `a1` turns the Singapore single-HQ move to **Paused**. Undo restores **Planned**.
- Changing the target recomputes health, levers and route immediately. The scenario rows are untouched.

---

## Prompt 2 — Levers, route map and revision

1. **Levers toward {target}.** Three columns:
   - **Influence:** "Push these with your own moves."
   - **Watch:** "Outside your control. Prepare for them."
   - **Blockers:** "These pull toward other futures. Reduce or hedge."

   Each row shows the event, its current level and a ↑/↓/→ arrow that is green when the movement is good for the target. Blockers add "· reduce" when they are influenceable, otherwise "· hedge".
2. **Route to {target}.** A swimlane grid. Rows are the lanes No-regret / Shaping / Hedges, each with a one-line description. Columns are Now / 2027 / 2028 / 2029–30 (derive these from the horizon later). Each move card shows:
   - its title
   - "Pushes: {event}" when `pushes`, or "Event / Trigger / Option: {name}"
   - a status badge. Held moves use a dashed border; armed moves get an amber border and paused moves a blue one.

   The grid scrolls horizontally below 860px. **Empty state:** if the target has no moves, show "No route to {target} yet" and a **Draft route** button. The button calls an edge function that drafts no-regret, shaping and hedge moves from the target's levers and signposts. The user reviews the draft in a modal before anything is inserted.
3. **Proposed strategy revision** (only when one exists). An amber card listing each item with its kind label (Re-sequence / New move / Re-score). Buttons:
   - **Apply revision**, which applies the moves and re-scores
   - **Rebuild scenarios**, which opens the Matrix v2 re-axis workflow and snapshots the current scenarios and route
   - **Dismiss**
4. **Wind tunnel.** An option × scenario grid with the target column highlighted. Verdicts:
   - **Robust:** the option works in 3 or more futures.
   - **Depends on target:** it works in the target but in fewer than 3 futures.
   - **Hedge:** it doesn't work in the target.

   Warn on any shaping move whose linked option is "Depends on target" with no hedge in the same horizon.

Acceptance:
- Every route move has a link to an event, signpost or option. The UI never shows an unlinked move.
- No scenario probability appears anywhere on the page.
