-- Research-mode enforcement (SCHWARTZ_METHODOLOGY_SKILL.md's "Where research mode (live
-- web/news) is allowed vs. forbidden" section) — steps 2 (Key forces) and 3 (Driving forces)
-- may run exploratory live-web research, but results must land as unconfirmed suggestions,
-- never auto-inserted as signals/insights. news_items (0026_news_items.sql) is the closest
-- existing precedent (a lighter staging table so AI-found items don't flood real project data
-- until confirmed) but it's news-item-shaped and Dashboard-specific; this is a new, dedicated
-- table covering both step 2's local-actor candidates and step 3's STEEP-trend candidates,
-- kept separate so the two features don't get coupled.

create table public.research_suggestions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  -- Which of step 2 (local actors) / step 3 (STEEP trends) this came from — governs whether
  -- category or actor_type below is the relevant one.
  step text not null check (step in ('key_forces', 'driving_forces')),
  status text not null default 'suggested' check (status in ('suggested', 'confirmed', 'dismissed')),
  -- Always 'external_research' today (the only producer is the live-web scan actions below) —
  -- kept as a column rather than assumed, matching signals.origin/sources.type's own
  -- provenance-as-data convention, and leaving room for a future non-web suggestion source
  -- without a schema change.
  source text not null default 'external_research',
  title text not null,
  body text not null default '',
  -- driving_forces only.
  category text check (category in ('Social', 'Technology', 'Economic', 'Ecological', 'Political')),
  -- key_forces only.
  actor_type text check (actor_type in ('competitor', 'regulator', 'customer', 'supplier', 'partner', 'internal_capability')),
  citation_title text,
  citation_url text,
  -- Set only once confirmed — the real signal/insight row this suggestion became, so a second
  -- confirm click / page reload finds the same row instead of creating a duplicate. Exactly one
  -- of these two is ever set, matching which `step` produced the suggestion.
  confirmed_signal_id uuid references public.signals(id) on delete set null,
  confirmed_insight_id uuid references public.insights(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Soft de-dupe by title within a project+step, same spirit as news_items' unique(project_id, url).
  unique (project_id, step, title)
);
create index research_suggestions_project_id_idx on public.research_suggestions(project_id, status);

alter table public.research_suggestions enable row level security;
create policy "manage rows in own org's projects" on public.research_suggestions
  for all
  using (project_id in (select id from public.projects where org_id = public.current_org_id()))
  with check (project_id in (select id from public.projects where org_id = public.current_org_id()));

-- 'external_research' (a live web-search result, confirmed via the flow above) is intentionally
-- distinct from the existing 'external_pattern' value — that one already means something else
-- (an *ungrounded closed-book* inference from the model's general training knowledge; see
-- ai-signals.ts, ai-monitoring-chat.ts, ai-strategy-chat.ts, and ask-ai.tsx's "external pattern —
-- not grounded in this project's own data" copy). Conflating the two would blur a distinction
-- the app already relies on elsewhere.
alter table public.signals
  drop constraint signals_origin_check,
  add constraint signals_origin_check check (origin in ('ai', 'user', 'insight', 'external_pattern', 'external_research'));

-- Mirrors 'web_feed' getting its own sources.type value (0019_sources_web_feed_type.sql) for
-- the same reason: so the Knowledge Base can tell "the news connector found this" apart from
-- "a step 2 local-force scan found this," rather than reusing 'web_feed' for a different
-- producer.
alter table public.sources
  drop constraint sources_type_check,
  add constraint sources_type_check check (type in ('doc', 'audio', 'survey', 'web', 'web_feed', 'external_research'));

-- Audit trail for the research-mode guard (src/lib/ai/client.ts's runStructured/logRun) — ai_runs
-- already logs `step` for every call but not whether it actually used web_search, so a policy
-- audit today can't distinguish a closed-book run from a research-mode one without re-deriving
-- it from the step name. Safe additive column: not null with a default, no backfill needed since
-- every existing row is genuinely `false` (webSearch didn't exist as an option before this).
alter table public.ai_runs add column used_web_search boolean not null default false;
