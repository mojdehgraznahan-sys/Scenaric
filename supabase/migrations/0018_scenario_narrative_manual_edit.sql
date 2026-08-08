-- Narrative page, Step 6 manual editing + "Expand with AI" (Build Plan §9). Tracks whether
-- a human has hand-edited a scenario's narrative/summary since it was last AI-generated, so
-- a future "Expand with AI" run knows to warn before overwriting rather than silently
-- clobbering a manual edit. One flag covers both fields together (they're edited as a single
-- unit in the same Edit-mode action), not a per-field flag — there's no existing per-field
-- edit-provenance precedent in this schema to mirror (signals.origin is a whole-row,
-- creation-time tag, not a post-hoc edit flag).
alter table public.scenarios add column narrative_edited_by_user boolean not null default false;
