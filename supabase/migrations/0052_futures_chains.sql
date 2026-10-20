-- Futures + Event chains (design/futures_chains_handoff/) — replaces Canvas, Storyline, and
-- Narrative with two new scenario pages. Schema only; the old pages' tables
-- (storyline_nodes/storyline_edges/scenario_storylines/plausibility_checks/signposts) are left
-- untouched here — they're retired in a later migration once the new pages are live.
--
-- chain_events is a NEW table, deliberately not an extension of the existing `events` table:
-- `events` already carries a richer model (STEEP category, observed/possible lifecycle,
-- event_likelihood_history time series, event_levers, insight provenance) that a simple
-- backcast ladder (one likelihood/impact rating, no lifecycle) doesn't need and shouldn't
-- pollute. `promoted_event_id` is the one-way graduation link into a real `events` row —
-- same shape as `event_proposals.created_event_id` — so a chain event can feed
-- Decisions/Strategy/Monitoring once explicitly promoted, without forcing those pages to read
-- a structurally different table.

create table public.futures_state (
  project_id uuid primary key references public.projects(id) on delete cascade,
  target_year smallint,
  generated_at timestamptz,
  chain_scenario_id uuid references public.scenarios(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.scenario_postcards (
  scenario_id uuid primary key references public.scenarios(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  headline text not null,
  story text not null,
  day text not null,
  us text not null,
  updated_by text not null check (updated_by in ('ai', 'user')),
  updated_at timestamptz not null default now()
);
create index scenario_postcards_project_id_idx on public.scenario_postcards(project_id);

create table public.scenario_narratives (
  scenario_id uuid primary key references public.scenarios(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  story jsonb not null,
  life jsonb not null,
  us_up jsonb not null,
  us_down jsonb not null,
  postcard_headline text,
  updated_by text not null check (updated_by in ('ai', 'user')),
  updated_at timestamptz not null default now()
);
create index scenario_narratives_project_id_idx on public.scenario_narratives(project_id);

-- desirability is the rating; stance is derived, never set directly — same "want"/"live"/
-- "avoid" split the handoff's BC.desirClass uses (>=4 / ==3 or null / <=2).
create table public.scenario_ratings (
  scenario_id uuid primary key references public.scenarios(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  desirability smallint check (desirability between 1 and 5),
  stance text generated always as (
    case
      when desirability >= 4 then 'want'
      when desirability <= 2 then 'avoid'
      else 'live'
    end
  ) stored,
  rated_by uuid references public.profiles(id),
  rated_at timestamptz
);
create index scenario_ratings_project_id_idx on public.scenario_ratings(project_id);

-- Real signal ids only, same join-table-not-free-text discipline as signal_insight_links.
create table public.scenario_early_signs (
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  signal_id uuid not null references public.signals(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  sort smallint not null default 0,
  primary key (scenario_id, signal_id)
);
create index scenario_early_signs_project_id_idx on public.scenario_early_signs(project_id);

create table public.chain_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  start_year smallint not null,
  target_year smallint not null,
  year smallint not null,
  title text not null,
  why text,
  forces text[] not null default '{}',
  indicator text,
  threshold text,
  -- "Can we move this event?" — unrelated to event_levers.lever (shape/influence/watch),
  -- a different existing 3-way classification on real `events`. This column only applies
  -- pre-promotion; see promoted_event_id below for the mapping used at promotion time.
  influence text not null check (influence in ('high', 'some', 'none')),
  move text,
  likelihood smallint check (likelihood between 1 and 5),
  impact smallint check (impact between 1 and 5),
  created_by text not null default 'ai' check (created_by in ('ai', 'user')),
  sort smallint not null default 0,
  promoted_event_id uuid references public.events(id) on delete set null,
  created_at timestamptz not null default now(),
  check (year > start_year and year <= target_year)
);
create index chain_events_scenario_target_year_idx on public.chain_events(scenario_id, target_year);

-- Backstop only — generateChain/save_chain are expected to clamp and re-spread before writing
-- (same rule as BC.spread), so this should rarely actually reject anything; it exists to catch
-- a manual add/edit (BcEventForm) that would otherwise violate the chain-size rule silently.
create or replace function public.enforce_chain_events_limits() returns trigger
language plpgsql
as $$
declare
  v_yrs int;
  v_max int;
  v_year_count int;
  v_total_count int;
begin
  v_yrs := greatest(1, new.target_year - new.start_year);
  v_max := least(3 * v_yrs, v_yrs + 2);

  select count(*) into v_year_count from public.chain_events
  where scenario_id = new.scenario_id and target_year = new.target_year and year = new.year
    and id is distinct from new.id;
  if v_year_count >= 3 then
    raise exception 'chain_events: at most 3 events per year (scenario %, year %)', new.scenario_id, new.year;
  end if;

  select count(*) into v_total_count from public.chain_events
  where scenario_id = new.scenario_id and target_year = new.target_year
    and id is distinct from new.id;
  if v_total_count >= v_max then
    raise exception 'chain_events: at most % events for a %-year horizon (scenario %)', v_max, v_yrs, new.scenario_id;
  end if;

  return new;
end;
$$;

create trigger chain_events_limits before insert or update on public.chain_events
for each row execute function public.enforce_chain_events_limits();

-- RLS — identical project-scoped predicate as every other project-scoped table
-- (0003_rls.sql:46-51), never `using (true)`.
do $$
declare
  t text;
begin
  foreach t in array array[
    'futures_state', 'scenario_postcards', 'scenario_narratives', 'scenario_ratings',
    'scenario_early_signs', 'chain_events'
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

-- Replaces all chain_events rows for (scenario_id, target_year) in one call. p_events is a
-- JSON array of {year, title, why, forces[], indicator, threshold, influence, move?,
-- likelihood?, impact?, created_by?}, already clamped/re-spread by the caller.
-- security invoker: RLS on chain_events still applies to the delete+insert.
create or replace function public.save_chain(p_scenario uuid, p_start_year smallint, p_target_year smallint, p_events jsonb)
returns setof public.chain_events
language plpgsql
security invoker
as $$
declare
  v_project uuid;
begin
  select project_id into v_project from public.scenarios where id = p_scenario;
  if v_project is null then
    raise exception 'save_chain: scenario % not found', p_scenario;
  end if;

  delete from public.chain_events
  where scenario_id = p_scenario and target_year = p_target_year;

  return query
  insert into public.chain_events (
    project_id, scenario_id, start_year, target_year, year, title, why, forces,
    indicator, threshold, influence, move, likelihood, impact, created_by, sort
  )
  select
    v_project, p_scenario, p_start_year, p_target_year,
    (e ->> 'year')::smallint,
    e ->> 'title',
    e ->> 'why',
    coalesce((select array_agg(x) from jsonb_array_elements_text(e -> 'forces') x), '{}'),
    e ->> 'indicator',
    e ->> 'threshold',
    e ->> 'influence',
    e ->> 'move',
    (e ->> 'likelihood')::smallint,
    (e ->> 'impact')::smallint,
    coalesce(e ->> 'created_by', 'ai'),
    (ord - 1)::smallint
  from jsonb_array_elements(p_events) with ordinality as t(e, ord)
  returning *;
end;
$$;
