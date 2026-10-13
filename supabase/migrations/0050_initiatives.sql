-- Initiatives (design/strategy_handoff's Prompt 2/5) — the one genuinely new entity from that
-- handoff, layered onto the decision layer already built in 0042_decision_layer.sql. An
-- initiative is a candidate project/research effort the org could launch, distinct from both
-- an action_card (Monitoring-raised, reacts to a threshold crossing) and a route_move (the
-- swimlane itself) — approving one inserts a route_move, same as the rest of this table's
-- siblings.
--
-- Review lifecycle matches action_cards/discovered_events (persisted pending row, reviewed in
-- place via status, Undo by flipping status back to null) — NOT Draft Route's hold-in-client-
-- state-until-confirmed, and NOT Storyline's silent wholesale replace. See this session's own
-- discussion of why those two patterns don't fit this entity's "several independent
-- candidates, each reviewed on its own" purpose.
create table public.initiatives (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null check (kind in ('shape', 'influence', 'research', 'hedge')),
  title text not null,
  why text not null,
  question text, -- research-kind only ("question to answer")
  informs text,  -- research-kind only ("what this informs")
  force_label text,
  pole_label text,
  owner text,
  cost text,
  time_label text,
  early_sign text not null,
  stop_if text not null,
  -- {scenario_id: 'helps'|'neutral'|'hurts'}, one entry per project scenario. Not a trigger —
  -- this codebase validates AI-output shape invariants in the action layer (see ai-strategy.ts
  -- filtering ungrounded scores before insert), not in PL/pgSQL; suggestInitiatives rejects/
  -- retries an output missing a scenario before insert ever happens.
  wind jsonb not null,
  -- [{source, cite}], at least one — purely structural, no cross-table lookup needed, so this
  -- one IS a plain DB check.
  evidence jsonb not null check (jsonb_typeof(evidence) = 'array' and jsonb_array_length(evidence) >= 1),
  status text check (status in ('approved', 'dismissed')), -- null = pending review
  created_by text not null check (created_by in ('ai', 'user')),
  created_at timestamptz not null default now()
);
create index initiatives_project_id_idx on public.initiatives(project_id, status);

create table public.initiative_targets (
  id uuid primary key default gen_random_uuid(),
  -- Denormalized alongside initiative_id, same convention as every other content table in
  -- 0001_schema.sql (storyline_edges, implications, event_signal_links, ...) — keeps RLS simple
  -- and guards against a row ever crossing projects via a stale id.
  project_id uuid not null references public.projects(id) on delete cascade,
  initiative_id uuid not null references public.initiatives(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  title text, -- freeform target when there's no real event yet (e.g. a KB-sourced claim)
  control text not null check (control in ('shape', 'influence', 'watch')),
  check (event_id is not null or title is not null)
);
create index initiative_targets_initiative_id_idx on public.initiative_targets(initiative_id);
create index initiative_targets_project_id_idx on public.initiative_targets(project_id);

alter table public.initiatives enable row level security;
create policy "manage rows in own org's projects" on public.initiatives
  for all
  using (project_id in (select id from public.projects where org_id = public.current_org_id()))
  with check (project_id in (select id from public.projects where org_id = public.current_org_id()));

alter table public.initiative_targets enable row level security;
create policy "manage rows in own org's projects" on public.initiative_targets
  for all
  using (project_id in (select id from public.projects where org_id = public.current_org_id()))
  with check (project_id in (select id from public.projects where org_id = public.current_org_id()));

-- route_moves gains a fourth link_kind: an approved initiative becomes a move the same way an
-- option/event/signpost does. initiative_id is redundant with link_id when link_kind =
-- 'initiative' (link_id already generically points at "whatever this move references") but
-- kept as its own FK + unique pair so "has this initiative already been approved into this
-- scenario's route" is a plain index lookup, not a link_kind-filtered scan.
alter table public.route_moves drop constraint route_moves_link_kind_check;
alter table public.route_moves add constraint route_moves_link_kind_check check (link_kind in ('event', 'signpost', 'option', 'initiative'));
alter table public.route_moves add column initiative_id uuid references public.initiatives(id) on delete cascade;
alter table public.route_moves add constraint route_moves_initiative_id_required check (link_kind <> 'initiative' or initiative_id is not null);
alter table public.route_moves add constraint route_moves_one_per_initiative_per_scenario unique (scenario_id, initiative_id);
