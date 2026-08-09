-- Indicator monitoring — Step 8 (Indicators) follow-on (Build Plan §11;
-- SCHWARTZ_METHODOLOGY_SKILL.md's Step 8 row). Extends the static, build-order `indicators`
-- table (created once per scenario by ai-indicators.ts) with what a recurring daily monitoring
-- job needs, adds indicator_readings for the 7-day sparkline history, and tags ai_runs with a
-- batch_id so one cron invocation's calls are queryable as a unit. Distinct from
-- signposts/plausibility_checks (SCHWARTZ_METHODOLOGY_SKILL.md's "Signpost" section, a
-- separate, already-shipped, live-web-search product extension) — this migration never touches
-- those.

-- ---------------------------------------------------------------- indicators
-- grounded_in must now be able to reference EITHER a storyline_nodes.id (Step 8's own AI
-- generation, unchanged) OR a sources.id (a future news-triggered-creation path) — a mixed
-- reference space, so the single-target FK is dropped in favor of a plain nullable uuid
-- validated in the action layer, same call already made for strategy_scenario_scores.grounded_in
-- (that one's a text[] because it's multi-valued; this one stays a singular uuid).
alter table public.indicators drop constraint if exists indicators_grounded_in_fkey;

alter table public.indicators add column trigger_condition text;
alter table public.indicators add column source_type text not null default 'project' check (source_type in ('project', 'news_feed'));
alter table public.indicators add column created_via text not null default 'ai' check (created_via in ('ai', 'manual'));
-- trend stays nullable — a freshly generated indicator has no history yet to compute one from;
-- the check constraint only constrains the non-null case (same convention as
-- implications.category).
alter table public.indicators add constraint indicators_trend_check check (trend in ('up', 'flat', 'down'));

-- ---------------------------------------------------------------- indicator_readings
-- One row per (indicator, calendar day) — the 7-day sparkline history. A cache-with-history
-- table, not append-only-forever-growing without bound: unique(indicator_id, date) means a
-- same-day re-run upserts rather than duplicating.
create table public.indicator_readings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  indicator_id uuid not null references public.indicators(id) on delete cascade,
  date date not null,
  value numeric not null,
  status_at_time text not null check (status_at_time in ('On track', 'Watch', 'Alert')),
  -- The specific sources.id (a news item) that justified this reading; null means "no new
  -- grounded evidence today, status carried forward unchanged" — a normal, expected daily
  -- outcome, not a failure. A real FK (unlike indicators.grounded_in above) since this column
  -- is single-typed — it only ever points at sources, never a mixed space.
  grounded_in uuid references public.sources(id) on delete set null,
  rationale text,
  created_at timestamptz not null default now(),
  -- Cheap DB-level enforcement that a rationale never exists without its citation — same
  -- "guard the invariant at the column level, don't just trust the caller" spirit as
  -- strategic_options' one-primary-per-project partial unique index.
  constraint indicator_readings_rationale_requires_citation check (rationale is null or grounded_in is not null),
  unique (indicator_id, date)
);
create index indicator_readings_project_id_idx on public.indicator_readings(project_id);
create index indicator_readings_indicator_id_date_idx on public.indicator_readings(indicator_id, date desc);

alter table public.indicator_readings enable row level security;
create policy "manage rows in own org's projects" on public.indicator_readings
  for all
  using (project_id in (select id from public.projects where org_id = public.current_org_id()))
  with check (project_id in (select id from public.projects where org_id = public.current_org_id()));

-- ---------------------------------------------------------------- ai_runs
-- Nullable, unused by every existing caller — lets one cron invocation's calls (the day's news
-- pull + evaluation call, across every project it touched) be queried as a single unit.
alter table public.ai_runs add column batch_id uuid;
create index ai_runs_batch_id_idx on public.ai_runs(batch_id);
