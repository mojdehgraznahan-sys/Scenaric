-- Signpost and Plausibility score — new, non-canonical, product-level concepts (see
-- SCHWARTZ_METHODOLOGY_SKILL.md's "Signpost" and "Plausibility / confidence score"
-- sections). Both are AI + live-web-search-grounded, generated on demand from the
-- Storyline page — distinct from the static, build-order Step 8 `indicators` table and
-- from `scenarios.plausible`/`implausibility_note` (Step 5's one-time, static axis-logic
-- coherence judgment). Never conflate either with its canonical cousin.

create table public.signposts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  name text not null,
  rationale text,
  -- Reuses the indicators table's status vocabulary for UI/mental-model consistency —
  -- deliberately still a separate table, so Signpost stays clearly labeled as the
  -- non-canonical variant rather than silently merging into Step 8's own gate.
  status text not null default 'Watch' check (status in ('On track', 'Watch', 'Alert')),
  -- [{url, title}] from the live web search that grounded this signpost at generation time.
  citations jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index signposts_project_id_idx on public.signposts(project_id);
create index signposts_scenario_id_idx on public.signposts(scenario_id);

-- Append-only: each row is one point-in-time check, never overwritten — the current score
-- for a scenario is just its most recent row. This is the whole point of the concept
-- ("should shift as the world changes"), not an oversight.
create table public.plausibility_checks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  score int not null check (score >= 0 and score <= 100),
  rationale text not null,
  citations jsonb not null default '[]'::jsonb,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index plausibility_checks_project_id_idx on public.plausibility_checks(project_id);
create index plausibility_checks_scenario_id_idx on public.plausibility_checks(scenario_id);

-- Same RLS shape as every other project-scoped table (0003_rls.sql) — written fresh here
-- since that migration's table array is already applied and immutable.
do $$
declare
  t text;
begin
  foreach t in array array['signposts', 'plausibility_checks']
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
