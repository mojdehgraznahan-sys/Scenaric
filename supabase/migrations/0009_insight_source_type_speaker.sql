-- Denormalizes source_type onto insights (Docs/Audio/Survey/Web — the exact vocabulary
-- the Knowledge Base tabs use, not the lowercase sources.type enum) so tab filtering is a
-- direct equality check instead of a join through source_id at render time. Adds
-- speaker_name/speaker_role, populated from a linked interviews row when one exists (real
-- backend data — never fabricated from transcript text) rather than a new AI capability.
-- Nullable, with a backfill so pre-existing rows aren't silently excluded from the
-- Docs/Audio/Survey/Web tabs post-migration (they'd otherwise only ever show under "All").

alter table public.insights
  add column source_type text check (source_type in ('Docs', 'Audio', 'Survey', 'Web')),
  add column speaker_name text,
  add column speaker_role text;

update public.insights i
set source_type = case s.type
  when 'doc' then 'Docs'
  when 'audio' then 'Audio'
  when 'survey' then 'Survey'
  when 'web' then 'Web'
end
from public.sources s
where i.source_id = s.id and i.source_type is null;
