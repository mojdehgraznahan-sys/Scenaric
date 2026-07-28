-- Persists the `grounded_in` insight ids the AI already computes in suggestSignals
-- (src/lib/actions/ai-signals.ts) — requested and validated in its structured output
-- since that function was first built, but never written anywhere until now.
-- project_id is denormalized here (redundant with what's derivable via signal_id) so
-- this table can use the exact same generic RLS policy shape as every other
-- project-scoped table below, instead of a bespoke nested-subquery policy.

create table public.signal_insight_links (
  project_id uuid not null references public.projects(id) on delete cascade,
  signal_id uuid not null references public.signals(id) on delete cascade,
  insight_id uuid not null references public.insights(id) on delete cascade,
  primary key (signal_id, insight_id)
);
create index signal_insight_links_signal_id_idx on public.signal_insight_links(signal_id);
create index signal_insight_links_insight_id_idx on public.signal_insight_links(insight_id);

alter table public.signal_insight_links enable row level security;
create policy "manage rows in own org's projects" on public.signal_insight_links
  for all
  using (project_id in (select id from public.projects where org_id = public.current_org_id()))
  with check (project_id in (select id from public.projects where org_id = public.current_org_id()));
