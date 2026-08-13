-- Onboarding's focal-question AI calls (ai-focal-question.ts) happen before a project exists,
-- so ai_runs.project_id is null for them (0006_ai_runs_nullable_project.sql already allows
-- this) — meaning they can't be grouped by project the way every other step's calls can. `page`
-- tags which page/flow a call came from (e.g. "onboarding") so those calls stay queryable as a
-- unit. Nullable, no default needed: every existing caller omits it and stays unaffected.
alter table public.ai_runs add column page text;
