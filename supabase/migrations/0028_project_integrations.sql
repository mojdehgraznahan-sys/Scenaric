-- Settings page's "Integrations" tab — previously a static 4-item mock with no backend at
-- all. Only Slack and RSS Feeds get real storage here (the two the request named); Notion/
-- Bloomberg stay UI-only mock cards with "Connect" disabled, more honest than a button that
-- silently does nothing.
--
-- "Connected" is derived (column is non-null), not a separate boolean — avoids a value/flag
-- sync bug. A Slack Incoming Webhook URL is itself a bearer-token-like secret; this table
-- relies on RLS as its protection boundary, the same boundary every other row in this schema
-- already relies on — no new encryption layer, a deliberate, stated scope decision.
create table public.project_integrations (
  project_id uuid primary key references public.projects(id) on delete cascade,
  slack_webhook_url text,
  slack_connected_at timestamptz,
  rss_feed_url text,
  rss_connected_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.project_integrations enable row level security;
create policy "manage rows in own org's projects" on public.project_integrations
  for all
  using (project_id in (select id from public.projects where org_id = public.current_org_id()))
  with check (project_id in (select id from public.projects where org_id = public.current_org_id()));
