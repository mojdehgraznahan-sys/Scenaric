-- Knowledge Base's "Invite participant" modal is about to actually send an email (via Resend)
-- instead of only logging a post-hoc participant record — needs somewhere to put the address
-- and whether/when the invite email itself went out. Both nullable, no default — same
-- precedent as 0031_ai_runs_page.sql's `page` column: existing rows and callers are unaffected.
alter table public.interviews
  add column participant_email text,
  add column invited_at timestamptz;
