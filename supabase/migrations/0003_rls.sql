-- RLS — no query may ever mix data across orgs/projects (build plan §2 callout).
-- current_org_id() is security definer so it can read profiles without recursing
-- through profiles' own RLS policy.
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select org_id from public.profiles where id = auth.uid()
$$;

-- ---------------------------------------------------------------- orgs / profiles
alter table public.orgs enable row level security;
create policy "select own org" on public.orgs
  for select using (id = public.current_org_id());
create policy "update own org" on public.orgs
  for update using (id = public.current_org_id());

alter table public.profiles enable row level security;
create policy "select profiles in own org" on public.profiles
  for select using (org_id = public.current_org_id());
create policy "update own profile" on public.profiles
  for update using (id = auth.uid());

-- ---------------------------------------------------------------- projects
alter table public.projects enable row level security;
create policy "manage own org's projects" on public.projects
  for all
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- ---------------------------------------------------------------- every project-scoped table
-- Same shape for each: project_id must resolve to a project owned by the caller's org.
do $$
declare
  t text;
begin
  foreach t in array array[
    'sources', 'interviews', 'insights', 'signals', 'matrix_dots', 'axes',
    'scenarios', 'storyline_nodes', 'storyline_edges', 'implications',
    'indicators', 'strategies', 'ai_runs'
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
