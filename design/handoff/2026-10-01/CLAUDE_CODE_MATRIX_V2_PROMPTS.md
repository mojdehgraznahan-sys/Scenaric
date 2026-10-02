# Claude Code: Matrix v2 (event-based placement) — self-contained build prompts

These prompts don't depend on any other prompt file. They build on the Signals Library v2 data model (`signals.pole_a/pole_b`, `events`, `event_signal_links.side`). Prompt 1 checks that those exist. Paste one prompt per message, in order.

## Before you start

1. Copy **`Matrix Standalone.html`** into the repo at `design/matrix-v2/Matrix Standalone.html` and commit it. It is one file containing the final UI and demo data. Open it in a browser to see exactly what to build.
2. Claude Code **ports** the UI and does not redesign it. Its job:
   - copy the component code as-is
   - build the tables
   - swap the in-memory `api` object for Supabase, keeping the same three functions

**What changes from the old Matrix**
- **No dragging, no star ratings.** A force is placed by answering two questions about its real events:
  1. *Impact:* "If [this event] happened tomorrow, would your decision change?" (No / Somewhat / Completely)
  2. *Uncertainty:* "By [horizon], could you honestly picture either of these happening?" It shows one event pulling each way. Answers: Yes, either / Only ← pole A / Only pole B →.
  The answers set the position. "Only one" means **predetermined**, and the settled pole is recorded.
- **Old placements stay** but show as dashed "placed by star rating — confirm" dots until the user answers the questions.
- **Axis ends are labelled with a headline event** that the user can cycle through.
- **Four worlds preview:** each quadrant shows the "front page" of that world, i.e. the headline events at its two axis ends.
- **Independence warning** when the same event pulls on both axes.
- **Wildcards** are listed beside the matrix and never plotted.

---

## Prompt 1 — Orient (read-only, no changes)

```
Open design/matrix-v2/Matrix Standalone.html and read it end to end. It is the complete, final UI for the Matrix page:
- SEED is demo data in the exact shapes the UI expects
- MatrixV2 and the MX* helpers are the component code, with CSS injected as MX_CSS
- the HOST block is an in-memory `api` with three functions, each with a BACKEND comment

Then inspect this repo and report back, making no changes:
1. The current Matrix page component and route. How are dots stored today (table and columns, e.g. matrix_dots x/y), and how are the chosen axes stored?
2. Do signals.pole_a / signals.pole_b, the events table and event_signal_links.side exist? If not, STOP and say so: the Signals Library v2 schema must be applied first.
3. Which other pages or functions read the dot positions or the chosen axes? Include the scenario builder, the re-axis flow, the dashboard and any Edge Function. These must keep working.
4. The RLS membership predicate on `signals` (quote it).
5. Any drag-to-place or star-rating code on the Matrix page. List the files, because they will be removed.
```

---

## Prompt 2 — Schema

```
Write ONE new migration. Do not edit existing migrations. If a table in Prompt 1 already holds this data, extend it rather than duplicating it.

matrix_placements (one row per force per project; replaces or extends the existing dots table):
- project_id uuid not null references projects(id) on delete cascade
- signal_id uuid not null references signals(id) on delete cascade
- primary key (project_id, signal_id)
- x numeric not null check between 0 and 100   — uncertainty; right = high
- y numeric not null check between 0 and 100   — impact; top = high (0 is top)
- impact_answer text null check in ('no','somewhat','completely')
- plausible text null check in ('both','a','b')   — 'a' or 'b' means only that pole is plausible, i.e. predetermined
- confirmed boolean not null default false         — false = migrated from the old star rating
- assessed_event_ids uuid[] null                   — the events shown when the user answered (audit)
- assessed_by uuid null, assessed_at timestamptz null
- updated_at timestamptz default now()
- check: confirmed = true requires impact_answer and plausible to be non-null

Backfill: copy every existing dot into matrix_placements with its x/y and confirmed=false. Keep the old table, read-only, until Prompt 6 passes.

scenario_axes:
- project_id, signal_id, position smallint check in (1,2)
- primary key (project_id, position), unique (project_id, signal_id)
Backfill from wherever axes are stored today.

axis_headlines:
- project_id, signal_id, side text check in ('a','b'), event_id uuid references events(id) on delete cascade
- primary key (project_id, signal_id, side)
- trigger: the event must be linked to that signal on that side (event_signal_links.side), must not be a wildcard, and must be in the same project

RLS: enable on all three tables. For select/insert/update/delete, mirror EXACTLY the predicate on `signals`. Never use `using (true)`.

When done, paste the relrowsecurity result for each table and the policy list.
```

---

## Prompt 3 — Placement rules as one SQL function

```
Placement is computed on the server, so no client can place a dot anywhere it likes.

Create function place_force(p_project uuid, p_signal uuid, p_impact text, p_plausible text, p_event_ids uuid[]) returns matrix_placements, security invoker, so RLS applies.

Mapping (must match mxPlace in the standalone file exactly):
- y = 18 if completely, 38 if somewhat, 72 if no
- x = 74 if plausible = 'both', else 24

Upsert the row with confirmed=true, assessed_by=auth.uid(), assessed_at=now() and assessed_event_ids.

Reject the call if:
- the signal isn't in the project
- the force has no pole_a/pole_b
- any p_event_ids aren't linked to that signal

Quadrant is always DERIVED, never stored:
- critical: y < 50 and x > 50
- predetermined: y < 50 and x <= 50
- monitor: y >= 50 and x > 50
- background: otherwise

Create a view matrix_placements_v that adds `quadrant` and `settled_pole` (pole_a if plausible='a', pole_b if 'b', else null).

Create function set_axes(p_project uuid, p_ids uuid[]):
- max 2 ids
- each must be a force whose derived quadrant is 'critical'
- no wildcards or events. Only signals ids are accepted.
- replaces scenario_axes for the project in one transaction
If scenarios already exist for the project, raise 'axes_locked' so the client routes the user to the existing re-axis flow instead.
```

