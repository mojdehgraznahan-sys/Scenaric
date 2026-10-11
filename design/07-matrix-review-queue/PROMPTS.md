# Matrix: review queue — Claude Code prompts

Problem: on the Impact × Uncertainty Matrix, forces that still need placing are shown as wrapped chip clouds under the plot ("To confirm · 20", "Not on the matrix yet · N"). With 15+ forces this becomes a wall of pills, and the user has to bounce between the cloud and the questions panel to work through them.

Fix: replace both chip clouds with a **review queue** — a compact, filterable list under the questions panel — and add **queue navigation** to the questions panel so the user can answer the two questions for every force in sequence.

**Visual reference:** `Matrix Standalone v2.html` (20 forces, 13 still to review). Open it in a browser. It is the target UI. Treat it as design reference, not production code.

Files: `components/matrix-v2.jsx` only. No data-contract or API changes.

---

## Prompt 1 — Remove the chip clouds

In `MatrixV2`:

1. Delete the "To confirm · N" and "Not on the matrix yet · N" blocks under the plot legend, and the `chipList` helper.
2. Keep the plot and the legend in the left column unchanged.
3. Clicking a dot on the plot still selects that force.

Acceptance: nothing renders under the legend.

---

## Prompt 2 — Review queue list (`MXQueue`)

Add a new component `MXQueue({ signals, pBy, selected, onSelect, tab, setTab })`. Render it in the right column, **under** the questions card, in a column with `gap: 12`. The right column is `flex: 1 1 340px`.

Structure (one `.mx-card` with `padding: 0`):

1. **Header** (padding 12):
   - Left: "Forces" (13px/600). Right: "{placed} of {total} placed by events" (11.5px, #6B7280).
   - A progress bar under it: 4px tall, track #F3F4F6, fill #F97316, width = placed / total, with a `.3s` width transition.
   - Filter tabs (pills): **To review · N**, **Placed · N**, **All · N**. Active tab = #1E1B2E background, white text. Default tab: To review.
     - To review = no placement, or `confirmed === false`.
     - Placed = `confirmed === true`.
2. **Rows** (one per force, divided by a 1px #F3F4F6 line):
   - Grid: `8px | minmax(0,1fr) | auto`, gap 10, padding 9px 10px.
   - An 8px category dot (`MX_CAT[category][1]`), then the title on **one line with ellipsis** (full title in the `title` tooltip), then the status:
     - No placement → "Not placed" (11px, #9CA3AF).
     - Unconfirmed → "Star rating" (11px, #B45309).
     - Confirmed → the existing `MXQBadge` for its quadrant.
   - The selected row gets background #FFF7ED and `aria-current="true"`. Hover: #FAFAF9. Use a background fill, **not** a coloured left border.
3. **Collapse:** show the first 8 rows. If there are more, add a "Show all N" / "Show fewer" link in the footer. Switching tabs collapses the list again.
4. **Empty states:** To review → "All forces are placed by events."; other tabs → "Nothing here yet."

CSS to add to `MX_CSS`: `.mx-q-row`, `.mx-q-title`, `.mx-tabs` (copy from the reference file).

Acceptance: with 20 forces, the right column is the questions card plus a list of 8 one-line rows. Nothing wraps into a cloud.

---

## Prompt 3 — Work through the queue from the questions panel

1. **Queue order.** In `MatrixV2`, build the queue as `[unconfirmed…, unplaced…]` and store the order of ids in state (`qOrder`) when the page mounts. **Don't re-sort the queue when a force gets placed**, so position and Next stay stable while the user works. Append new force ids when `signals.length` changes, and drop deleted ones.
2. **Pass to `MXAssess`:** `pos` (1-based index of the selected force in `qOrder`, or 0 if it isn't in the queue), `total` (the length of `qOrder`), `onPrev` and `onNext`.
3. **Nav bar** at the top of `MXAssess`, shown only when `pos > 0`:
   - Left: mono 10px "TO REVIEW · {pos} OF {total}".
   - Right: a "←" ghost button (disabled at 1) and a "Skip →" ghost button (disabled at the last force).
   - A 1px #F3F4F6 divider below the bar.
4. **Place & next.** Once both questions are answered, the primary button reads:
   - "Place & next →" (or "Move & next →" if the force was already placed) when there's a next force in the queue. Clicking saves the placement, then selects the next force after 350 ms, so the dot's move on the plot is visible.
   - "Place on matrix" / "Move on matrix" when it's the last force or the force isn't in the queue. It saves without moving on.
   - "✓ Placed" (disabled) when the answers match the saved placement.
5. `MXAssess` is already keyed by `sig.id`, so the answers reset for each force. Keep it that way.

Acceptance:
- Starting at "1 of 13", the user can answer and press "Place & next" thirteen times without touching the list or the plot.
- The progress bar and the tab counts update after each placement.
- A placed force moves from "To review" to "Placed".

---

## Prompt 4 — Verify

1. Open the Matrix with 15+ forces. No chip clouds; the queue shows 8 rows plus "Show all N".
2. The first unconfirmed force is selected; the nav bar reads "TO REVIEW · 1 OF N".
3. Answer both questions → "Place & next →" → the dot moves, the next force opens, the progress goes up.
4. "Skip →" moves on without saving; "←" goes back.
5. Click a row in the Placed tab → its questions open with the saved answers and no nav bar.
6. Click a dot on the plot → the same row highlights in the list.
7. At 900px wide, the right column wraps under the plot and the rows still truncate cleanly.
8. No console errors.
