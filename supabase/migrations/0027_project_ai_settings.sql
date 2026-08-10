-- AI Analyst tab (page-settings.tsx) — the 4 toggles were previously pure local UI state,
-- never persisted and never read by anything. This table is the first place any project-level
-- (non-methodology) setting is stored — no such column/table existed anywhere before this.
-- Defaults match the toggles' prior hardcoded mock values exactly, so a project's first read
-- (before any row exists — see project-ai-settings.ts's lazy-upsert-on-first-PATCH) behaves
-- identically to what the UI already showed.
create table public.project_ai_settings (
  project_id uuid primary key references public.projects(id) on delete cascade,
  -- Gates whether a newly uploaded source auto-runs insight extraction (ai-insights.ts) vs.
  -- staying queued for the Knowledge Base's manual "Extract insights" button — see
  -- sources.ts's updateSourceStatus.
  auto_extract_insights boolean not null default true,
  -- Gates the dashboard News Feed's daily ingestion (ai-news-items.ts's
  -- runNewsFeedForAllProjects) per project — NOT the separate Knowledge Base news connector
  -- (ai-news-feed.ts's pullNewsFeed), which is a different feature.
  suggest_from_news_feeds boolean not null default true,
  -- Gates the weekly digest cron (weekly-digest.ts) — off by default, same as the prior mock.
  weekly_digest boolean not null default false,
  -- When true (default), adds readiness checks to Storyline auto-suggest and Strategic
  -- Options generation requiring their real prerequisite step data to already exist —
  -- see ai-storyline.ts's autoSuggestStoryline and ai-strategy.ts's generateStrategicOptions.
  -- Never affects compute_steps_complete() or any other core-step data integrity rule, only
  -- these two product extensions' own generation entry points.
  strict_schwartz_mode boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.project_ai_settings enable row level security;
create policy "manage rows in own org's projects" on public.project_ai_settings
  for all
  using (project_id in (select id from public.projects where org_id = public.current_org_id()))
  with check (project_id in (select id from public.projects where org_id = public.current_org_id()));
