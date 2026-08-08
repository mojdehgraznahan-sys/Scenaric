-- News-feed connector (product extension — see SCHWARTZ_METHODOLOGY_SKILL.md: real-world
-- grounding must enter through the sources/insights pipeline, never through a narrative
-- prompt's own live search). 'web_feed' is distinct from the existing 'web' type (a single
-- user-pasted URL): it's an automated batch of dated news items the connector inserts
-- itself, each already complete with extracted_text (no async fetch step needed, unlike
-- 'web' which still goes through processWebSource). Kept as its own value rather than
-- reusing 'web' so the Knowledge Base can tell "user pasted this" from "the connector
-- found this" apart, same reasoning as 'unsupported' getting its own status value in
-- 0008_insights_extraction_columns.sql.
alter table public.sources
  drop constraint sources_type_check,
  add constraint sources_type_check check (type in ('doc', 'audio', 'survey', 'web', 'web_feed'));
