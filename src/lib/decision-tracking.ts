// Shared "tracked event" fetch — used by both the decision-scan cron
// (src/lib/actions/decision-scan.ts, via createAdminClient) and the Monitoring/Strategy/Home
// data loader (src/lib/actions/decisions.ts, via the caller's own session client). Lives
// outside src/lib/actions/* (which is all "use server", and Next.js requires every top-level
// export of a "use server" file to be an async function — the sync helpers here would fail
// that, same reason src/lib/indicator-status.ts and src/lib/decision-model.ts live outside
// actions/ too). Takes the Supabase client as a parameter rather than constructing its own,
// same convention as project-integrations.ts's getConnectedSlackWebhookUrl.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { buildHistFromHistory, type LikelihoodLevel, type StorylinePhase, type TrackedEvent } from "@/lib/decision-model";

export function likelihoodTextToLevel(status: "observed" | "possible", likelihood: "Low" | "Medium" | "High" | null): LikelihoodLevel {
  if (status === "observed") return 4;
  if (likelihood === "High") return 3;
  if (likelihood === "Low") return 1;
  return 2; // Medium, or unset — a reasonable, honest default rather than guessing further
}

export interface TrackedEventRow {
  eventId: string;
  title: string;
  impact: number;
  phase: StorylinePhase;
  lever: "influence" | "watch" | null;
  forceId: string | null;
  forceTitle: string;
  pole: string;
  // Raw a/b side of `pole` above — Monitoring/Strategy only ever show the resolved pole text,
  // but the Home futures compass (compassPosition()) needs the raw letter to know which end
  // of the axis force this event pulls toward.
  side: "a" | "b" | null;
  supports: string[];
  currentLevel: LikelihoodLevel;
  history: HistoryEntry[];
}

export interface HistoryEntry {
  level: number;
  observedAt: string;
  cite: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  changedBy: "scan" | "user";
}

// Every event with at least one event_scenario_links row is "tracked". Pulls the supporting
// scenario ids, lever classification, representative force/pole (an event may link to several
// signals via event_signal_links — the first one, by created_at, stands in as "the" force the
// same way decision-data.js's mock gives each tracked event exactly one), and the full
// likelihood history (for resampling onto the window, not just the latest level).
export async function fetchTrackedEvents(supabase: SupabaseClient<Database>, projectId: string): Promise<TrackedEventRow[]> {
  const { data: links, error: linksError } = await supabase
    .from("event_scenario_links")
    .select("event_id, scenario_id, phase, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (linksError) throw linksError;
  if (links.length === 0) return [];

  const eventIds = Array.from(new Set(links.map((l) => l.event_id)));
  const supportsByEvent = new Map<string, string[]>();
  const phaseByEvent = new Map<string, StorylinePhase>();
  for (const link of links) {
    const supports = supportsByEvent.get(link.event_id) ?? [];
    supports.push(link.scenario_id);
    supportsByEvent.set(link.event_id, supports);
    if (!phaseByEvent.has(link.event_id)) phaseByEvent.set(link.event_id, link.phase as StorylinePhase); // earliest link wins (ordered above)
  }

  const [eventsResult, leversResult, signalLinksResult, historyResult] = await Promise.all([
    supabase.from("events").select("id, title, impact, status, likelihood").in("id", eventIds),
    supabase.from("event_levers").select("event_id, lever").in("event_id", eventIds),
    supabase.from("event_signal_links").select("event_id, signal_id, side, created_at").in("event_id", eventIds).order("created_at", { ascending: true }),
    supabase.from("event_likelihood_history").select("event_id, level, observed_at, cite, source_title, source_url, changed_by").in("event_id", eventIds),
  ]);
  if (eventsResult.error) throw eventsResult.error;
  if (leversResult.error) throw leversResult.error;
  if (signalLinksResult.error) throw signalLinksResult.error;
  if (historyResult.error) throw historyResult.error;

  const leverByEvent = new Map(leversResult.data.map((l) => [l.event_id, l.lever as "influence" | "watch"]));
  const signalLinkByEvent = new Map<string, { signalId: string; side: "a" | "b" | null }>();
  for (const l of signalLinksResult.data) if (!signalLinkByEvent.has(l.event_id)) signalLinkByEvent.set(l.event_id, { signalId: l.signal_id, side: l.side });

  const signalIds = Array.from(new Set(Array.from(signalLinkByEvent.values()).map((v) => v.signalId)));
  const { data: signals, error: signalsError } = signalIds.length
    ? await supabase.from("signals").select("id, title, pole_a, pole_b").in("id", signalIds)
    : { data: [] as { id: string; title: string; pole_a: string | null; pole_b: string | null }[], error: null };
  if (signalsError) throw signalsError;
  const signalById = new Map(signals.map((s) => [s.id, s]));

  const historyByEvent = new Map<string, HistoryEntry[]>();
  for (const row of historyResult.data) {
    const rows = historyByEvent.get(row.event_id) ?? [];
    rows.push({
      level: row.level,
      observedAt: row.observed_at,
      cite: row.cite,
      sourceTitle: row.source_title,
      sourceUrl: row.source_url,
      changedBy: row.changed_by as "scan" | "user",
    });
    historyByEvent.set(row.event_id, rows);
  }

  return eventsResult.data.map((e) => {
    const link = signalLinkByEvent.get(e.id) ?? null;
    const signal = link ? signalById.get(link.signalId) : null;
    const history = historyByEvent.get(e.id) ?? [];
    const seedLevel = likelihoodTextToLevel(e.status, e.likelihood);
    const currentLevel = history.length ? ([...history].sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0].level as LikelihoodLevel) : seedLevel;
    return {
      eventId: e.id,
      title: e.title,
      impact: e.impact ?? 3,
      phase: phaseByEvent.get(e.id)!,
      lever: leverByEvent.get(e.id) ?? null,
      forceId: link?.signalId ?? null,
      forceTitle: signal?.title ?? "(unlinked)",
      pole: link?.side === "a" ? (signal?.pole_a ?? "") : (signal?.pole_b ?? ""),
      side: link?.side ?? null,
      supports: supportsByEvent.get(e.id) ?? [],
      currentLevel,
      history,
    };
  });
}

// A tracked event with no history row yet (just linked, never scanned) gets one seeded from
// its own events.status/likelihood — changed_by 'user' since this reflects data the project
// already had, not something the scan itself discovered. Only ever runs once per event.
export async function seedMissingHistory(supabase: SupabaseClient<Database>, projectId: string, tracked: TrackedEventRow[]): Promise<void> {
  const unseeded = tracked.filter((t) => t.history.length === 0);
  if (unseeded.length === 0) return;
  const { error } = await supabase.from("event_likelihood_history").insert(
    unseeded.map((t) => ({
      project_id: projectId,
      event_id: t.eventId,
      level: t.currentLevel,
      changed_by: "user" as const,
      cite: "Seeded from the event's existing likelihood.",
    }))
  );
  if (error) throw error;
}

export function toTrackedEvent(row: TrackedEventRow, points: Date[]): TrackedEvent {
  return {
    eventId: row.eventId,
    impact: row.impact,
    phase: row.phase,
    lever: row.lever,
    supports: row.supports,
    hist: buildHistFromHistory(row.history, points, row.currentLevel),
  };
}
