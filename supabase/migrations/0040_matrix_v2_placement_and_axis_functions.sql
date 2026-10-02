-- Matrix v2 (design/handoff/2026-10-01/CLAUDE_CODE_MATRIX_V2_PROMPTS.md) — Prompt 3, revised
-- to target the existing `axes` table per 0039's comment (no `scenario_axes` duplicate).
-- place_force/matrix_placements_v match the prompt file's mxPlace/mxQuad exactly, confirmed
-- against design/handoff/2026-10-01/Matrix Standalone (offline).html's own source:
--   mxPlace: y = {completely:18, somewhat:38, no:72}[impactAns]; x = plausible==='both' ? 74 : 24
--   mxQuad:  y<50 ? (x>50 ? critical : predetermined) : (x>50 ? monitor : background)

-- "No client can place a dot anywhere it likes" (prompt file, line 14) needs more than
-- place_force validating its own inputs — a client could still call PostgREST directly and
-- upsert matrix_placements with confirmed=true and any x/y it wants; RLS alone only checks
-- project ownership, not value correctness. This trigger closes that gap: a confirmed row's
-- x/y must match the same deterministic mapping place_force uses, for ANY writer, which is
-- exactly what Prompt 6's own verify step 3 ("a direct insert or update with arbitrary x/y and
-- confirmed=true fails RLS or the check") requires but doesn't say how to enforce.
create or replace function public.enforce_matrix_placement_mapping() returns trigger as $$
begin
  if new.confirmed then
    if new.y is distinct from (case new.impact_answer when 'completely' then 18 when 'somewhat' then 38 when 'no' then 72 end) then
      raise exception 'matrix_placements: confirmed y (%) does not match mxPlace(%) for impact_answer', new.y, new.impact_answer;
    end if;
    if new.x is distinct from (case when new.plausible = 'both' then 74 else 24 end) then
      raise exception 'matrix_placements: confirmed x (%) does not match mxPlace(%) for plausible', new.x, new.plausible;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger matrix_placements_enforce_mapping
  before insert or update on public.matrix_placements
  for each row execute function public.enforce_matrix_placement_mapping();

-- security invoker (the default for a plain function, stated explicitly per the prompt file):
-- place_force runs as the calling user, so the matrix_placements RLS policy still applies on
-- top of the explicit checks below — this function narrows what a valid call can do, it isn't
-- a privilege escalation.
create or replace function public.place_force(
  p_project uuid,
  p_signal uuid,
  p_impact text,
  p_plausible text,
  p_event_ids uuid[]
) returns public.matrix_placements
language plpgsql
security invoker
as $$
declare
  v_pole_a text;
  v_pole_b text;
  v_unlinked_count int;
  v_y numeric;
  v_x numeric;
  v_result public.matrix_placements;
begin
  if p_impact not in ('no', 'somewhat', 'completely') then
    raise exception 'place_force: invalid impact answer %', p_impact;
  end if;
  if p_plausible not in ('both', 'a', 'b') then
    raise exception 'place_force: invalid plausible answer %', p_plausible;
  end if;

  select pole_a, pole_b into v_pole_a, v_pole_b
  from public.signals
  where id = p_signal and project_id = p_project;
  if not found then
    raise exception 'place_force: signal % is not in project %', p_signal, p_project;
  end if;
  if v_pole_a is null or v_pole_b is null then
    raise exception 'place_force: signal % has no pole_a/pole_b set', p_signal;
  end if;

  if p_event_ids is not null and array_length(p_event_ids, 1) > 0 then
    select count(*) into v_unlinked_count
    from unnest(p_event_ids) as eid
    where not exists (
      select 1 from public.event_signal_links
      where event_id = eid and signal_id = p_signal
    );
    if v_unlinked_count > 0 then
      raise exception 'place_force: % of the given event(s) are not linked to signal %', v_unlinked_count, p_signal;
    end if;
  end if;

  v_y := case p_impact when 'completely' then 18 when 'somewhat' then 38 when 'no' then 72 end;
  v_x := case when p_plausible = 'both' then 74 else 24 end;

  insert into public.matrix_placements (
    project_id, signal_id, x, y, impact_answer, plausible, confirmed,
    assessed_event_ids, assessed_by, assessed_at, updated_at
  ) values (
    p_project, p_signal, v_x, v_y, p_impact, p_plausible, true,
    p_event_ids, auth.uid(), now(), now()
  )
  on conflict (project_id, signal_id) do update set
    x = excluded.x,
    y = excluded.y,
    impact_answer = excluded.impact_answer,
    plausible = excluded.plausible,
    confirmed = true,
    assessed_event_ids = excluded.assessed_event_ids,
    assessed_by = excluded.assessed_by,
    assessed_at = excluded.assessed_at,
    updated_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

