-- Matrix backend — Step 4, Rank forces (§7, per design/handoff/2026-07-30/scenaric.pdf).
-- Supersedes the earlier deterministic 3-way bucketFor() model: bucket is now AI-classified
-- and persisted here, never recomputed client-side — Wildcard membership depends on whether
-- a signal describes a discrete shock (a real content judgment), not just impact/uncertainty
-- thresholds. Nullable: a matrix_dots row can exist (positioned) before it's classified.
alter table public.matrix_dots
  add column bucket text check (bucket in ('critical_uncertainty', 'predetermined', 'background', 'wildcard')),
  add column bucket_rationale text;
