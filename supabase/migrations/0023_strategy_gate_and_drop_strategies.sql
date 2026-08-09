-- Follow-up to 0022_strategic_options.sql: compute_steps_complete()'s step-9 check (0005) was
-- written against the old `strategies` table; left alone, step 9 would never complete under
-- the new strategic_options/strategy_scenario_scores model. Repoint it, then drop the old table
-- — it held no data (no server code ever wrote to it) and nothing else references it, so
-- leaving both `strategies` and `strategic_options` in the schema side by side would just be a
-- confusing dead duplicate of the same concept.

create or replace function public.compute_steps_complete(p_project_id uuid)
returns int
language sql
stable
as $$
  select
    (case when (select refined_focal_question from public.projects where id = p_project_id) is not null then 1 else 0 end) +
    (case when (select count(*) from public.insights where project_id = p_project_id) >= 1 then 1 else 0 end) +
    (case when (select count(*) from public.signals where project_id = p_project_id) >= 4 then 1 else 0 end) +
    (case when exists (
      select 1 from public.axes
      where project_id = p_project_id and independence_state in ('independent', 'correlated')
    ) then 1 else 0 end) +
    (case when (select count(*) from public.scenarios where project_id = p_project_id and plausible) = 4 then 1 else 0 end) +
    (case when (select count(*) from public.scenarios where project_id = p_project_id and narrative is not null) = 4 then 1 else 0 end) +
    (case when (select count(*) from public.implications where project_id = p_project_id) >= 12 then 1 else 0 end) +
    (case when (select count(*) from public.indicators where project_id = p_project_id) >= 12 then 1 else 0 end) +
    (case when (select count(*) from public.strategic_options where project_id = p_project_id) >= 3 then 1 else 0 end);
$$;

drop table public.strategies;
