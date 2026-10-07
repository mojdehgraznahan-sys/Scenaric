-- Decision layer (design/2026-10-05/01-shared-decision-layer/PROMPTS.md) — Monitoring v2 and
-- Strategy v2's shared backend. Traces event likelihood -> scenario momentum/health ->
-- recommended actions -> a route of moves toward a chosen target scenario. Likelihood lives on
-- EVENTS only (event_likelihood_history); a scenario never gets a probability or a percentage,
-- only derived momentum/health (computed in src/lib/decision-model.ts, never stored as a raw
-- score column here beyond momentum_snapshots' own point-in-time log).
--
-- Supersedes `indicators`/`indicator_readings` (0001, 0021, 0025) and their daily
-- indicators-monitor cron: that system measured a different thing (a named indicator's
-- On track/Watch/Alert status, usually tied to a whole scenario) from what this one measures
-- (a specific event's likelihood level, rolled up into scenario momentum). `indicators` and
-- `indicator_readings` are left in place, untouched, for a release's grace period — the
-- indicators-monitor cron and Monitoring's old UI are decommissioned in the app-code changes
-- that ship alongside Monitoring v2, not here. A follow-up migration drops the tables once
-- nothing reads them (same caution as 0023's eventual drop of the old `strategies` table).
--
-- `signposts` (0016_signposts_and_plausibility.sql) already exists — AI-generated,
-- web-search-grounded, rendered live in Storyline/Dashboard/the grounding API routes. The
-- design handoff's Prompt 1 asks to *create* a `signposts` table with a different shape; that
-- would collide with the real one. Extended below instead of recreated: `status`
-- ('On track'/'Watch'/'Alert', the AI-generation vocabulary) stays for now, `state`
-- ('not_yet'/'approaching'/'hit') is the new decision-layer vocabulary new code writes to.

-- ---------------------------------------------------------------- signposts (extend, not create)
alter table public.signposts add column state text check (state in ('not_yet', 'approaching', 'hit'));
alter table public.signposts add column hit_at timestamptz;
alter table public.signposts add column source_event_id uuid references public.events(id) on delete set null;

-- One-time, approximate backfill — status and state measure different things (risk-level vs.
-- progress-to-occurrence), so this is an honest best-effort default, not a precise mapping.
-- New code stops writing `status`; it stays for now so nothing currently reading it breaks,
-- and is dropped in a later cleanup migration once confirmed unused.
update public.signposts
  set state = case status when 'On track' then 'not_yet' when 'Watch' then 'approaching' when 'Alert' then 'hit' end
  where state is null;

-- ---------------------------------------------------------------- storyline_nodes (extend)
-- `signal_id` stays — still valid for any node not yet traced to one specific event. New nodes
-- (via the event-picker-modal rework) set event_id directly; existing nodes are backfilled by
-- a one-time AI-proposes/human-confirms pass (src/lib/actions/ai-storyline-event-backfill.ts),
-- not by this migration — there is no deterministic SQL mapping from a signal to one of
-- possibly-many events linked to it (event_signal_links has no node-level pole/direction to
-- disambiguate against; see that file's own comment).
alter table public.storyline_nodes add column event_id uuid references public.events(id) on delete set null;

-- ---------------------------------------------------------------- event_likelihood_history
create table public.event_likelihood_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  level smallint not null check (level between 0 and 4), -- 0 Ruled out, 1 Low, 2 Medium, 3 High, 4 Occurred
  observed_at timestamptz not null default now(),
  source_title text,
  source_name text,
  source_url text,
  cite text,
  changed_by text not null check (changed_by in ('scan', 'user')),
  created_at timestamptz not null default now()
);
create index event_likelihood_history_event_id_idx on public.event_likelihood_history(event_id, observed_at desc);
create index event_likelihood_history_project_id_idx on public.event_likelihood_history(project_id);

-- The current likelihood is simply the latest history row per event. security_invoker = true
-- (same convention as matrix_placements_v, 0040) so the view evaluates the querying role's own
-- RLS on event_likelihood_history, not the view owner's.
create view public.event_likelihood_current
with (security_invoker = true)
as
select distinct on (event_id) *
from public.event_likelihood_history
order by event_id, observed_at desc;

-- ---------------------------------------------------------------- event_scenario_links
-- phase reuses storyline_nodes' own 5-phase text enum (not the handoff's standalone smallint
-- 0-4) — this app already has exactly one phase vocabulary, no reason for a second.
create table public.event_scenario_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  phase text not null check (phase in ('precursors', 'catalysts', 'first_order', 'second_order', 'realized')),
  created_at timestamptz not null default now(),
  unique (event_id, scenario_id)
);
create index event_scenario_links_event_id_idx on public.event_scenario_links(event_id);
create index event_scenario_links_scenario_id_idx on public.event_scenario_links(scenario_id);

-- ---------------------------------------------------------------- event_levers
-- Per-project judgment of whether *we* can push a tracked event ('influence') or can only
-- prepare for it ('watch'). One row per event; absence of a row means "not yet classified",
-- not "blocker" — levers() in decision-model.ts treats an event with no row as neither
-- influence nor watch, only as a blocker candidate if it doesn't support the target scenario.
create table public.event_levers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  lever text not null check (lever in ('influence', 'watch')),
  created_at timestamptz not null default now(),
  unique (event_id)
);

