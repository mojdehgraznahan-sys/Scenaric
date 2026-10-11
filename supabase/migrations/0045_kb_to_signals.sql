-- Knowledge Base -> Signals (design/06-kb-to-signals): closes the insight -> event provenance
-- loop and lets an AI step derive forces/events from a project's own insights, staged into the
-- existing proposal tables (never a direct write -- see 0044's comment on why signals/events
-- grounded in insights must go through a confirm step, not straight into real rows).

-- events.insight_id: which insight (if any) a given event was grounded in/derived from. Used
-- by the Knowledge Base page to show "✓ In Signals" instead of the add-event button once an
-- insight has become a real event, and by Prompt 3's KB-derived "observed" events.
alter table public.events add column insight_id uuid references public.insights(id) on delete set null;
create index events_insight_id_idx on public.events(insight_id);

alter table public.events
  drop constraint events_created_via_check,
  add constraint events_created_via_check check (created_via in ('manual', 'news_match', 'ai', 'insight'));

-- force_proposals: a new_force proposal derived from the Knowledge Base cites the insights it
-- was grouped from -- same precedent as research_suggestions.grounded_in_insight_ids
-- (0044_research_suggestions_grounded_signals.sql), consumed on confirm to populate
-- signal_insight_links (confirmForceProposal has no other way to write those rows).
alter table public.force_proposals add column grounded_insight_ids uuid[] not null default '{}';

-- event_proposals previously only ever represented a "possible" future event (generateForPole's
-- per-pole suggestions). Deriving events from the Knowledge Base needs the other half too: a
-- past "observed" event grounded directly in one insight. event_status is deliberately not
-- named `status` -- that column already carries the proposal's own proposed/added/dismissed
-- lifecycle, and reusing the name would collide.
alter table public.event_proposals
  add column event_status text not null default 'possible' check (event_status in ('observed', 'possible')),
  add column occurred_on date,
  add column insight_id uuid references public.insights(id) on delete set null,
  add column wildcard boolean not null default false;
