-- Signals "Ask AI" Group 1 "Find" prompts (SIGNALS_ASK_AI_PROMPTS.md) ask the model to
-- classify individual output items as key-force-or-driving-force *within one response*
-- (e.g. "Scan for forces I haven't captured" can return a mix of both in one call).
-- research_suggestions.step previously doubled as routing: confirmResearchSuggestion
-- branches on it to decide `signals` (driving_forces) vs `sources`+`insights` (key_forces),
-- and each existing step value is read by a different page (page-signals.tsx vs
-- page-knowledge.tsx). Inserting Find's output under the per-item classification would
-- silently route half of one scan to the wrong page/table.
--
-- 'find' is a new, third step value: every Find-producer inserts under it regardless of an
-- item's key-vs-driving classification (preserved for display via the existing actor_type/
-- category columns), and confirmResearchSuggestion treats it the same as 'driving_forces' —
-- always promotes into `signals`, since that's what "before becoming real signals" requires.
alter table public.research_suggestions
  drop constraint research_suggestions_step_check,
  add constraint research_suggestions_step_check check (step in ('key_forces', 'driving_forces', 'find'));
