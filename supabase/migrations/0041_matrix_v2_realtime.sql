-- Matrix v2 (design/handoff/2026-10-01/CLAUDE_CODE_MATRIX_V2_PROMPTS.md, Prompt 5) — enables
-- Supabase Realtime on the 5 tables Matrix v2 subscribes to (store.tsx's matrix-v2 realtime
-- effect). No table in this project has ever been added to the supabase_realtime publication
-- before this migration — Postgres emits zero change events to any client for a table that
-- isn't in it, regardless of RLS or client-side .channel() code. This is additive only: it does
-- not change RLS, grants, or any existing read/write path.
--
-- SECURITY — VERIFY BEFORE RELYING ON THIS: on a current Supabase project, Postgres Changes is
-- documented to evaluate each subscriber's SELECT RLS policy before delivering a row, so this
-- SHOULD be as safe as any other RLS-protected read. It was not possible to confirm this
-- against the live project (no Docker/dashboard access in this session) — check Database >
-- Replication (or the Realtime inspector) after this migration runs, with two different
-- projects' data present, to confirm a client subscribed to project A never receives a change
-- row for project B. If RLS enforcement for Realtime is off for this project, this migration
-- would need to be paired with turning it on before going further.
alter publication supabase_realtime add table
  public.matrix_placements,
  public.axes,
  public.axis_headlines,
  public.events,
  public.event_signal_links;
