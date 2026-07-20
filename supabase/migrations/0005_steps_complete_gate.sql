-- Backend build order §14 item 2 / §13: steps_complete must be server-derived, never
-- client-set, so a project's progress tile can never drift from or be spoofed relative
-- to its real data. Both functions are SECURITY INVOKER (the Postgres default — no
-- `security definer` here, unlike the signup trigger in 0002 which legitimately needed
-- elevated privileges) so RLS applies naturally to every subquery: a caller only ever
-- gets a real count from their own org's rows, safe by construction.

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
    (case when (select count(*) from public.strategies where project_id = p_project_id) >= 3 then 1 else 0 end);
$$;

create or replace function public.list_projects_with_progress()
returns table (
  id uuid,
  org_id uuid,
  name text,
  focal_question text,
  refined_focal_question text,
  horizon text,
  industry text,
  summary text,
  steps_complete int,
  archived boolean,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
as $$
  select
    p.id, p.org_id, p.name, p.focal_question, p.refined_focal_question,
    p.horizon, p.industry, p.summary,
    public.compute_steps_complete(p.id) as steps_complete,
    p.archived, p.created_by, p.created_at, p.updated_at
  from public.projects p
  order by p.updated_at desc;
$$;
