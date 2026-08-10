-- Dashboard News Feed — product extension (SCHWARTZ_METHODOLOGY_SKILL.md's Signpost
-- section is the closest precedent: real-time web-search grounding, product-level, not one
-- of Schwartz's 8 named steps). Distinct from the existing web_feed connector
-- (ai-news-feed.ts's pullNewsFeed, which writes directly into sources/insights for the
-- Knowledge Base + indicator-monitoring cron): news_items is a lighter staging table for the
-- dashboard's News Feed card. Insights/signals are only created on demand, when a specific
-- item is promoted via "+ Add to Signals" (ai-news-items.ts) — never automatically for every
-- item a daily pull finds, so the Knowledge Base isn't silently flooded with insights nobody
-- asked for.

create table public.news_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  source text not null,
  url text not null,
  published_at timestamptz,
  impact text check (impact in ('HIGH', 'MED', 'LOW')),
  -- Verbatim phrase (from the item's own title/summary) that drove the impact score — the
  -- rubric call must cite it, never invent one. Nullable: a pre-scoring row should never
  -- exist, but this stays optional at the column level the same way other AI-attribution
  -- columns elsewhere (e.g. indicator_readings.rationale) do.
  impact_cited_phrase text,
  steep_category text not null check (steep_category in ('Social', 'Technology', 'Economic', 'Ecological', 'Political')),
  summary text not null,
  added_to_signals boolean not null default false,
  -- Set only once "+ Add to Signals" runs (ai-news-items.ts's addNewsItemToSignals) — the
  -- sources row it creates at that time, so a second click / page reload finds the same
  -- backing insight instead of re-extracting. Null until then.
  source_id uuid references public.sources(id) on delete set null,
  signal_id uuid references public.signals(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Hard, DB-level dedupe by URL — the daily pull's own application-level filter is a second
  -- guard, not the only one.
  unique (project_id, url)
);
create index news_items_project_id_idx on public.news_items(project_id, published_at desc);

alter table public.news_items enable row level security;
create policy "manage rows in own org's projects" on public.news_items
  for all
  using (project_id in (select id from public.projects where org_id = public.current_org_id()))
  with check (project_id in (select id from public.projects where org_id = public.current_org_id()));

-- "Unread" news (Task 3) = published after this timestamp. Per-project, not per-user — this
-- app has no per-user project-membership table; every other "last activity" signal on the
-- dashboard (e.g. the "Last updated Xh ago" label) is already project-scoped, not user-scoped,
-- via projects.updated_at, so this follows the same precedent.
alter table public.projects add column dashboard_last_viewed_at timestamptz;
