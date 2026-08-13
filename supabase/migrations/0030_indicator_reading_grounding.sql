-- Step 8 (Indicators/monitoring) research-mode enforcement, part 2 (see also
-- 0029_research_suggestions.sql): SCHWARTZ_METHODOLOGY_SKILL.md requires that every indicator
-- status change the daily monitoring job writes cite the specific news item/signal that
-- triggered it — never an ungrounded model judgment. indicator_readings.grounded_in
-- (0025_indicator_monitoring.sql) is nullable by design: a "no new evidence today, status
-- carried forward unchanged" day is a normal, expected case and must stay allowed with
-- grounded_in null. What must be rejected is a row where status_at_time actually CHANGES with
-- no citation. A plain check constraint can't compare against a prior row, so this needs a
-- trigger — same "guard the invariant at the column level, don't just trust the caller" spirit
-- as that migration's own indicator_readings_rationale_requires_citation constraint.
--
-- indicators.trend is intentionally NOT covered here — it's a mechanical 7-day rollup computed
-- in indicators-monitoring.ts, not sourced from a single citable event, so there's no single
-- grounded_in value that would make sense to require for it.

create or replace function public.enforce_indicator_reading_grounding() returns trigger as $$
declare
  prev_status text;
begin
  select status_at_time into prev_status
  from public.indicator_readings
  where indicator_id = new.indicator_id and date < new.date
  order by date desc
  limit 1;

  -- A first-ever reading (prev_status is null) still requires grounded_in — establishing an
  -- initial status is itself a "change" from nothing, matching ai-indicators-evaluation.ts's
  -- schema, which already requires grounded_in as non-optional for every proposed update.
  if (prev_status is null or prev_status is distinct from new.status_at_time) and new.grounded_in is null then
    raise exception 'indicator_readings: status set to % for indicator % with no grounded_in citation', new.status_at_time, new.indicator_id;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger indicator_readings_require_grounding
  before insert or update on public.indicator_readings
  for each row execute function public.enforce_indicator_reading_grounding();
