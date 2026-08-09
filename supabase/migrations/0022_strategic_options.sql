-- Strategic Options — product extension, not a Schwartz-named step (Build Plan §12;
-- SCHWARTZ_METHODOLOGY_SKILL.md's "+" row / "wind-tunnelling"). Tile 9 of 9. Supersedes the
-- unused `strategies` table from 0001_schema.sql (no server code ever queried it, and its bare
-- `robust_in uuid[]` had no room for a per-scenario grounded rationale) with a normalized
-- option/score split: one strategic_options row per candidate action, one
-- strategy_scenario_scores row per (option, scenario) wind-tunnel judgment, each carrying its
-- own citation. See 0023_strategy_gate_and_drop_strategies.sql for the follow-up that repoints
-- the steps_complete gate and removes the old table.

create table public.strategic_options (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  notes text,
  risk text check (risk in ('Low', 'Medium', 'High')),
  cost text check (cost in ('Low', 'Medium', 'High')),
  created_via text not null default 'manual' check (created_via in ('ai', 'manual')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index strategic_options_project_id_idx on public.strategic_options(project_id);

-- At most one primary option per project, enforced at the DB layer (not just the PATCH
-- endpoint's own transaction) so a race between two "Mark as primary" calls can never leave two
-- rows true — same "cheap guard against a retry" spirit as axes' "max 2 active rows" invariant
-- (ai-scenarios.ts).
create unique index strategic_options_one_primary_per_project
  on public.strategic_options(project_id)
  where is_primary;

create table public.strategy_scenario_scores (
  id uuid primary key default gen_random_uuid(),
  -- Denormalized alongside strategy_id/scenario_id, same convention as every other
  -- content table in 0001_schema.sql (storyline_edges, implications, indicators, ...) —
  -- keeps RLS and project-scoped queries uniform and is the documented guard against a
  -- shared context ever leaking across projects (Build Plan §2).
  project_id uuid not null references public.projects(id) on delete cascade,
  strategy_id uuid not null references public.strategic_options(id) on delete cascade,
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  robust boolean not null,
  rationale text not null,
  -- Implication ids or storyline_node ids this judgment cites — never persisted empty;
  -- ai-strategy.ts filters out any candidate score with no real grounding before insert, same
  -- defense-in-depth pattern as implications.grounded_in_text / indicators.grounded_in.
  grounded_in text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (strategy_id, scenario_id)
);
create index strategy_scenario_scores_project_id_idx on public.strategy_scenario_scores(project_id);
create index strategy_scenario_scores_strategy_id_idx on public.strategy_scenario_scores(strategy_id);

alter table public.strategic_options enable row level security;
create policy "manage rows in own org's projects" on public.strategic_options
  for all
  using (project_id in (select id from public.projects where org_id = public.current_org_id()))
  with check (project_id in (select id from public.projects where org_id = public.current_org_id()));

alter table public.strategy_scenario_scores enable row level security;
create policy "manage rows in own org's projects" on public.strategy_scenario_scores
  for all
  using (project_id in (select id from public.projects where org_id = public.current_org_id()))
  with check (project_id in (select id from public.projects where org_id = public.current_org_id()));

-- PATCH .../strategy/:optionId { is_primary } — "only one option may be primary at a time,
-- unset any prior primary in the same transaction." supabase-js has no multi-statement
-- transaction API, so the unset-then-set pair is done here as a single PL/pgSQL function
-- instead: one RPC call is one implicit transaction, which two sequential UPDATE calls from the
-- action layer would not be. SECURITY INVOKER (the default, matching 0005's
-- compute_steps_complete/list_projects_with_progress) so RLS still applies to both UPDATEs
-- using the calling user's own request-scoped session — this function grants no privilege the
-- caller didn't already have via the policies above.
create or replace function public.set_primary_strategic_option(
  p_project_id uuid,
  p_option_id uuid,
  p_is_primary boolean
)
returns public.strategic_options
language plpgsql
as $$
declare
  result public.strategic_options;
begin
  if p_is_primary then
    update public.strategic_options
      set is_primary = false, updated_at = now()
      where project_id = p_project_id and is_primary and id <> p_option_id;
  end if;

  update public.strategic_options
    set is_primary = p_is_primary, updated_at = now()
    where id = p_option_id and project_id = p_project_id
    returning * into result;

  if result.id is null then
    raise exception 'Strategic option % not found in project %', p_option_id, p_project_id;
  end if;

  return result;
end;
$$;
