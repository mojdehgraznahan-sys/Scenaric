-- Every runStructured() call already gets Anthropic's per-call token usage back
-- (response.usage) and was discarding it — ai_runs logged what ran, never what it cost.
-- These columns capture it so spend can be rolled up per project (Settings → Billing).
-- Nullable, no default: historical rows predate this and stay null rather than a fake 0.
alter table public.ai_runs add column input_tokens integer;
alter table public.ai_runs add column output_tokens integer;
alter table public.ai_runs add column cache_creation_input_tokens integer;
alter table public.ai_runs add column cache_read_input_tokens integer;

-- Project-scoped rollup for the Billing tab. Deliberately NOT security definer (unlike
-- current_org_id in 0003_rls.sql) — this should run with the caller's own permissions so
-- ai_runs' existing RLS policy ("manage rows in own org's projects") still applies; it's a
-- convenience aggregate, not a privilege escalation.
create or replace function public.project_ai_token_totals(p_project_id uuid)
returns table (
  call_count bigint,
  input_tokens bigint,
  output_tokens bigint,
  cache_creation_input_tokens bigint,
  cache_read_input_tokens bigint
)
language sql
stable
as $$
  select
    count(*) as call_count,
    coalesce(sum(ai_runs.input_tokens), 0) as input_tokens,
    coalesce(sum(ai_runs.output_tokens), 0) as output_tokens,
    coalesce(sum(ai_runs.cache_creation_input_tokens), 0) as cache_creation_input_tokens,
    coalesce(sum(ai_runs.cache_read_input_tokens), 0) as cache_read_input_tokens
  from public.ai_runs
  where ai_runs.project_id = p_project_id
$$;
