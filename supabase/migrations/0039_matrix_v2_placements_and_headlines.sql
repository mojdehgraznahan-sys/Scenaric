-- Matrix v2 (design/handoff/2026-10-01/CLAUDE_CODE_MATRIX_V2_PROMPTS.md) — schema half of
-- Prompt 2, revised after auditing real consumers of the existing `axes` table. The prompt
-- file's own draft called for a brand-new `scenario_axes` table; that would have duplicated
-- `axes` (project_id, x_signal_id, y_signal_id, x_label, y_label, is_active) while breaking
-- three things nothing in this migration may touch:
--   1. scenarios.axes_id is a foreign key to axes.id — scenarios keep pointing at the exact
--      historical axes row they were built from, even after a later re-axis. A fresh
--      (project_id, position) table has no row identity for that FK to survive on.
--   2. axes.independence_state is the literal condition inside compute_steps_complete()
--      (0023_strategy_gate_and_drop_strategies.sql: `independence_state in ('independent',
--      'correlated')`) — the SQL function gating the whole app's step-4 progress tile. A
--      parallel table never populated with this column would leave every project stuck at
--      step 4 forever.
--   3. dashboard-recommendations.ts filters on that same column.
-- checkAxisIndependence (ai-matrix.ts) and buildScenarios (ai-scenarios.ts) — the AI content-
-- correlation check and the step that actually persists independence_state — are UNCHANGED by
-- Matrix v2 and keep writing to `axes` exactly as before. set_axes (Prompt 3, next migration)
-- only stages an (x_signal_id, y_signal_id) pair into `axes` ahead of that build step; it never
-- touches independence_state. The new "same event pulls both axes" warning the prompt file
-- describes is computed live from event_signal_links at read time — not a stored column — so
-- it needs no schema of its own.
--
-- What's new here is genuinely new: matrix_placements (the two-question placement, replacing
-- drag-to-position) and axis_headlines (the per-axis-per-side headline event), neither of which
-- any existing table covers.

create table public.matrix_placements (
  project_id uuid not null references public.projects(id) on delete cascade,
  signal_id uuid not null references public.signals(id) on delete cascade,
  x numeric not null check (x between 0 and 100), -- uncertainty; right = high
  y numeric not null check (y between 0 and 100), -- impact; top = high (0 is top)
  impact_answer text check (impact_answer in ('no', 'somewhat', 'completely')),
  plausible text check (plausible in ('both', 'a', 'b')), -- 'a'/'b' = only that pole is
  -- plausible, i.e. predetermined toward that pole
  confirmed boolean not null default false, -- false = migrated from the old star rating,
  -- never actually answered the two questions
  assessed_event_ids uuid[], -- the lead/A/B headline events shown when the user answered —
  -- an audit trail, not re-validated on read
  assessed_by uuid references auth.users(id) on delete set null,
  assessed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (project_id, signal_id),
  constraint matrix_placements_confirmed_requires_answers check (
    confirmed = false or (impact_answer is not null and plausible is not null)
  )
);
create index matrix_placements_project_id_idx on public.matrix_placements(project_id);

-- Backfill every existing dot as an unconfirmed placement at its old position — Prompt 6 (the
-- Matrix v2 verify pass) checks these render dashed with "Placed by star rating. Confirm it."
-- matrix_dots itself is left in place, read-only, until that verify pass is done (Prompt 5).
insert into public.matrix_placements (project_id, signal_id, x, y, confirmed)
select project_id, signal_id, x, y, false from public.matrix_dots
on conflict (project_id, signal_id) do nothing;

create table public.axis_headlines (
  project_id uuid not null references public.projects(id) on delete cascade,
  signal_id uuid not null references public.signals(id) on delete cascade,
  side text not null check (side in ('a', 'b')),
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, signal_id, side)
);

-- Guards the one invariant a plain check constraint can't express: the headline event must
-- actually be linked to this signal on this side (not the other pole, not unlinked), must not
-- be a wildcard (wildcards are listed beside the matrix and never plotted or used as an axis
-- end, per the prompt file's own "Hold the implementer to"), and must belong to the same
-- project as the signal/headline row itself — same "guard at the column level" pattern as
-- 0030_indicator_reading_grounding.sql's enforce_indicator_reading_grounding.
create or replace function public.enforce_axis_headline_event() returns trigger as $$
declare
  link_exists boolean;
  event_is_wildcard boolean;
  event_project_id uuid;
begin
  select exists(
    select 1 from public.event_signal_links
    where event_id = new.event_id and signal_id = new.signal_id and side = new.side
  ) into link_exists;
  if not link_exists then
    raise exception 'axis_headlines: event % is not linked to signal % on side %', new.event_id, new.signal_id, new.side;
  end if;

  select is_wildcard, project_id into event_is_wildcard, event_project_id
  from public.events where id = new.event_id;
  if event_is_wildcard then
    raise exception 'axis_headlines: event % is a wildcard and cannot be an axis headline', new.event_id;
  end if;
  if event_project_id is distinct from new.project_id then
    raise exception 'axis_headlines: event % belongs to a different project', new.event_id;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger axis_headlines_require_valid_event
  before insert or update on public.axis_headlines
  for each row execute function public.enforce_axis_headline_event();

alter table public.matrix_placements enable row level security;
alter table public.axis_headlines enable row level security;

-- Mirrors EXACTLY the predicate on signals/axes/matrix_dots (0003_rls.sql) — never `using (true)`.
create policy "manage rows in own org's projects" on public.matrix_placements
  for all
  using (project_id in (select id from public.projects where org_id = public.current_org_id()))
  with check (project_id in (select id from public.projects where org_id = public.current_org_id()));

create policy "manage rows in own org's projects" on public.axis_headlines
  for all
  using (project_id in (select id from public.projects where org_id = public.current_org_id()))
  with check (project_id in (select id from public.projects where org_id = public.current_org_id()));
