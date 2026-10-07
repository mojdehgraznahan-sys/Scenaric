# 01 — Shared decision layer (backend + shared UI)

The reference is `decision-data.js` in this folder. Its seed shapes are the data contract. Its `DecisionModel` functions (`momentum`, `progress`, `levers`, `health`) are the exact roll-up maths to move server-side.

Read `SCHWARTZ_METHODOLOGY_SKILL.md` and `design_handoff_decisions/README.md` (guardrails) before starting.

---

## Prompt 1 — Schema and RLS

Create a Supabase migration for the decision layer. Every table has `project_id uuid not null references projects(id) on delete cascade` and the standard `created_at`/`updated_at` columns. RLS is on, with select/insert/update/delete allowed only to project members (reuse the existing `is_project_member(project_id)` helper).

Tables:
- `event_likelihood_history`: `id, event_id → events, level smallint check (level between 0 and 4)` (0 Ruled out, 1 Low, 2 Medium, 3 High, 4 Occurred), `observed_at timestamptz, source_title text, source_name text, source_url text, cite text, changed_by text check in ('scan','user')`. Index `(event_id, observed_at desc)`. The current likelihood is the latest row. Add a view `event_likelihood_current`.
- `event_scenario_links`: `event_id, scenario_id, phase smallint 0..4` (Precursors, Catalysts, First-order, Second-order, Realised), `unique (event_id, scenario_id)`. Backfill it from Storyline nodes that already link to events.
- `event_levers`: `event_id, lever text check in ('influence','watch')`. This is set per project. It describes whether *we* can push the event.
- `signposts`: `id, scenario_id, name, state text check in ('not_yet','approaching','hit'), hit_at timestamptz null, source_event_id null`. Add a trigger that rejects a signpost linked to an event that supports more than one scenario equally.
- `discovered_events`: `id, title, source_name, source_url, found_at, likelihood_level, proposed_force_id null, proposed_pole text null, proposed_scenarios uuid[], fits boolean, proposal text null, status text check in ('pending','confirmed','sent_to_signals','rejected'), reviewed_by, reviewed_at`.
- `action_cards`: `id, urgency text check in ('urgent','high','medium'), audience text check in ('ceo','cso'), scenario_id null, trigger_kind text check in ('target_catalyst_weakening','blocker_rising','influenceable_gaining','event_threshold','signpost_hit','frame_check','momentum_flip'), evidence_event_id null, evidence_discovery_id null, title, body, effect jsonb` (`{move_id, status}` or `{navigate}`), `status text check in ('pending','accepted','deferred','dismissed'), owner_id null, due_on date null, decided_by, decided_at`. Add a check that requires at least one evidence column to be non-null.
- `strategy_targets`: one row per strategy, holding `strategy_id, scenario_id, chosen_by, chosen_at`. **Do not add a target or desirability column to `scenarios`.**
- `route_moves`: `id, strategy_id, scenario_id (target it serves), lane text check in ('noregret','shaping','hedge'), horizon text check in ('now','2027','2028','2029_30')` (generate the horizon buckets from the project horizon later; fixed for now), `title, link_kind text check in ('event','signpost','option'), link_id uuid, pushes boolean default false, status text check in ('active','planned','held','armed','paused')`.
- `strategy_revisions`: `id, strategy_id, since date, items jsonb` (`[{kind:'re_sequence'|'new_move'|'re_score', text}]`), `status text check in ('proposed','applied','dismissed')`.
- `briefings`: `id, audience, period_start, period_end, payload jsonb, sent_at null`.
- `momentum_snapshots`: `scenario_id, taken_at, score numeric, label text, progress smallint`. One row per scenario per scan.

Acceptance: the migration runs clean, RLS denies a non-member on every table, and no column anywhere stores a scenario probability.

---

## Prompt 2 — Roll-up functions (port `DecisionModel`)

Port `window.DecisionModel` from `decision-data.js` into SQL functions, or into a shared TS module used by an edge function. The results must match the reference on the seed data.

