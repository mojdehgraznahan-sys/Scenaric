-- Scenaric backend build plan, §2 — full multi-project schema.
-- Every content table is scoped by project_id (directly or via scenario_id/axes_id
-- chains that ultimately resolve to one project_id); projects are scoped by org_id.
-- `auth.users` (Supabase-managed) plays the doc's `users` table; `profiles` extends it.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- orgs / profiles
create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'trial',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text,
  email text not null,
  role text not null default 'owner',
  created_at timestamptz not null default now()
);
create index profiles_org_id_idx on public.profiles(org_id);

-- ---------------------------------------------------------------- projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  focal_question text not null default '',
  refined_focal_question text,
  horizon text not null default '',
  industry text not null default '',
  summary text not null default '',
  steps_complete int not null default 0,
  archived boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_org_id_idx on public.projects(org_id);

-- ---------------------------------------------------------------- sources / interviews / insights
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  type text not null check (type in ('doc', 'audio', 'survey', 'web')),
  status text not null default 'processing' check (status in ('processing', 'complete', 'failed')),
  storage_url text,
  extracted_text text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index sources_project_id_idx on public.sources(project_id);

create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_id uuid references public.sources(id) on delete set null,
  participant_name text not null,
  role text,
  transcript text,
  tag text check (tag in ('Social', 'Technology', 'Economic', 'Ecological', 'Political')),
  key_quote text,
  created_at timestamptz not null default now()
);
create index interviews_project_id_idx on public.interviews(project_id);

create table public.insights (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_id uuid references public.sources(id) on delete set null,
  text text not null,
  category text check (category in ('Social', 'Technology', 'Economic', 'Ecological', 'Political', 'local_actor')),
  confidence text check (confidence in ('high', 'medium', 'low')),
  created_at timestamptz not null default now()
);
create index insights_project_id_idx on public.insights(project_id);

-- ---------------------------------------------------------------- signals / matrix / axes
create table public.signals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  category text not null check (category in ('Social', 'Technology', 'Economic', 'Ecological', 'Political')),
  source text not null,
  title text not null,
  body text not null default '',
  impact int check (impact between 1 and 5),
  uncertainty text check (uncertainty in ('Low', 'Medium', 'High')),
  origin text not null default 'user' check (origin in ('ai', 'user', 'insight', 'external_pattern')),
  status text not null default 'active',
  created_at timestamptz not null default now()
);
create index signals_project_id_idx on public.signals(project_id);

create table public.matrix_dots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  signal_id uuid not null references public.signals(id) on delete cascade,
  x numeric not null check (x between 0 and 100),
  y numeric not null check (y between 0 and 100),
  is_critical_axis boolean not null default false,
  created_at timestamptz not null default now(),
  unique (project_id, signal_id)
);
create index matrix_dots_project_id_idx on public.matrix_dots(project_id);

create table public.axes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  x_signal_id uuid references public.signals(id) on delete set null,
  y_signal_id uuid references public.signals(id) on delete set null,
  x_label text,
  y_label text,
  independence_state text check (independence_state in ('independent', 'correlated', 'uncertain')),
  independence_rationale text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index axes_project_id_idx on public.axes(project_id);

-- ---------------------------------------------------------------- scenarios / storyline / implications
create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  axes_id uuid references public.axes(id) on delete set null,
  quadrant text not null check (quadrant in ('TL', 'TR', 'BL', 'BR')),
  name text not null,
  tagline text,
  summary text,
  narrative text,
  color text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index scenarios_project_id_idx on public.scenarios(project_id);

create table public.storyline_nodes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  phase text not null check (phase in ('precursors', 'catalysts', 'first_order', 'second_order', 'realized')),
  category text check (category in ('Social', 'Technology', 'Economic', 'Ecological', 'Political')),
  title text not null,
  body text,
  year int,
  strength text,
  signal_id uuid references public.signals(id) on delete set null,
  created_at timestamptz not null default now()
);
create index storyline_nodes_project_id_idx on public.storyline_nodes(project_id);
create index storyline_nodes_scenario_id_idx on public.storyline_nodes(scenario_id);

create table public.storyline_edges (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  from_node_id uuid not null references public.storyline_nodes(id) on delete cascade,
  to_node_id uuid not null references public.storyline_nodes(id) on delete cascade,
  relationship text not null check (relationship in ('Leads to', 'Enables', 'Amplifies', 'Blocks')),
  confidence text not null check (confidence in ('Strong', 'Moderate', 'Weak')),
  created_at timestamptz not null default now()
);
create index storyline_edges_project_id_idx on public.storyline_edges(project_id);
create index storyline_edges_scenario_id_idx on public.storyline_edges(scenario_id);

create table public.implications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  text text not null,
  category text check (category in ('capital', 'hiring', 'tech', 'partners', 'other')),
  created_at timestamptz not null default now()
);
create index implications_project_id_idx on public.implications(project_id);

-- ---------------------------------------------------------------- indicators / strategies / ai_runs
create table public.indicators (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scenario_id uuid references public.scenarios(id) on delete cascade,
  name text not null,
  status text not null default 'Watch' check (status in ('On track', 'Watch', 'Alert')),
  trend text,
  note text,
  last_checked timestamptz,
  created_at timestamptz not null default now()
);
create index indicators_project_id_idx on public.indicators(project_id);

create table public.strategies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  notes text,
  risk text check (risk in ('Low', 'Medium', 'High')),
  cost text check (cost in ('Low', 'Medium', 'High')),
  robust_in uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index strategies_project_id_idx on public.strategies(project_id);

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  step text not null,
  prompt_version text not null,
  input_hash text not null,
  output_json jsonb,
  model text,
  confidence text,
  created_at timestamptz not null default now()
);
create index ai_runs_project_id_idx on public.ai_runs(project_id);