---

## Prompt 4 — Port the UI as-is

```
Port the Matrix UI from design/matrix-v2/Matrix Standalone.html.

1. Create one component module (e.g. components/matrix/MatrixV2.jsx, or .tsx to match the repo). Copy VERBATIM: MX_CAT, MX_CSS, mxUseCss, mxPole, mxSide, mxEvents, mxQuad, MX_Q, MX_IMPACT_Y, mxPlace, mxLabel, MXChip, MXEvDot, MXMeta, MXSeg, MXQBadge, MXHeadline, MXPlot, MXAssess, MXAxisCard, MXWorlds and MatrixV2.
   - Change only what the module system requires (imports/exports, types).
   - Do not restyle, rename classes or restructure JSX.
2. Do NOT port the HOST block.
3. Replace the Matrix page with a thin host that renders <MatrixV2> inside the existing page card and passes:
   signals, events, placements, axes, headlines, focal, horizon, api, lockAxes, onReaxis, onBuildScenarios, buildLabel, onNavigate
   - lockAxes = the project already has scenarios. When true, axis changes call onReaxis, which opens the EXISTING re-axis flow.
   - onBuildScenarios opens the existing build-scenarios flow, or goes to Canvas when scenarios exist.
4. Delete the drag-to-place and star-rating code listed in Prompt 1 and remove their imports.
5. Temporarily wire an in-memory api copied from the HOST block, and confirm the page matches the standalone file before touching the backend.
```

---

## Prompt 5 — Data hook + api

```
Implement useMatrix(projectId) → { signals, events, placements, axes, headlines, focal, horizon, api, loading, error }.

Loading, under RLS:
- signals (with pole_a/pole_b)
- events + event_signal_links
- matrix_placements_v, scenario_axes (ordered by position), axis_headlines
- the project's focal question and horizon
Use at most one parallel batch, with no N+1 queries.

Map to the UI shapes in the standalone SEED:
- force: poles = [pole_a, pole_b]
- event: links = [{ sigId, side, toward }]
- placement: { sigId, x, y, impactAns: impact_answer, plausible, confirmed }
- axes: [signal_id…] by position
- headlines: { "<signal_id>:<side>": event_id }

api:
- setPlacement(sigId, p): rpc place_force(project, sigId, p.impactAns, p.plausible, <ids of the events shown>)
  The UI passes the chosen answers. To capture assessed_event_ids, pass the ids of the lead, A and B headline events currently shown. Add an optional 3rd argument to setPlacement in the host only, with no visual change.
- setAxes(ids): rpc set_axes. On 'axes_locked', call onReaxis instead of showing an error.
- setHeadline(sigId, side, eventId): upsert axis_headlines.

Subscribe to realtime changes on matrix_placements, scenario_axes, axis_headlines, events and event_signal_links, so events added in the Signals Library appear here without a reload.

Update every consumer found in Prompt 1 (scenario builder, re-axis, dashboard, Edge Functions) to read from matrix_placements_v / scenario_axes, then drop the old dots table in a follow-up migration only after Prompt 6 passes.
```

---

## Prompt 6 — Verify

```
Verify without changing behaviour. Fix only what's broken, and report each result.

1. Parity: open the standalone file and the app side by side. Compare the plot, dot styles (solid = confirmed, dashed = star rating, ring = axis), tooltip, both questions with their event cards and "Another (n)" cycling, the verdict box, Place/Move, Use as axis / Replace, the axis cards with cycling headlines, the four-worlds front pages, the shared-event independence warning, and the predetermined and wildcard panels.
2. Mapping: for each of the six answer combinations, the saved x/y and derived quadrant match mxPlace/mxQuad in the standalone file.
3. Server authority: a direct insert or update with arbitrary x/y and confirmed=true fails RLS or the check. Only place_force can confirm.
4. Axes: set_axes rejects a non-critical force, an event id, a third id, and any change when scenarios exist ('axes_locked'). The UI routes 'axes_locked' to the re-axis flow.
5. Headlines: axis_headlines rejects a wildcard, an event linked to the other pole, and an event from another project.
6. Predetermined: answering "Only ← A" shows the force in the Predetermined panel with "Settled: <pole_a>".
7. Backfill: every pre-existing dot appears dashed at its old position with "Placed by star rating. Confirm it."
8. Consumers: the scenario builder, re-axis and dashboard still work and read the new tables.
9. Realtime: adding an event on the Signals Library in tab 1 updates the Matrix event cards in tab 2.
10. RLS: a member of project A cannot read or write any of the three tables for project B.
11. No likelihood or probability is shown on any world or scenario card.
```

---

### Hold the implementer to

- **Forces are plotted, events are judged.** Events never become dots or axes.
- **Placement happens only through the two questions.** There's no dragging, and no client-side x/y writes.
- **No world is more likely than another.** Likelihood stays on individual events.
