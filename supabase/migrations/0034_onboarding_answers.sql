-- Persists onboarding's Step 1 four-block interview answers (focal-interview-blocks.ts /
-- OnboardingState's blockA-D in store.tsx), which today live only in browser localStorage
-- and are discarded once launch() creates the project. Needed so Signals page "Ask AI"
-- prompts (SIGNALS_ASK_AI_PROMPTS.md) can draw on {awake}/{o1-3}/{good}/{bad}/{turns}/
-- {given}/{open}/{actors} well after onboarding is over.
--
-- One row per project (1:1), own table rather than a jsonb column on `projects` — matches
-- this schema's existing convention of a dedicated table per distinct-step concern
-- (interviews, insights, sources) instead of blobs on the parent row. Not named
-- `focal_interviews` (the name SIGNALS_ASK_AI_PROMPTS.md assumed) to avoid colliding in
-- spirit with the existing, unrelated `public.interviews` table (Knowledge Base participant
-- interviews, 0001_schema.sql).
--
-- Column names mirror OnboardingState's blockA/B/C/D field ids 1:1 (snake_cased) — a dumb
-- field-for-field copy, not a remapping, to keep the write path bug-free. All nullable:
-- blockB's oracleQ2/Q3 are optional, and any whole block can be skipped in the UI.
create table public.onboarding_answers (
  project_id uuid primary key references public.projects(id) on delete cascade,
  company_name text,
  keeps_awake text,
  decision_5to10yr text,
  owner_and_deadline text,
  if_wrong_breaks text,
  oracle_q1 text,
  oracle_q2 text,
  oracle_q3 text,
  best_case_and_path text,
  worst_case_and_pivots text,
  turning_points text,
  inevitable text,
  genuinely_uncertain text,
  dependencies text,
  created_at timestamptz not null default now()
);

alter table public.onboarding_answers enable row level security;

create policy "manage rows in own org's projects" on public.onboarding_answers
  for all
  using (project_id in (select id from public.projects where org_id = public.current_org_id()))
  with check (project_id in (select id from public.projects where org_id = public.current_org_id()));
