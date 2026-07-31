-- Matrix backend — Step 4 gate correction (§13, per design/handoff/2026-07-30/scenaric.pdf):
-- "4 (Rank forces) -> all signals have bucket assigned AND axes row exists with
-- independence_state != 'uncertain'". The previous version (0005) only checked the axes
-- condition; it never required every signal to actually be classified. No extra
-- empty-project guard needed — the axes-existence clause already can't pass without real
-- signals/axes in practice, same as gates 5/6's unguarded count(...) = 4 checks.
create or replace function public.compute_steps_complete(p_project_id uuid)
returns int
language sql
stable
as $$
  select
    (case when (select refined_focal_question from public.projects where id = p_project_id) is not null then 1 else 0 end) +
    (case when (select count(*) from public.insights where project_id = p_project_id) >= 1 then 1 else 0 end) +
    (case when (select count(*) from public.signals where project_id = p_project_id) >= 4 then 1 else 0 end) +
    (case when
      not exists (
        select 1 from public.signals s
        where s.project_id = p_project_id
          and not exists (
            select 1 from public.matrix_dots md
            where md.signal_id = s.id and md.bucket is not null
          )
      )
      and exists (
        select 1 from public.axes
        where project_id = p_project_id and independence_state is not null and independence_state != 'uncertain'
      )
    then 1 else 0 end) +
    (case when (select count(*) from public.scenarios where project_id = p_project_id and plausible) = 4 then 1 else 0 end) +
    (case when (select count(*) from public.scenarios where project_id = p_project_id and narrative is not null) = 4 then 1 else 0 end) +
    (case when (select count(*) from public.implications where project_id = p_project_id) >= 12 then 1 else 0 end) +
    (case when (select count(*) from public.indicators where project_id = p_project_id) >= 12 then 1 else 0 end) +
    (case when (select count(*) from public.strategies where project_id = p_project_id) >= 3 then 1 else 0 end);
$$;
