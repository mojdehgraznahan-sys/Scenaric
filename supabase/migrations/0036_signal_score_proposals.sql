-- Signals "Ask AI" Group 3 "Rank" prompts (SIGNALS_ASK_AI_PROMPTS.md) score every signal's
-- impact/uncertainty but must never write signals.impact/uncertainty directly — "Scores are
-- proposals... The user confirms before the Matrix reads them." scoreSignalRow (ai-signals.ts)
-- always writes directly; that path is for the pre-existing single-signal/batch-unscored
-- scoring flow and is untouched. This table is the new staging area Group 3's scoring prompts
-- (3.1 Score impact, 3.2 Score uncertainty) write to instead.
create table public.signal_score_proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  signal_id uuid not null references public.signals(id) on delete cascade,
  dimension text not null check (dimension in ('impact', 'uncertainty')),
  proposed_impact int check (proposed_impact between 1 and 5),
  proposed_uncertainty text check (proposed_uncertainty in ('Low', 'Medium', 'High')),
  rationale text not null,
  -- 3.1's "least confident" flag / 3.2's "disagrees with the user's given/open classification"
  -- flag — both render as a highlighted row on the Scores review tab.
  low_confidence boolean not null default false,
  disagrees_with_user_classification text,
  status text not null default 'proposed' check (status in ('proposed', 'confirmed', 'dismissed')),
  -- One run (which may be split into several chunked runStructured calls for large signal
  -- sets) shares one batch_id, so the review UI's bulk confirm/dismiss-all acts on one
  -- coherent unit rather than requiring N individual clicks.
  batch_id uuid not null,
  created_at timestamptz not null default now(),
  unique (signal_id, dimension, batch_id)
);

create index signal_score_proposals_project_id_idx on public.signal_score_proposals(project_id, status);

alter table public.signal_score_proposals enable row level security;

create policy "manage rows in own org's projects" on public.signal_score_proposals
  for all
  using (project_id in (select id from public.projects where org_id = public.current_org_id()))
  with check (project_id in (select id from public.projects where org_id = public.current_org_id()));
