-- Canvas backend build (Step 5, §8) — GET /projects/:id/scenarios needs to surface
-- when a scenario was last migrated by a re-axis. Nullable and currently unpopulated:
-- the actual re-axis commit/migration write path is a separate, still out-of-scope
-- feature (reaxis-modal.tsx's applyReaxis() remains local-only) — this column exists
-- so the read contract is forward-compatible with that future write, not speculative.
alter table public.scenarios add column reaxed_at timestamptz;
