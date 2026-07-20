-- Gap fix surfaced by build order §14 item 2: §8's scenario-logics AI output schema
-- ({quadrant, name, tagline, summary, logic, plausible, implausibility_note}) needs
-- these columns, and the steps_complete gate (§13, gate 5) needs `plausible` — neither
-- existed in the step-1 schema, which followed §2's table listing (which omits them).
alter table public.scenarios
  add column logic text,
  add column plausible boolean,
  add column implausibility_note text;
