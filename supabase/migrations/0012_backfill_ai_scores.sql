-- Matrix backend build — 0011 added ai_impact/ai_uncertainty, but scoreSignalRow
-- (ai-signals.ts) wasn't updated to populate them until after some signals were already
-- scored. For any signal scored before that fix, impact/uncertainty already holds the
-- original AI score (no override mechanism existed before this build) — backfill it into
-- ai_impact/ai_uncertainty so those signals don't look unscored-by-AI once a user later
-- drags their dot and overwrites the effective impact/uncertainty.
update public.signals
set ai_impact = impact, ai_uncertainty = uncertainty
where impact is not null and ai_impact is null;
