-- Merges Storyline + Event chains into one page (design/storyline_handoff/). chain_events
-- gains analog ("Seen before in") — sort (order within a year) already exists from 0052, just
-- unused by Event chains until now; the per-year/per-chain caps drop from the original
-- Event-chains rule to the Storyline rule (2/year, min(2*yrs, yrs+3) total); chain_event_links
-- lets one event point to a later one ("also leads to"). storyline_edges (0001_schema.sql) is
-- NOT reused here — it's hard-FK'd to storyline_nodes, a different table being retired
-- separately, not to chain_events.
alter table public.chain_events add column analog text;
alter table public.chain_events
  add constraint chain_events_scenario_year_sort_key
  unique (scenario_id, target_year, year, sort) deferrable initially deferred;
-- Replaces 0052's version of this function — same trigger (chain_events_limits) already
-- points at it, so only the function body changes: caps drop from 3/year and
-- min(3*yrs, yrs+2) to 2/year and min(2*yrs, yrs+3).
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
  v_max := least(2 * v_yrs, v_yrs + 3);

  select count(*) into v_year_count from public.chain_events
  where scenario_id = new.scenario_id and target_year = new.target_year and year = new.year
    and id is distinct from new.id;
  if v_year_count >= 2 then
    raise exception 'chain_events: at most 2 events per year (scenario %, year %)', new.scenario_id, new.year;
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

create table public.chain_event_links (
  from_event_id uuid not null references public.chain_events(id) on delete cascade,
  to_event_id uuid not null references public.chain_events(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_event_id, to_event_id),
  check (from_event_id <> to_event_id)
);
create index chain_event_links_project_id_idx on public.chain_event_links(project_id);

-- Links only ever point forward in sequence: same (scenario_id, target_year), and the target
-- sorts strictly after the source by (year, sort). save_chain is expected to drop a link that
-- would violate this (e.g. after a reorder) rather than let the whole save fail — this trigger
-- is the backstop for any other write path.
create or replace function public.enforce_chain_event_link_order() returns trigger
language plpgsql
as $$
declare
  v_from public.chain_events;
  v_to public.chain_events;
begin
  select * into v_from from public.chain_events where id = new.from_event_id;
  select * into v_to from public.chain_events where id = new.to_event_id;
  if v_from.id is null or v_to.id is null then
    raise exception 'chain_event_links: one or both events not found';
  end if;
  if v_from.scenario_id <> v_to.scenario_id or v_from.target_year <> v_to.target_year then
    raise exception 'chain_event_links: events must share the same scenario and target year';
  end if;
  if (v_to.year, v_to.sort) <= (v_from.year, v_from.sort) then
    raise exception 'chain_event_links: a link must point to a strictly later event in sequence';
  end if;
  return new;
end;
$$;

create trigger chain_event_links_order before insert or update on public.chain_event_links
for each row execute function public.enforce_chain_event_link_order();

alter table public.chain_event_links enable row level security;
create policy "manage rows in own org's projects" on public.chain_event_links
  for all
  using (project_id in (select id from public.projects where org_id = public.current_org_id()))
  with check (project_id in (select id from public.projects where org_id = public.current_org_id()));

