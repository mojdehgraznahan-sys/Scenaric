-- Strategic Options recommendation cache — GET /projects/:id/strategy/recommendation, a
-- follow-on to 0022_strategic_options.sql (Build Plan §12; SCHWARTZ_METHODOLOGY_SKILL.md's "+"
-- row, tile 9/9 — the product's own extension). One row per project: the current recommendation
-- over whatever strategic_options/strategy_scenario_scores currently exist. A cache-with-
-- invalidation table, not an append-only history like plausibility_checks (Signpost/
-- Plausibility) — ai-strategy.ts's generateStrategicOptions deletes this project's row
-- whenever it replaces strategy_scenario_scores (see that file's comment), so the next GET
-- recomputes fresh; a cache hit (row still present) is served with no AI call at all.

create table public.strategy_recommendations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  primary_option_id uuid not null references public.strategic_options(id) on delete cascade,
  pairing_option_id uuid references public.strategic_options(id) on delete cascade,
  rationale text not null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.strategy_recommendations enable row level security;
create policy "manage rows in own org's projects" on public.strategy_recommendations
  for all
  using (project_id in (select id from public.projects where org_id = public.current_org_id()))
  with check (project_id in (select id from public.projects where org_id = public.current_org_id()));