-- ---------------------------------------------------------------- discovered_events
-- News-sourced candidates the daily scan found that don't yet match a tracked event. Nothing
-- here is confirmed into the project automatically (methodology guardrail #4). Reuses the real
-- `events` table's own status/likelihood vocabulary (not a parallel one) and `side` ('a'/'b',
-- 0038) instead of free-text `toward`, for the same reason event_signal_links already made
-- that switch. The handoff's own column name for the review-workflow field is `status`, but
-- that collides with the observed/possible `status` borrowed from `events` above — renamed to
-- `dc_status` here to keep both meanings on the same row without ambiguity.
create table public.discovered_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  body text,
  source_name text,
  source_url text,
  found_at timestamptz not null default now(),
  status text not null default 'possible' check (status in ('observed', 'possible')),
  likelihood text check (likelihood in ('Low', 'Medium', 'High')), -- meaningful only when possible
  proposed_force_id uuid references public.signals(id) on delete set null,
  proposed_side text check (proposed_side in ('a', 'b')),
  proposed_scenarios uuid[] not null default '{}',
  fits boolean not null,
  proposal text, -- one-line "new force" suggestion when fits = false
  dc_status text not null default 'pending' check (dc_status in ('pending', 'confirmed', 'sent_to_signals', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index discovered_events_project_id_idx on public.discovered_events(project_id, dc_status);

-- ---------------------------------------------------------------- action_cards
create table public.action_cards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  urgency text not null check (urgency in ('urgent', 'high', 'medium')),
  audience text not null check (audience in ('ceo', 'cso')),
  scenario_id uuid references public.scenarios(id) on delete set null,
  trigger_kind text not null check (trigger_kind in (
    'target_catalyst_weakening', 'blocker_rising', 'influenceable_gaining', 'event_threshold',
    'signpost_hit', 'frame_check', 'momentum_flip'
  )),
  evidence_event_id uuid references public.events(id) on delete set null,
  evidence_discovery_id uuid references public.discovered_events(id) on delete set null,
  title text not null,
  body text not null,
  effect jsonb not null default '{}', -- {move_id, status} or {navigate}
  status text not null default 'pending' check (status in ('pending', 'accepted', 'deferred', 'dismissed')),
  owner_id uuid references auth.users(id) on delete set null,
  due_on date,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint action_cards_requires_evidence check (evidence_event_id is not null or evidence_discovery_id is not null)
);
create index action_cards_project_id_idx on public.action_cards(project_id, status);

-- ---------------------------------------------------------------- strategy_targets
-- One target scenario per project (not per strategic_options row — the reference UI picks one
-- target for the whole project; "strategy" in the handoff's own wording means the project's
-- overall strategy, not a specific strategic_options candidate). A plain upsert on
-- conflict(project_id) from the action layer is enough to swap it — no PL/pgSQL function
-- needed, unlike set_primary_strategic_option's multi-row unset-then-set.
create table public.strategy_targets (
  project_id uuid primary key references public.projects(id) on delete cascade,
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  chosen_by uuid references auth.users(id) on delete set null,
  chosen_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- route_moves
-- link_id is a polymorphic reference (event | signpost | option) with no FK constraint,
-- validated in the action layer — same precedent as indicators.grounded_in's mixed reference
-- space (0025's comment).
create table public.route_moves (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scenario_id uuid not null references public.scenarios(id) on delete cascade, -- target this move serves
  lane text not null check (lane in ('noregret', 'shaping', 'hedge')),
  horizon text not null check (horizon in ('now', '2027', '2028', '2029_30')),
  title text not null,
  link_kind text not null check (link_kind in ('event', 'signpost', 'option')),
  link_id uuid not null,
  pushes boolean not null default false,
  status text not null default 'planned' check (status in ('active', 'planned', 'held', 'armed', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index route_moves_project_id_idx on public.route_moves(project_id, scenario_id);

-- ---------------------------------------------------------------- strategy_revisions
create table public.strategy_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  since date not null default current_date,
  items jsonb not null default '[]', -- [{kind: 're_sequence'|'new_move'|'re_score', text}]
  status text not null default 'proposed' check (status in ('proposed', 'applied', 'dismissed')),
  created_at timestamptz not null default now()
);
create index strategy_revisions_project_id_idx on public.strategy_revisions(project_id, status);

-- ---------------------------------------------------------------- briefings
create table public.briefings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  audience text not null check (audience in ('ceo', 'cso')),
  period_start date not null,
  period_end date not null,
  payload jsonb not null default '{}',
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index briefings_project_id_idx on public.briefings(project_id, audience, period_start desc);

-- ---------------------------------------------------------------- momentum_snapshots
create table public.momentum_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  taken_at timestamptz not null default now(),
  score numeric not null,
  label text not null check (label in ('Building', 'Edging up', 'Steady', 'Easing', 'Fading')),
  progress smallint not null default 0
);
create index momentum_snapshots_scenario_id_idx on public.momentum_snapshots(scenario_id, taken_at desc);

-- ---------------------------------------------------------------- scan_runs
-- One row per daily decision-scan invocation per project — Monitoring's "Last scan ... N
-- sources" line reads this, same role ai_runs.batch_id plays for indicator monitoring but
-- scoped to this one job and queryable without joining through ai_runs.
create table public.scan_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  ran_at timestamptz not null default now(),
  sources_scanned int not null default 0,
  changes int not null default 0,
  cards_created int not null default 0
);
create index scan_runs_project_id_idx on public.scan_runs(project_id, ran_at desc);

-- ---------------------------------------------------------------- RLS
-- Same shape as every project-scoped table since 0003: enable RLS, one "manage rows in own
-- org's projects" policy gated on project_id. No is_project_member() helper exists in this
-- codebase — current_org_id() is the real idiom.
do $$
declare
  t text;
begin
  foreach t in array array[
    'event_likelihood_history', 'event_scenario_links', 'event_levers', 'discovered_events',
    'action_cards', 'route_moves', 'strategy_revisions', 'briefings', 'momentum_snapshots',
    'scan_runs'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "manage rows in own org''s projects" on public.%I
         for all
         using (project_id in (select id from public.projects where org_id = public.current_org_id()))
         with check (project_id in (select id from public.projects where org_id = public.current_org_id()))',
      t
    );
  end loop;
end $$;

-- strategy_targets isn't in the loop above only because its primary key IS project_id (no
-- separate id column) — the policy itself is identical.
alter table public.strategy_targets enable row level security;
create policy "manage rows in own org's projects" on public.strategy_targets
  for all
  using (project_id in (select id from public.projects where org_id = public.current_org_id()))
  with check (project_id in (select id from public.projects where org_id = public.current_org_id()));
