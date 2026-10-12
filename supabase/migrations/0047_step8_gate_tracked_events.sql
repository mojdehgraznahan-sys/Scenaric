-- Step 8's gate counted `indicators` rows, created only via Narrative's "Track indicators"
-- button. That button is being replaced by a flow that marks existing project events as
-- monitored (event_scenario_links) instead of generating indicator rows — so without this
-- change, Step 8 would become permanently uncompletable for any project created after this
-- ships. Tracked events are the new Step 8 evidence: count distinct events with at least one
-- event_scenario_links row for the project, same >= 12 threshold as before.
--
-- Every other condition is copied verbatim from 0032_step1_gate_effective_focal_question.sql —
-- no other gate changes.

create or replace function public.compute_steps_complete(p_project_id uuid)
returns int
language sql
stable
as $$
  select
    (case when (select coalesce(nullif(refined_focal_question, ''), focal_question) from public.projects where id = p_project_id) <> '' then 1 else 0 end) +
    (case when (select count(*) from public.insights where project_id = p_project_id) >= 1 then 1 else 0 end) +
    (case when (select count(*) from public.signals where project_id = p_project_id) >= 4 then 1 else 0 end) +
    (case when exists (
      select 1 from public.axes
      where project_id = p_project_id and independence_state in ('independent', 'correlated')
    ) then 1 else 0 end) +
    (case when (select count(*) from public.scenarios where project_id = p_project_id and plausible) = 4 then 1 else 0 end) +
    (case when (select count(*) from public.scenarios where project_id = p_project_id and narrative is not null) = 4 then 1 else 0 end) +
    (case when (select count(*) from public.implications where project_id = p_project_id) >= 12 then 1 else 0 end) +
    (case when (select count(distinct event_id) from public.event_scenario_links where project_id = p_project_id) >= 12 then 1 else 0 end) +
    (case when (select count(*) from public.strategic_options where project_id = p_project_id) >= 3 then 1 else 0 end);
$$;