-- Rewrite of save_chain (0052): the old version deleted and reinserted every row on every
-- call, including a single rating click — meaning every edit silently reassigned new ids to
-- every event, which would have destroyed chain_event_links on any edit. This version upserts
-- by id (keeping ids stable), and resolves `links` as 0-based INDICES into the p_events array
-- rather than real ids — the client always has the full array in memory already (same
-- always-send-the-whole-chain contract as before) and a brand-new, not-yet-saved event has no
-- real id yet to reference anyway. Any link whose target would violate forward-only sequencing
-- after sort is assigned is dropped silently (matches the client's own moveTo behavior), not
-- treated as a failure.
create or replace function public.save_chain(p_scenario uuid, p_start_year smallint, p_target_year smallint, p_events jsonb)
returns setof public.chain_events
language plpgsql
security invoker
as $$
declare
  v_project uuid;
  v_event jsonb;
  v_ord int := 0;
  v_id uuid;
  v_ids uuid[] := '{}';
  v_year smallint;
  v_sort smallint;
  v_link_from uuid;
  v_link_to uuid;
  v_link_idx int;
begin
  select project_id into v_project from public.scenarios where id = p_scenario;
  if v_project is null then
    raise exception 'save_chain: scenario % not found', p_scenario;
  end if;

  -- Pass 1: upsert every event (by id when it already exists for this scenario/target_year,
  -- else insert new), assigning sort = position within its own year from array order.
  for v_event in select * from jsonb_array_elements(p_events)
  loop
    v_year := (v_event ->> 'year')::smallint;
    select count(*) into v_sort
    from jsonb_array_elements(p_events) with ordinality as t(e, o)
    where (e ->> 'year')::smallint = v_year and o - 1 < v_ord;

    v_id := null;
    if coalesce(v_event ->> 'id', '') <> '' then
      v_id := (v_event ->> 'id')::uuid;
      update public.chain_events set
        start_year = p_start_year,
        title = v_event ->> 'title',
        why = v_event ->> 'why',
        analog = v_event ->> 'analog',
        forces = coalesce((select array_agg(x) from jsonb_array_elements_text(v_event -> 'forces') x), '{}'),
        indicator = v_event ->> 'indicator',
        threshold = v_event ->> 'threshold',
        influence = v_event ->> 'influence',
        move = v_event ->> 'move',
        likelihood = (v_event ->> 'likelihood')::smallint,
        impact = (v_event ->> 'impact')::smallint,
        year = v_year,
        sort = v_sort
      where id = v_id and scenario_id = p_scenario and target_year = p_target_year;
      if not found then
        v_id := null; -- stale/foreign id — fall through and insert as new instead
      end if;
    end if;

    if v_id is null then
      insert into public.chain_events (
        project_id, scenario_id, start_year, target_year, year, title, why, analog, forces,
        indicator, threshold, influence, move, likelihood, impact, created_by, sort
      ) values (
        v_project, p_scenario, p_start_year, p_target_year, v_year,
        v_event ->> 'title', v_event ->> 'why', v_event ->> 'analog',
        coalesce((select array_agg(x) from jsonb_array_elements_text(v_event -> 'forces') x), '{}'),
        v_event ->> 'indicator', v_event ->> 'threshold', v_event ->> 'influence', v_event ->> 'move',
        (v_event ->> 'likelihood')::smallint, (v_event ->> 'impact')::smallint,
        coalesce(v_event ->> 'created_by', 'ai'), v_sort
      )
      returning id into v_id;
    end if;

    v_ids := array_append(v_ids, v_id);
    v_ord := v_ord + 1;
  end loop;

  delete from public.chain_events
  where scenario_id = p_scenario and target_year = p_target_year
    and id <> all (v_ids);

  delete from public.chain_event_links
  using public.chain_events ce
  where chain_event_links.from_event_id = ce.id
    and ce.scenario_id = p_scenario and ce.target_year = p_target_year;

  -- Pass 2: replace links, resolving each payload's 0-based index into the real id assigned
  -- (or kept) in pass 1.
  v_ord := 0;
  for v_event in select * from jsonb_array_elements(p_events)
  loop
    v_link_from := v_ids[v_ord + 1];
    for v_link_idx in select jsonb_array_elements_text(coalesce(v_event -> 'links', '[]'::jsonb))::int
    loop
      if v_link_idx >= 0 and v_link_idx < array_length(v_ids, 1) and v_link_idx <> v_ord then
        v_link_to := v_ids[v_link_idx + 1];
        begin
          insert into public.chain_event_links (from_event_id, to_event_id, project_id)
          values (v_link_from, v_link_to, v_project);
        exception when others then
          null; -- backward/invalid link after reorder — drop rather than fail the save
        end;
      end if;
    end loop;
    v_ord := v_ord + 1;
  end loop;

  return query
  select * from public.chain_events
  where scenario_id = p_scenario and target_year = p_target_year
  order by year, sort;
end;
$$;
