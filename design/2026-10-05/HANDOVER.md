# Decision layer build — handover

Continuing this in a new session? Read this whole file first — it's self-contained. The
original plan (written before implementation started) is also still at
`~/.claude/plans/shimmying-giggling-boole.md` on this machine, but everything you need is below.

## What this is

`design/2026-10-05/` is a 5-package design handoff ("Monitoring + Strategy decision layer").
Goal: trace event likelihood → scenario momentum/health → recommended actions → a route of
moves toward a chosen target scenario, surfaced on Monitoring, Strategy, and a new CEO view on
Home — momentum/health as *relative evidence*, never a probability on a scenario.

**The handoff package was stale against the codebase it landed on.** Every phase found and
resolved real collisions between what the handoff assumed and what already existed — check
reality before trusting the handoff's literal text, the way every Finding below did.

## Status: Phases 1-5 all built. Not yet committed/pushed, and not yet applied/verified — see "Still open" below.

Current branch `feature/initial-design-import`. Phases 1-3 are committed and pushed (see commits
below); Phases 4-5's changes are complete in the working tree but **not yet committed** — this
session's work ended before the usual stage/commit/push/fast-forward-to-main step (see "Git
workflow" below for the exact sequence). Relevant commits, newest first:
```
d3c3416 Rebuild Strategy as Strategy v2
9dfe9ef Add decision layer backend and rebuild Monitoring as Monitoring v2
```
Both pushed to `origin/feature/initial-design-import` and `origin/main`. Phase 4-5's own commit
is still pending.

## Still open (read this before considering the effort "done")

