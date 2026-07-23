-- Backend build order §14 item 4b Phase 2 — §5's AI output schema needs quote/actor_type
-- on insights (missing since migration 0001). sources.status also needs a fourth state:
-- 'unsupported' distinguishes "we don't parse this file type yet" (DOCX/audio, honestly
-- deferred) from 'failed' ("we tried and it broke").

alter table public.insights
  add column quote text,
  add column actor_type text;

alter table public.sources
  drop constraint sources_status_check,
  add constraint sources_status_check check (status in ('processing', 'complete', 'failed', 'unsupported'));
