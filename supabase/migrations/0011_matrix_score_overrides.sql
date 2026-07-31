-- Matrix backend build — Step 4 (Rank forces, §7). The Matrix page's drag-to-reposition
-- interaction is a manual override of a signal's AI-assigned impact/uncertainty score.
-- `signals.impact`/`uncertainty` (0001_schema.sql) stay the *effective* value every other
-- feature already reads (Signals Library, Ask AI, sorting) — these new columns keep the
-- original AI score and any user override separately auditable, so an override is never a
-- silent, unrecoverable overwrite.
alter table public.signals
  add column ai_impact int check (ai_impact between 1 and 5),
  add column ai_uncertainty text check (ai_uncertainty in ('Low', 'Medium', 'High')),
  add column user_impact int check (user_impact between 1 and 5),
  add column user_uncertainty text check (user_uncertainty in ('Low', 'Medium', 'High'));