1. **Migration `0043_home_view_preference.sql` has NOT been applied to either Supabase
   project.** It's a one-line additive change (`alter table public.profiles add column
   home_view ...`), same low-risk shape as every prior migration, but applying schema changes to
   a live database is a deliberately-not-automated action in this session — paste it into each
   project's SQL Editor by hand (same process as every migration since 0001, no Supabase CLI
   available). The app will throw on any `getHomeView`/`setHomeView` call until this runs on the
   project being tested against.
2. **Still never visually verified in a browser** — same gap Phases 1-3 left open (no project in
   either Supabase database has any tracked events yet, i.e. `event_scenario_links` is empty
   everywhere). Phase 5's event-picker-modal is the forward-going fix (new Storyline nodes can
   now ground themselves in a real event and auto-sync `event_scenario_links` — see Finding 9),
   but nobody has actually added one through the UI yet. Do that, then open Home/Monitoring/
   Strategy in a real browser before calling any of this "verified," not just `tsc`/lint/build.

## Findings that changed the handoff's plan (still true, still load-bearing)

1. **`indicators`/`indicator_readings` are retired**, replaced end-to-end by the new
   event-likelihood model. They're still in the DB schema and still being written to by the
   `indicators-monitor` cron (`vercel.json` still has that entry — deliberately, grace period),
   but Monitoring v2's UI no longer reads them. Nothing in Phase 4/5 should resurrect them.
2. **`signposts` already existed** before this work (AI-generated, web-search-grounded,
   `status`/`citations`/`rationale`) and was *extended*, not recreated, with `state`
   ('not_yet'/'approaching'/'hit'), `hit_at`, `source_event_id`. Both vocabularies coexist on
   the same row right now; new code should only ever read/write `state`.
3. **`storyline_nodes.event_id`** was added (nullable) alongside the pre-existing `signal_id`.
   A one-time AI-proposes/human-confirms backfill ran against both Supabase projects (see
   below) — most nodes had nothing to backfill (no gap existed yet), one project had 8 nodes
   left unmapped (low AI confidence, correctly not guessed). **Phase 5's event-picker-modal
   rework is how those get resolved going forward and by hand** — don't build a separate
   review screen for them.
4. No Supabase Edge Functions exist in this repo — "daily job" always means Vercel Cron → a
   Next.js route handler (`src/app/api/cron/*/route.ts`), using `createAdminClient()`
   (service-role, bypasses RLS) because a cron invocation has no session.
5. **Realtime is deliberately NOT enabled** for `action_cards`/`route_moves`. A prior migration
   (`0041_matrix_v2_realtime.sql`) added Matrix v2 tables to the `supabase_realtime`
   publication, then got emptied out again (commit `457633f`) because its own comment flagged
   that Postgres Realtime's per-subscriber RLS enforcement was never actually verified on this
   project. Until someone resolves that (check Supabase's Database → Replication / Realtime
   inspector with two orgs' data present), **don't add more tables to that publication** — it
   would repeat the same unverified cross-project exposure risk. Live updates for the decision
   layer are same-tab only, via a `fm:decisions-updated` `window.CustomEvent`
   (`src/lib/use-decisions.ts`), same convention as every other entity in this app.
6. **`home_view` lives on `profiles`, not a new `user_preferences` table.** `profiles`
   (0001_schema.sql) is already exactly "one row per user, RLS'd to its own owner" (0003_rls.sql's
   `update own profile` policy, keyed on `auth.uid()`) — the handoff's literal "create a
   user_preferences table" would have stood up a second one-column table for the same concern.
   `home_view` is nullable: null means "no explicit choice saved yet," and the app computes its
   own setup/ceo default client-side (gated on `stepsComplete >= 8`, the existing Strategy-step
   gate — see Finding 7) rather than this column ever guessing. New action file:
   `src/lib/actions/home-view.ts` (`getHomeView`/`setHomeView`, both scoped to the caller's own
   session, no userId param needed).
7. **There is no reliable stored mapping from a scenario to "which pole of each Matrix axis it
   represents."** `scenarios.quadrant` (TL/TR/BL/BR) IS AI-assigned at scenario-build time
   (`ai-scenarios.ts`), but nothing ties a specific quadrant letter to a specific pole of the
   axis signal in a way that's guaranteed consistent project-to-project — confirmed by reading
   `build-scenarios-modal.tsx`'s own `axisMeta()`, whose pos/neg labels are a hardcoded table for
   nine mock signal ids with a generic "High"/"Low" fallback for every real signal, i.e. no real
   pole-to-letter convention exists anywhere in this codebase. This is why the Phase 4 prompt's
   "don't rely on scenarios.quadrant" warning is correct advice for the real app too, not just
   the mock. The fix used in `page-home-v2.tsx`: derive each scenario's quadrant the same way the
   evidence trail is derived — `compassPosition()` over just that scenario's own supporting
   tracked events (via `event_scenario_links`), using a fixed, self-consistent convention (pole
   `'b'` = "positive") applied everywhere. This guarantees the trail and the quadrant tinting
   never disagree, at the cost of an honest degenerate case: with zero tracked events (true of
   every project right now), every scenario computes to the same quadrant. That's expected
   behavior for an evidence-driven compass with no evidence yet, not a bug.
8. **`TrackedEventRow` (`decision-tracking.ts`) gained a `side: "a" | "b" | null` field** — the
   raw letter behind the already-existing `pole` (resolved display text). Monitoring/Strategy
   never needed the raw letter; the Home compass does, to feed `compassPosition()`'s
   `isPlusPole`. `DecisionsData` (`decisions.ts`) also gained `axes: DecisionAxes | null` (the
   project's active two axis signals, each with both poles resolved) in the same
   `getDecisionsData()` round-trip — no parallel fetch.
9. **Creating a storyline node grounded in an event now also upserts `event_scenario_links`**
   (`createStorylineNode`/`updateStorylineNode` in `storyline.ts`, via a new
   `syncEventScenarioLink` helper) — keyed on the node's final event_id + phase, re-synced on
   every phase move too. Without this, an event added to a chain via the new event-picker-modal
   would sit in Storyline but never actually become "tracked" (Monitoring/Strategy/Home all read
   `event_scenario_links`, not `storyline_nodes`, to decide what's tracked) — the acceptance
   check "an event created from Storyline appears in Monitoring after the next scan" depends on
   this.

## What got built (Phases 1-3)

**Schema** — `supabase/migrations/0042_decision_layer.sql`: `event_likelihood_history` (+
`event_likelihood_current` view), `event_scenario_links`, `event_levers`, `discovered_events`,
`action_cards`, `strategy_targets` (keyed on `project_id`, one target per project — not per
`strategic_options` row), `route_moves`, `strategy_revisions`, `briefings`,
`momentum_snapshots`, `scan_runs`; extends `signposts` and `storyline_nodes` (see Findings 2-3).
**This migration has already been applied to BOTH Supabase projects** — the local dev one
(`.env.local`'s `NEXT_PUBLIC_SUPABASE_URL`) and the separate one Vercel's deployment uses. If
Phase 4/5 needs its own migration (it will, at minimum for a `user_preferences` table — see
below, confirmed not to exist yet), **remember there are two databases, not one** — apply to
both the same way (Supabase SQL Editor, since no Supabase CLI is available in this dev
environment — confirmed, `which supabase` found nothing).

**Backend**:
- `src/lib/decision-model.ts` — pure roll-up math (`momentum`, `health`, `progress`, `levers`,
  `compassPosition`, `delta`, `windowPoints`/`buildHistFromHistory` for resampling). 12 Vitest
  tests in `decision-model.test.ts` (new: `vitest.config.ts`, `npm test`). **One test documents
  a real bug in the handoff's own mock data** — its Prompt 2 claims "Bamboo Curtain has reached
  Catalysts" against the seed data in `decision-data.js`; running the exact ported math against
  that same seed gives 0 (one event's drop breaks the "every event ≥ High" requirement). Don't
  "fix" the test to match the handoff's claim — the math is a faithful port, the claim is wrong.
- `src/lib/decision-tracking.ts` — shared `fetchTrackedEvents`/`seedMissingHistory`/
  `toTrackedEvent`, used by both the cron job and the page data loader. Lives outside
  `src/lib/actions/` (not `"use server"`) because those files can only export async functions.
- `src/lib/actions/decision-scan.ts` + `ai-decision-scan-evaluation.ts` +
  `ai-decision-scan-cards.ts` + `src/app/api/cron/decision-scan/route.ts` — the daily job,
  wired into `vercel.json` (currently running *alongside* `indicators-monitor`, not instead of
  it — that old cron entry should be removed once you're confident nothing needs it, likely a
  Phase-4/5-adjacent cleanup, not urgent).
- `src/lib/actions/ai-storyline-event-backfill.ts`, `indicators-retirement-seed.ts` — the two
  one-time backfills. Both already run against both Supabase projects (see "Operational
  gotchas" for *how*, if you ever need to re-run them).
- `src/lib/actions/decisions.ts` + `src/lib/use-decisions.ts` (`useDecisions` hook) +
  `src/components/decision-ui.tsx` (`DcSpark`/`DcTrend`/`DcScenarioDots`/`DcActionCard`/
  `DcBriefing`) — the shared data layer and UI Monitoring/Strategy/Home all use.
  **`decision-ui.tsx` was already fixed to use this app's real `Button` component and Tailwind
  classes, not the mockup's `.btn`/`.card`/`.badge` CSS classes (which don't exist in this
  app's actual stylesheet)** — if Phase 4 copies more markup from the reference HTML, watch for
  this same trap again. Grep for literal `className="btn` / `className="card` / `className="badge`
  before trusting any freshly-pasted mockup markup.

**Pages**:
- `src/components/page-monitoring.tsx` — fully rebuilt (Monitoring v2). Old indicators UI and
  its `AddIndicatorDialog` removed from this page; `indicators-monitoring.ts` itself untouched.
- `src/components/page-strategy.tsx` — fully rebuilt (Strategy v2): target picker, route health
  strip, recommended actions (with a new owner/due-date Accept popover — `AcceptPopover` in
  that file, no reference markup existed for it), levers, route swimlane with an **AI "Draft
  route" feature built fresh** (`src/lib/actions/ai-strategy-route.ts` — drafts moves grounded
  in real levers/signposts/options, reviewed in a modal, nothing inserted until confirmed),
  proposed-revision card, and the Wind tunnel (pre-existing options-vs-scenarios grid, extended
  with a target-column highlight + Robust/Depends-on-target/Hedge verdicts).
  **Kept the pre-existing "Mark as primary" / AI-recommendation panel / Ask AI cell-selection
  wiring (`store.strategyAskAiContext`, read by `ask-ai.tsx`)** — an early draft of this
  rewrite dropped all three by accident; caught it by diffing the new file against `git diff
  HEAD` before calling it done. **Do this same diff check on page-dashboard.tsx before Phase 4
  is "done"** — it's very easy to silently drop working functionality while porting in a big
  new reference-HTML block.

**Verification used throughout** (repeat for Phase 4/5): `npx tsc --noEmit -p tsconfig.json`,
`npx next lint`, `npx vitest run`, and a full `npx next build` (catches real bundler-level
issues — missing exports, server/client boundary violations — that `tsc` alone misses). A full
build is also the only practical way to verify a page compiles in this environment: the app
requires an authenticated session, so `curl`ing a page route just hits the `/login` redirect
and never exercises your component code at all.

**Known untested gap**: as of the last backfill run, **no project in either Supabase database
has any tracked events yet** (`event_scenario_links` is empty everywhere). That means the rich
UI paths on Monitoring/Strategy (target banner, momentum cards, tracked events list, levers,
route swimlane) have only been verified via `tsc`/lint/build, never actually seen rendered with
real data in a browser. Only the "no tracked events yet" / "no target chosen" empty states have
any real-world grounding. Once Phase 5's event-picker-modal ships (or via manual
`event_scenario_links` rows), exercise the full page in a browser before considering this
whole effort visually verified.

## Operational gotchas (learned the hard way this session)

- **Never run a broad `pkill -f "next dev"`.** It kills every matching process, including a
  dev server the user already had running on port 3000 before you touched anything — this
  happened once this session. Target specific PIDs you started yourself
  (`lsof -t -i :<port>` right after starting it, or capture `$!`), never a pattern that could
  match something you didn't start.
- **A standalone Node/tsx script cannot call these backend action files.**
  `src/lib/supabase/admin.ts` and `src/lib/ai/client.ts` both `import "server-only"`, which
  unconditionally throws outside Next.js's own server build (it only resolves to a no-op when
  Next's bundler requests the `react-server` export condition). To run a one-time admin
  action, temporarily add a route under `src/app/api/cron/<name>/route.ts` (that path prefix is
  required — `src/middleware.ts`'s `PUBLIC_PREFIXES` only exempts `/api/cron/` from the
  auth-redirect gate, not e.g. `/api/admin/`), protect it with the existing `CRON_SECRET` check,
  run `npm run dev`, hit it with `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:PORT/api/cron/<name>`,
  then delete the route again.
- **Two separate Supabase projects.** Local dev reads `.env.local`. Vercel's deployment uses a
  *different* project — different URL, different service-role key. Any schema change or
  one-time backfill needs to run against both, separately. To run an admin route against the
  Vercel-linked project from this local machine: get its `NEXT_PUBLIC_SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY` from Vercel's dashboard env vars, put them in a local
  `.env.<name>.local` file (matches `.gitignore`'s `.env*.local`), temporarily merge just those
  two keys (plus a locally-generated `CRON_SECRET` — it doesn't need to match anything on
  Vercel, it's just a shared secret between your own curl and your own route) into `.env.local`
  (back up the original first!), run the dev server, hit the route, then **restore the original
  `.env.local` from your backup** and delete the temp file. `package.json`'s dependency list
  doesn't change for this — don't add Supabase CLI or anything else to make it "easier," this
  is already the minimal-footprint way to do it in this environment.
- **No Supabase CLI in this dev environment.** Migrations get applied by pasting the `.sql`
  file into each project's Supabase dashboard → SQL Editor, by hand, once per project.

## Phase 4 — Home: CEO view + Setup view switch (done, pending migration + browser check)

Reference: `design/2026-10-05/04-home-ceo-view/Home CEO View Standalone.html` and that folder's
`PROMPTS.md`.

**What got built:**
- `src/components/page-home.tsx` — `PageHome`, the fixed top strip (Setup/CEO switch +
  "Executive briefing" button) that renders `PageDashboard` or `PageHomeV2` below it. Both
  `home` and `dashboard` were supposed to route here per the handoff, but **`dashboard` was
  never a real route in this codebase** (confirmed: `src/app/(app)/home/page.tsx` is the only
  one; `top-bar.tsx`'s `dashboard: "Home"` TITLES entry is vestigial, nothing links to it) — only
  `src/app/(app)/home/page.tsx` needed updating, to render `PageHome` instead of `PageDashboard`
  directly.
- `src/lib/actions/home-view.ts` — `getHomeView`/`setHomeView`, reading/writing
  `profiles.home_view` for the caller's own session (see Finding 6 for why `profiles`, not a new
  table). `PageHome` resolves the view as: saved preference, else `ceo` if
  `stepsComplete >= 8` (Finding 7 — the existing Strategy-step gate), else `setup`; only computed
  once on mount, so a project reaching "has a strategy" later doesn't yank a user who already
  chose Setup back into CEO view.
- `src/components/page-home-v2.tsx` — `PageHomeV2`, the CEO view: headline (leading-momentum
  scenario + target health, same "highest momentum score" definition `DcBriefing` already uses —
  confirmed they can't disagree), futures compass (SVG, quadrant placement per Finding 7, not
  `scenarios.quadrant`), route-health gauge, decisions-waiting list (reusing `DcActionCard`
  exactly like Monitoring/Strategy), scenario-momentum small multiples, a "what moved" diverging
  bar chart, signpost progress, and a mini route-to-target swimlane (new `ROUTE_LANES`/
  `ROUTE_HORIZONS`/`ROUTE_HORIZON_LABEL`/`ROUTE_MOVE_STATUS_STYLE` exports hoisted from
  `page-strategy.tsx` into `decision-ui.tsx` so Home and Strategy share one definition). Gated on
  a target being chosen (mirrors Monitoring's own "choose a target in Strategy" empty state) —
  without a target the CEO view doesn't have a thesis to render. Each chart element that maps to
  one real event (diverging bars) links to `/monitoring?event={id}`, which now actually does
  something (see below), not a no-op query param.
- `src/components/page-dashboard.tsx` — News Feed's "+ Add to Signals" button and its
  `addToSignals`/`addingIds` client state removed (confirmed real, unlike the handoff's other
  "already removed" claims about this page). The backend route itself is untouched, same
  grace-period caution as the indicators retirement.
- `src/components/page-monitoring.tsx` — reads `?event=` (via `useSearchParams`, already
  Suspense-wrapped in `src/app/(app)/monitoring/page.tsx`) and scrolls to + briefly highlights
  that event's row once loaded, so Home's "links to its source event in Monitoring" acceptance
  line is a real behavior, not just a URL that goes nowhere.
- `supabase/migrations/0043_home_view_preference.sql` — the one-line `profiles.home_view`
  column. **Written, not applied** — see "Still open" above.
- Diffed `page-dashboard.tsx` against `git diff HEAD` per the standing instruction — confirmed
  only the one intended removal, nothing else dropped.

## Phase 5 — Nav, Storyline wording, event-picker-modal (done)

Reference: `design/2026-10-05/05-nav-and-labels/PROMPTS.md` (no reference HTML — small, precise
edits).

**What got built:**
- `side-nav.tsx`'s DECISIONS group now lists Monitoring before Strategy (icons unchanged).
- `top-bar.tsx`'s TITLES map: `strategy: "Strategic Options"` → `"Strategy"`.
- `src/components/storyline/signal-picker-modal.tsx` → `event-picker-modal.tsx`
  (`SignalPickerModal` → `EventPickerModal`), aria-label/title → "Add event to storyline". The
  Library tab now lists `store.events` (not `store.signals`); "Create new" builds a real event
  (title/body/status/occurred-or-window/likelihood/impact) with an optional force+pole picker
  (`slPole`/`eventCategory` from `components/signals/pole.ts`, same helpers `add-event-modal.tsx`
  already uses — no parallel force-linking logic invented), then calls `store.createEvent` and
  `createStorylineNode({ eventId })`.
- `canvas.tsx`'s per-column "+ Add signal" → "Add event"; `pieces.tsx`'s
  `StorylineEmptyState` CTA "Browse Signals Library" → "Browse Events Library" (plus its "Drag
  signals..." body copy → "Drag events...").
- Backend, not in the original Phase 5 bullet list but required to make it actually work:
  - `storyline.ts`'s `createStorylineNode`/`updateStorylineNode` gained `eventId` support (a new
    `loadEventForNode` helper, mirroring the existing `loadSignalForNode`) and — this is the
    load-bearing part — a new `syncEventScenarioLink` helper that upserts `event_scenario_links`
    whenever a node is grounded in an event or an already-grounded node's phase changes. Without
    this, Finding 3/9 applies: a node could sit in Storyline but never become "tracked"
    anywhere else. See Finding 9.
  - `data.ts`'s `StoryNode` gained `eventId`; `story-adapter.ts`'s `toStoryNode` maps it (and now
    takes an optional `EventItem` for source/impact/uncertainty enrichment, alongside the
    existing `Signal` param); `computeChainConfidence`'s groundedRatio counts `eventId` too.
  - `page-storyline.tsx` resolves `store.events` by `event_id` alongside the existing
    `store.signals` by `signal_id` lookup when building nodes from the loaded storyline rows.
- Acceptance checks: `grep -ri "add signal to chain"` returns nothing in `src/` (confirmed).
  "An event created from Storyline shows up in Monitoring after the next scan" — the write path
  is in place (Finding 9) but **not yet exercised through the real UI** — still part of the
  "Still open" browser-verification gap above.

## Verification checklist for Phase 4/5 — all four green as of this session

- `npx tsc --noEmit -p tsconfig.json`, `npx next lint`, `npx vitest run` (12/12 passing,
  unchanged), `npx next build` — all four ran clean after every edit, not just once at the end.
- `git diff HEAD -- <file>` on every rewritten page — confirmed intentional, minimal diffs on
  `page-dashboard.tsx`, `page-monitoring.tsx`, `page-strategy.tsx`, `decision-ui.tsx`; nothing
  silently dropped.
- Migration **written, NOT applied** to either Supabase project — deliberately left for a human
  (or an explicit follow-up instruction) rather than mutating a live database unprompted. Needs
  the SQL Editor paste on both projects before `getHomeView`/`setHomeView` will work.
- **Still not opened in a real browser** — same caveat as Phases 1-3, now compounded: Phase 5's
  event-picker-modal is the first real way to get a tracked event into any project, but nobody's
  used it yet. Do that (needs the migration applied first, or `home_view` reads/writes will
  throw), then look at Home/Monitoring/Strategy for real before calling this "verified."

## Git workflow used this session

Each phase: stage only the files actually touched (never `git add -A` — `supabase/.temp/` sits
untracked and unrelated in this repo, don't sweep it in), commit on
`feature/initial-design-import`, push it, then `git checkout main && git merge
feature/initial-design-import --ff-only && git push origin main`, then `git checkout
feature/initial-design-import` again. This only stays a trivial fast-forward because the two
branches are kept in lockstep — if `main` ever gets its own independent commits, this stops
being a `--ff-only` merge and needs a real decision about how to reconcile.
