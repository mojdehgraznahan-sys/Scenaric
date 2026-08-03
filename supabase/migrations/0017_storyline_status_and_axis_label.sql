-- Storyline generation-status tracking + axis-label column, requested alongside a proposed
-- scenario_storylines/storyline_events/scenario_signposts schema that substantially
-- overlapped already-built tables (storyline_nodes/storyline_edges with the 5-phase +
-- directional-causality structure from SCHWARTZ_METHODOLOGY_SKILL.md's Storyline section,
-- and the append-only plausibility_checks). Merged rather than forked: scenario_storylines
-- survives as a pure generation-status wrapper (no confidence/plausibility columns — those
-- stay on plausibility_checks, which is deliberately a history log, not a single mutable
-- value); storyline_events and scenario_signposts are dropped in favor of extending the
-- existing storyline_nodes/storyline_edges and signposts tables.

-- matrix_dots.is_critical_axis (0001_schema.sql) already exists for "is this dot one of the
-- project's 2 currently-selected scenario axes" but has never been populated or read by any
-- application code (it's selected in matrix.ts's queries but never mapped into the returned
-- MatrixDotData shape, and never written by any insert/update). Adding axis_label as its
-- companion rather than a redundant second boolean. Both stay unpopulated by this migration —
-- today's storyline axis-exclusion logic (ai-storyline.ts) already correctly derives axis
-- membership by joining through axes.x_signal_id/y_signal_id, so nothing depends on these
-- columns yet; populating them (in ai-scenarios.ts's buildScenarios / the re-axis flow) is
-- separate follow-up application work, not part of this schema change.
alter table public.matrix_dots
  add column axis_label text check (axis_label in ('x', 'y'));

-- One row per scenario, tracking the state of its most recent storyline auto-suggest run.
-- Unique on scenario_id: a regeneration already replaces storyline_nodes/storyline_edges
-- wholesale (autoSuggestStoryline, ai-storyline.ts), so this mirrors that "current state,
-- not a log" shape — unlike plausibility_checks, which is deliberately append-only.
create table public.scenario_storylines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  status text not null default 'not_generated' check (status in ('not_generated', 'generating', 'completed', 'failed')),
  generated_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scenario_id)
);
create index scenario_storylines_project_id_idx on public.scenario_storylines(project_id);

-- Links a signpost/plausibility check back to the storyline run that produced it — nullable,
-- since both concepts are tied to the scenario itself and can exist independent of any
-- particular storyline run (e.g. a plausibility check made before a storyline has ever been
-- generated for that scenario).
alter table public.signposts
  add column storyline_id uuid references public.scenario_storylines(id) on delete set null;
alter table public.plausibility_checks
  add column storyline_id uuid references public.scenario_storylines(id) on delete set null;

-- Same RLS shape as every other project-scoped table (0003_rls.sql) — written fresh here,
-- same as 0016, since 0003's table array is already applied and immutable.
alter table public.scenario_storylines enable row level security;
create policy "manage rows in own org's projects" on public.scenario_storylines
  for all
  using (project_id in (select id from public.projects where org_id = public.current_org_id()))
  with check (project_id in (select id from public.projects where org_id = public.current_org_id()));
