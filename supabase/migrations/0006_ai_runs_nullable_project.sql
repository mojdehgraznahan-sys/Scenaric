-- §4 (focal-question refine) fires during onboarding, before a project exists — the
-- ai_runs audit log needs to accept that pre-project case.
alter table public.ai_runs alter column project_id drop not null;
