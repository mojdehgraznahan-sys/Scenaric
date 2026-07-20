-- On signup: create a personal org (1:1 — no team/invite UI yet, but the boundary
-- exists per the build plan's §2), a profile, and one starter project seeded from
-- today's demo content (src/lib/data.ts) so /projects isn't empty on first login.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_org_id uuid;
begin
  insert into public.orgs (name)
  values (coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)) || '''s workspace')
  returning id into new_org_id;

  insert into public.profiles (id, org_id, name, email)
  values (new.id, new_org_id, new.raw_user_meta_data->>'name', new.email);

  insert into public.projects (
    org_id, name, focal_question, horizon, industry, summary, created_by
  ) values (
    new_org_id,
    'APAC Expansion 2030',
    'How should we approach SEA market entry given geopolitical uncertainty over the next 5-10 years?',
    '5–10 years',
    'Technology',
    'Strategic planning for Southeast Asia expansion across Indonesia, Vietnam, Philippines, and Thailand markets.',
    new.id
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
