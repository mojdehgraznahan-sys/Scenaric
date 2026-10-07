# 04 — Home: CEO view and Setup view

**Reference:** `Home CEO View Standalone.html` in this folder. It holds two blocks: `SETUP VIEW` (the existing Home with "+ Add to Signals" removed) and `CEO VIEW + VIEW SWITCH` (`components/page-home-v2.jsx`, final). Packages 01–03 must be finished first.

Purpose: give a CEO a three-question view at a glance. Where are we heading? Is my route holding? What do I need to decide?

---

## Prompt 1 — View switch and shared top strip

1. Route both `home` and `dashboard` to a new `PageHome`.
2. `PageHome` renders a **fixed top strip** that is identical in both views and does not scroll. It sits inside a container with `max-width: 1180px` and `margin: 0 auto`. The **Setup view / CEO view** segmented switch is on the left and the **Executive briefing** button on the right. Below the strip, render either `PageDashboard` (Setup) or `PageHomeV2` (CEO). Each view owns its own scroll area with `padding: 8px 24px 24px` and the same 1180px max width, so the switch never moves.
3. Persist the choice per user (`user_preferences.home_view`, default `ceo` once the project has a strategy, `setup` before that).
4. In the Setup view, remove the "+ Add to Signals" buttons from the News Feed. New events come in only through Monitoring's inbox.

Acceptance: switching views does not move the switch or the briefing button by even 1px. Check this with a bounding-box test.

---

## Prompt 2 — CEO view panels

Build `PageHomeV2` exactly as in the reference, fed by `useDecisions` and the package 01 roll-ups.

1. **Headline.** The eyebrow shows the project name and date. The H1 reads "Evidence is building fastest toward {top-momentum scenario}. Your route to {target} is {health}." The health word is coloured. The leading scenario **must** use the same definition as the briefing (highest momentum score). The sub-line reads "{N} decisions waiting · last scan … · N sources".
2. **Top row.** Use a responsive class grid, not `span 2`: `minmax(0,2fr) minmax(300px,1fr)` at ≥1100px, one column below that.
   - **Futures compass (SVG).** A 2×2 grid built from the project's two Matrix axes:
     - Quadrants are tinted with the scenario colours, and the target has a dashed outline and a "TARGET" label.
     - Pole names sit at the ends of the axes.
     - A dashed trail of 7 points over 12 weeks leads to a "Today" dot, with "12 wks ago" marked on the first point.
     - Positions come from `compass_position`. Place each scenario in the quadrant given by its two poles. **Don't** rely on `scenarios.quadrant`, which disagrees with the taglines in the seed; fix that data.
     - Caption: "direction of the evidence, not a forecast".
   - **Route health gauge (SVG).** A semicircle with three bands (Off course / At risk / On course) and a needle, then the label and "Pulling off course: {event}". The **Route** button goes to Strategy.
   - **Decisions waiting.** The top 2 pending cards, compact, with Accept / Defer and "Waiting {age}". **All N** goes to Strategy.
3. **Scenario momentum.** Four small-multiple area and line charts on a **shared y-scale** with the target first. A dashed zero line runs through each, and ◆ marks where a signpost was hit (`hit_at`). Labels show the first and last dates. Button: **Monitoring**.
4. **What moved.** A diverging bar chart of the top 6 changed events, with value = delta × impact × (+1 if the event supports the target, else −1). Green bars go right (helps the target) and red bars go left (hurts it). Each row shows the event and "Medium → Low".
5. **Signpost progress.** One row per scenario: name, a 5-segment storyline bar, and signpost dots (● hit, ◐ approaching, ○ not yet), with a legend below.
6. **Route to {target} (mini).** The swimlane grid in miniature, with pills coloured by status and a status legend. It updates live when a card is accepted.

Data visualisation rules:
- No pie charts, no percentages on scenarios, and no probability axes.
- Each chart element links to its source event in Monitoring (`/app/monitoring?event={id}`).
- Colours: the four scenario colours, plus `#059669` and `#DC2626` for good and bad for the target. Nothing else.

Acceptance:
- At 1280px, the top row shows the compass at two-thirds of the width next to the gauge and decisions.
- At 900px, everything stacks with no horizontal overflow.
- The Home headline and the briefing name the same leading scenario.