-- security_invoker = true (PG15+; this project runs on a current Supabase Postgres, well past
-- 15) makes the view evaluate matrix_placements'/signals' RLS as the QUERYING role, not the
-- view's owner — the unambiguous way to keep a view over RLS-protected tables safe, rather than
-- relying on owner-privilege defaults that have shifted across Postgres versions.
create view public.matrix_placements_v
with (security_invoker = true)
as
select
  mp.*,
  case
    when mp.y < 50 then (case when mp.x > 50 then 'critical' else 'predetermined' end)
    else (case when mp.x > 50 then 'monitor' else 'background' end)
  end as quadrant,
  case mp.plausible
    when 'a' then s.pole_a
    when 'b' then s.pole_b
    else null
  end as settled_pole
from public.matrix_placements mp
join public.signals s on s.id = mp.signal_id;

-- set_axes stages a pick of up to 2 critical-quadrant forces into the EXISTING `axes` table
-- (see 0039's comment for why there's no separate scenario_axes table). It never touches
-- independence_state/independence_rationale — those stay owned by checkAxisIndependence
-- (ai-matrix.ts) and buildScenarios (ai-scenarios.ts), unchanged by Matrix v2. Position 1 is
-- x_signal_id and position 2 is y_signal_id — per MatrixV2's own data contract comment in the
-- standalone file ("axes [sigId, sigId?] axis 1 = horizontal, axis 2 = vertical") and MXWorlds'
-- call site (`<MXWorlds x={ax[0]} y={ax[1]}>`), i.e. the UI's `axes` array is position-ordered
-- x-then-y, not the ai-grounding.ts/ai-storyline.ts axisA/axisB naming (which is an unrelated,
-- older internal label — axisA there means y_signal_id — not an array-position contract).
create or replace function public.set_axes(p_project uuid, p_ids uuid[]) returns public.axes
language plpgsql
security invoker
as $$
declare
  v_len int;
  v_scenario_count int;
  v_invalid_ids uuid[];
  v_result public.axes;
begin
  v_len := coalesce(array_length(p_ids, 1), 0);
  if v_len > 2 then
    raise exception 'set_axes: pass at most 2 signal ids, got %', v_len;
  end if;
  if v_len = 2 and p_ids[1] = p_ids[2] then
    raise exception 'set_axes: the two axis signals must be different';
  end if;

  select count(*) into v_scenario_count from public.scenarios where project_id = p_project;
  if v_scenario_count > 0 then
    raise exception 'axes_locked';
  end if;

  -- Every id must be a force (signal) already placed in the Critical Uncertainty quadrant for
  -- THIS project — reusing matrix_placements_v's derived quadrant rejects an event id, a
  -- wildcard's signal, an unplaced signal, or a signal from another project in one check.
  select array_agg(id) into v_invalid_ids
  from unnest(p_ids) as id
  where id not in (
    select signal_id from public.matrix_placements_v
    where project_id = p_project and quadrant = 'critical'
  );
  if v_invalid_ids is not null then
    raise exception 'set_axes: signal(s) % are not in the Critical Uncertainty quadrant for this project', v_invalid_ids;
  end if;

  update public.axes set is_active = false
  where project_id = p_project and is_active = true;

  insert into public.axes (project_id, x_signal_id, y_signal_id, x_label, y_label, is_active)
  values (
    p_project,
    p_ids[1],
    p_ids[2],
    (select title from public.signals where id = p_ids[1]),
    case when v_len = 2 then (select title from public.signals where id = p_ids[2]) else null end,
    true
  )
  returning * into v_result;

  return v_result;
end;
$$;