- `delta(event)` = the current level minus the level at the start of the window (default 12 weeks).
- `momentum(scenario)` = Σ over supporting events of `delta × impact`. Labels: ≥6 Building, ≥2 Edging up, ≤−6 Fading, ≤−2 Easing, otherwise Steady. Also return the contributing events, sorted by |score|.
- `progress(scenario)` = the highest storyline phase for which **every** linked event in that phase is at High (3) or above.
- `levers(target)`: influence and watch = supporting events, split by `event_levers`. Blockers = tracked events that do not support the target.
- `health(target)` returns On course / Holding / At risk / Off course, using the reference rules:
  - Off course: the target's momentum is below 0 **and** a rival scenario's momentum is ≥ 6.
  - At risk: a supporting event with impact ≥ 4 is weakening, **or** a blocker is rising.
  - Holding: gaining ≤ weakening.
  - On course: otherwise.

  Also return the gaining, weakening and rising-blocker lists.
- `compass_position(axis_force)` = clamp(±0.9, 2.4 × Σ(±impact × level) / Σ(impact × 4)). The sign is + for events on the "plus" pole. This feeds the Home compass, and there is one value per axis per window point.

Add Vitest or pgTAP tests that use the seed values from `decision-data.js`. Expected results: Pacific Connector = "At risk", Fragmented Frontier has the highest momentum, and the Bamboo Curtain storyline has reached Catalysts.

---

## Prompt 3 — Daily scan job

Build a scheduled edge function, `decision-scan`, that runs daily at 06:00 in the project's time zone. For each project with at least one tracked event:

1. **Ingest** news from the configured sources (reuse the Signals research connector).
2. **Re-score.** For each tracked event, ask the model whether today's items change its likelihood level. Use temperature 0. The model returns JSON `{event_id, new_level, cite, source}` or `null`. Write a history row **only when the level changes**, and always store the cite. This is a closed-book judgement over the fetched items. No outside knowledge is allowed.
3. **Discover.** Items that don't match any tracked event become `discovered_events`. The model proposes a force and pole from *this project's* forces, or sets `fits=false` with a one-line `proposal` (a new force or a wildcard). Status is `pending`.
4. **Roll up.** Call the Prompt 2 functions and write `momentum_snapshots`. Update `signposts.state` and `hit_at`.
5. **Thresholds → action cards.** Create a card when any of these happens: a supporting event of the target drops a level (`target_catalyst_weakening`); a blocker rises (`blocker_rising`); an influenceable supporting event rises (`influenceable_gaining`); any event crosses into High or Occurred (`event_threshold`); a signpost is hit; a scenario's momentum label changes direction (`momentum_flip`); **or ≥2 pending discoveries have `fits=false`** (`frame_check`, effect `{navigate:'/app/signals'}`). The model drafts the title, body and effect from the project's route moves. Every card must reference its evidence. Skip a card if an equivalent pending card already exists.
6. **Revision.** If accepted or dismissed cards since the last strategy change touch at least 2 route moves, or a frame check is pending, draft a `strategy_revisions` row with status `proposed`.

Make the job idempotent per project per day. Log the run to `scan_runs (project_id, ran_at, sources_scanned, changes, cards_created)`. The UI shows "Last scan … · N sources" from this table.

---

## Prompt 4 — Shared client: `useDecisions` + shared UI

Replace the prototype's `window.DecisionStore` / `window.useDecisions` (localStorage) with a real hook, `useDecisions(projectId)`. It returns:
`{ target, setTarget, tracked[], signposts[], inbox[], actions[], route[], revision, health, momentumByScenario, lastScan }`, plus these mutations:
- `actOnCard(id, status)`. This also applies `effect.move_id → status` in one transaction. Setting a card back to `pending` reverts the move status.
- `reviewDiscovery(id, status)`. `confirmed` inserts the event, its force link and its scenario links.
- `setRevision(status)`.

Port `components/decision-ui.jsx` as-is into the repo's component folder: `DcSpark`, `DcTrend`, `DcScenarioDots`, `DcActionCard`, `DcBriefing`, `dcAct`. Swap only the data access, not the markup or the styles. `DcBriefing` reads its content from the latest `briefings` row for the chosen audience. Generate briefings weekly (Monday 07:00) and whenever a signpost is hit. The CEO payload holds decisions (CEO-audience cards), the top 3 moves, and momentum. The CSO payload adds all moves, frame health and the pending revision. "Send now" emails the rendered briefing to project members who have that role.

Acceptance: accepting the "Arm the Vietnam hosting hedge" card turns move `h1` from held to **armed** on Strategy and on the Home route mini-map without a reload (subscribe to realtime on `action_cards` and `route_moves`).
