-- Signals page "Events" view (scenaric.pdf build plan) — specific past ("observed") or future
-- ("possible", optionally "wildcard") events linked to existing signals ("forces"), each
-- showing which pole it pushes that force toward. This app had zero persisted "event" concept
-- before this migration — the only precedent was a purely advisory AI classification prompt
-- (runSharpenForceOrEvent, ai-signals-sharpen.ts) that never wrote anything to the DB.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,                          -- maps to `body` client-side
  category text check (category in ('Social','Technology','Economic','Ecological','Political')),
  -- nullable: client falls back to the first linked signal's category (eventCategory()) when null
  status text not null check (status in ('observed','possible')),
  is_wildcard boolean not null default false, -- orthogonal to status — a wildcard is virtually
  -- always status='possible', but the Events view's 3rd group is is_wildcard=true regardless
  occurred_on date,                           -- set when observed
  window_label text,                          -- free text for a possible event with no exact
  -- date yet (e.g. "Q3 2027") — client date = occurred_on formatted 'Mon YYYY', else window_label
  impact int check (impact between 1 and 5),
  likelihood text check (likelihood in ('Low','Medium','High')), -- meaningful only when possible
  precursor text,                             -- "early sign" text (wildcards mainly, but any event)
  source text,                                -- citation, shown on observed events' IMPACT row
  created_via text not null default 'manual' check (created_via in ('manual','news_match','ai')),
  created_at timestamptz not null default now()
);
create index events_project_id_idx on public.events(project_id);

create table public.event_signal_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  signal_id uuid not null references public.signals(id) on delete cascade,
  toward text not null,                       -- the pole/direction, e.g. "Openness"
  created_at timestamptz not null default now(),
  unique (event_id, signal_id)
);
create index event_signal_links_event_id_idx on public.event_signal_links(event_id);
create index event_signal_links_signal_id_idx on public.event_signal_links(signal_id);

alter table public.events enable row level security;
alter table public.event_signal_links enable row level security;

create policy "manage rows in own org's projects" on public.events
  for all
  using (project_id in (select id from public.projects where org_id = public.current_org_id()))
  with check (project_id in (select id from public.projects where org_id = public.current_org_id()));

create policy "manage rows in own org's projects" on public.event_signal_links
  for all
  using (project_id in (select id from public.projects where org_id = public.current_org_id()))
  with check (project_id in (select id from public.projects where org_id = public.current_org_id()));

-- "indicators.event_id reverse lookup" — indicators has no signal/event link at all today.
alter table public.indicators add column event_id uuid references public.events(id) on delete set null;

-- News-match traceability, mirroring the existing news_items.signal_id column exactly. A news
-- item now resolves to EITHER a new signal (signal_id) OR a promoted event (event_id), never both.
alter table public.news_items add column event_id uuid references public.events(id) on delete set null;
