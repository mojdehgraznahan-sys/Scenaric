-- Backend build order §14 item 4b Phase 1 — private Storage bucket for uploaded
-- source files. Path convention: {project_id}/{uuid}-{filename}, so the RLS policy
-- below can resolve ownership the same way every project-scoped table does (§2/§3
-- callout in 0003_rls.sql) without ever exposing org_id to the browser.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sources',
  'sources',
  false,
  26214400, -- 25MB
  array[
    'application/pdf',
    'text/csv',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'video/mp4'
  ]
)
on conflict (id) do nothing;

-- storage.objects already has RLS enabled by default on every Supabase project
-- (owned by supabase_storage_admin — the SQL Editor's role can't ALTER it, and
-- doesn't need to).

create policy "org members manage their org's source files"
on storage.objects
for all
using (
  bucket_id = 'sources'
  and (storage.foldername(name))[1]::uuid in (
    select id from public.projects where org_id = public.current_org_id()
  )
)
with check (
  bucket_id = 'sources'
  and (storage.foldername(name))[1]::uuid in (
    select id from public.projects where org_id = public.current_org_id()
  )
);
