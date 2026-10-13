-- design/strategy_handoff's Levers section adds a third lever value: 'shape' (an event WE make
-- happen directly, via our own initiative) alongside the existing 'influence' (partnership/
-- coalition) and 'watch' (outside our control). event_levers.lever only allowed
-- ('influence','watch') until now.
--
-- Separately (not a schema change, flagged here for whoever reads this migration next): no UI
-- or AI flow in this codebase has ever written to event_levers — grep confirms it before this
-- change. The Strategy page's Levers columns have been rendering empty on every real project.
-- The app-code change landing alongside this migration adds the first real write path
-- (page-strategy.tsx's Levers section) rather than resurrecting a column nobody could use.
alter table public.event_levers drop constraint event_levers_lever_check;
alter table public.event_levers add constraint event_levers_lever_check check (lever in ('shape', 'influence', 'watch'));
