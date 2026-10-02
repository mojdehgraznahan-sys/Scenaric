-- Signals Library v2 (design/handoff/2026-09-28) — every Signal ("force") now has two named
-- poles, and event_signal_links stores which pole side an event pulls toward structurally
-- (side 'a'|'b') so the displayed label always reflects the signal's *current* pole wording,
-- not a frozen snapshot of `toward` text captured at link time. Also adds two AI-proposal
-- staging tables for the new Inbox "Group into forces" and per-pole "Suggest" flows — same
-- staged/confirm-before-merge shape as research_suggestions (0029) and signal_score_proposals
-- (0036), never written directly into signals/events.
alter table public.signals add column pole_a text;
alter table public.signals add column pole_b text;
-- Backfill: an honest, visibly generic default — never a fabricated AI guess at migration
-- time. pole_b keeps the signal's own title (the only existing wording available); pole_a is
-- an explicit placeholder callers/UI can flag for the user to revisit per force.
update public.signals set pole_b = title, pole_a = 'Doesn''t happen' where pole_a is null;

alter table public.event_signal_links add column side text check (side in ('a', 'b'));
-- Backfill: every existing link becomes side='b' — a coarse, honest default (existing
-- `toward` text in practice reads as the "more/higher/harder" pole), not a claim of per-row
-- accuracy. `toward` itself is left in place (still populated by pre-rebuild rows) but new
-- code never writes it — the display label is always derived live from `side` + the
-- signal's current poles instead, so the column can no longer stay `not null`.
update public.event_signal_links set side = 'b' where side is null;
alter table public.event_signal_links alter column toward drop not null;

create table public.force_proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null check (kind in ('new_force', 'attach')),
  title text not null,
  category text check (category in ('Social', 'Technology', 'Economic', 'Ecological', 'Political')),
  pole_a text,                                -- new_force only
  pole_b text,                                -- new_force only
  member_links jsonb not null default '[]'::jsonb, -- new_force only: [{event_id, side}]
  event_id uuid references public.events(id) on delete cascade,           -- attach only
  target_signal_id uuid references public.signals(id) on delete cascade,  -- attach only
  target_side text check (target_side in ('a', 'b')),                     -- attach only
  rationale text not null,
  status text not null default 'proposed' check (status in ('proposed', 'confirmed', 'dismissed')),
  batch_id uuid not null,
  created_signal_id uuid references public.signals(id) on delete set null, -- new_force, once confirmed
  created_at timestamptz not null default now()
);
create index force_proposals_project_id_idx on public.force_proposals(project_id, status);

create table public.event_proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  signal_id uuid not null references public.signals(id) on delete cascade,
  side text not null check (side in ('a', 'b')),
  title text not null,
  body text,
  window_label text,
  likelihood text check (likelihood in ('Low', 'Medium', 'High')),
  impact int check (impact between 1 and 5),
  precursor text,
  citation_title text,
  citation_url text,
  status text not null default 'proposed' check (status in ('proposed', 'added', 'dismissed')),
  created_event_id uuid references public.events(id) on delete set null,
  created_at timestamptz not null default now()
);
create index event_proposals_signal_id_idx on public.event_proposals(signal_id, status);

alter table public.force_proposals enable row level security;
alter table public.event_proposals enable row level security;

create policy "manage rows in own org's projects" on public.force_proposals
  for all
  using (project_id in (select id from public.projects where org_id = public.current_org_id()))
  with check (project_id in (select id from public.projects where org_id = public.current_org_id()));

create policy "manage rows in own org's projects" on public.event_proposals
  for all
  using (project_id in (select id from public.projects where org_id = public.current_org_id()))
  with check (project_id in (select id from public.projects where org_id = public.current_org_id()));
