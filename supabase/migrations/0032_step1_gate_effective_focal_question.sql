-- Fix: compute_steps_complete()'s Step 1 ("Focal question") condition gated on
-- refined_focal_question is not null — but a normal Settings "Save changes" (page-settings.tsx)
-- only ever writes the plain focal_question column; refined_focal_question is set only via the
-- Ask AI Sharpen/Draft accept flow. So a user who types a focal question and saves it the
-- obvious way never saw Step 1 complete. Every other AI prompt in the app already treats "the
-- current focal question" as refined_focal_question ?? focal_question (the effective value) —
-- this makes the Step 1 gate use that same convention instead of being the one outlier.
--
-- nullif(refined_focal_question, '') falls through to focal_question when refined is unset;
-- checking <> '' (not "is not null") is what keeps a brand-new, untouched project correctly
-- showing Step 1 as NOT done — focal_question defaults to '' (not null) at project creation
-- (0001_schema.sql), so a null check alone would count every project as done from creation.
--
-- Every other condition is copied verbatim from 0023_strategy_gate_and_drop_strategies.sql —
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
    (case when (select count(*) from public.indicators where project_id = p_project_id) >= 12 then 1 else 0 end) +
    (case when (select count(*) from public.strategic_options where project_id = p_project_id) >= 3 then 1 else 0 end);
$$;
