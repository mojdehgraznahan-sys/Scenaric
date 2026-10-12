-- Two small additive columns, both closing gaps found auditing Monitoring v2
-- (design/2026-10-05/02-monitoring/PROMPTS.md) against the real implementation.
--
-- 1. event_likelihood_history.changed_by_user_id: Prompt 2's "An event user-overridden in
--    Signals" edge case requires showing "Updated by {name}". The existing `changed_by` column
--    is only the 'scan'|'user' enum — there was no column to resolve a name from. Nullable:
--    null for every pre-existing 'scan' row and for the one-time seedMissingHistory backfill
--    rows (decision-tracking.ts), which reflect data the project already had, not a specific
--    person's edit.
--
-- 2. discovered_events.created_event_id: Prompt 1's "Every decision has an Undo" wasn't wired
--    up for the discovery inbox. Reversing 'confirmed' needs to find and delete the real event
--    that confirming created (its event_signal_links/event_scenario_links/
--    event_likelihood_history rows all cascade-delete with it; storyline_nodes.event_id is
--    on delete set null) — this column is how Undo finds that event. Null until confirmed.
alter table public.event_likelihood_history
  add column changed_by_user_id uuid references auth.users(id) on delete set null;

alter table public.discovered_events
  add column created_event_id uuid references public.events(id) on delete set null;
