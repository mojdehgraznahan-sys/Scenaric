-- Driving-force prompts were never asked to generate real poles (pole_a/pole_b) -- every
-- signal confirmed through confirmResearchSuggestion's driving_forces/find("driving") branch
-- fell back to a hardcoded poleA:"Doesn't happen", poleB:<title>, which is why those signals
-- show no real two-sided future framing at all. These two columns let the producers
-- (suggestSignals, runMacroTrendSweep, runFindScan/Oracle/WorstCase/BlindSpot) actually supply
-- poles going forward. Nullable: a "key" force_type item (an actor profile, not a driving
-- force) never has poles, and rows created before this migration won't either.
alter table public.research_suggestions
  add column pole_a text,
  add column pole_b text;
