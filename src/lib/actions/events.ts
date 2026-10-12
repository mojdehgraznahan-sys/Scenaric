"use server";

// Signals page "Events" view — CRUD for the events/event_signal_links tables
// (0037_events.sql). Same shape/conventions as signals.ts: plain fetch, explicit
// revalidatePath, a two-query-plus-JS-join for the linked rows (mirrors listSignals'
// signal_insight_links join).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { SteepCategory } from "./signals";
import { likelihoodTextToLevel } from "@/lib/decision-tracking";

export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type EventLink = { signalId: string; side: "a" | "b" };
export type EventWithLinks = EventRow & { links: EventLink[] };

// Monitoring/Strategy (decision-tracking.ts's fetchTrackedEvents) read an event's current
// likelihood from event_likelihood_history, not events.status/likelihood directly, once any
// history row exists (almost immediately — see seedMissingHistory). Without this, a Signals
// edit to a tracked event's likelihood/status would change the event row but never reach the
// decision layer. Called after every write that can change the resolved level; a no-op when
// the level didn't actually move.
async function recordLikelihoodChangeIfAny(
  supabase: SupabaseClient<Database>,
  before: { status: "observed" | "possible"; likelihood: "Low" | "Medium" | "High" | null },
  after: { project_id: string; id: string; status: "observed" | "possible"; likelihood: "Low" | "Medium" | "High" | null }
): Promise<void> {
  const beforeLevel = likelihoodTextToLevel(before.status, before.likelihood);
  const afterLevel = likelihoodTextToLevel(after.status, after.likelihood);
  if (beforeLevel === afterLevel) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("event_likelihood_history").insert({
    project_id: after.project_id,
    event_id: after.id,
    level: afterLevel,
    changed_by: "user",
    changed_by_user_id: user?.id ?? null,
    cite: "Updated manually in Signals.",
  });
  if (error) throw error;
}

export async function listEventsWithLinks(projectId: string): Promise<EventWithLinks[]> {
  const supabase = createClient();
  const { data: events, error } = await supabase.from("events").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
  if (error) throw error;

  const { data: links, error: linksError } = await supabase
    .from("event_signal_links")
    .select("event_id, signal_id, side")
    .eq("project_id", projectId);
  if (linksError) throw linksError;

  const linksByEvent = new Map<string, EventLink[]>();
  for (const link of links) {
    // Pre-migration rows are backfilled side='b' in the DB itself (0038 migration) — the
    // `?? "b"` here is only a defensive fallback for a row that somehow slipped through, not
    // the primary backfill mechanism.
    const entry: EventLink = { signalId: link.signal_id, side: (link.side as "a" | "b" | null) ?? "b" };
    const existing = linksByEvent.get(link.event_id);
    if (existing) existing.push(entry);
    else linksByEvent.set(link.event_id, [entry]);
  }

  return events.map((row) => ({ ...row, links: linksByEvent.get(row.id) ?? [] }));
}

export async function createEvent(input: {
  projectId: string;
  title: string;
  description?: string;
  category?: SteepCategory | null;
  status: "observed" | "possible";
  isWildcard?: boolean;
  occurredOn?: string | null;
  windowLabel?: string | null;
  impact?: number | null;
  likelihood?: "Low" | "Medium" | "High" | null;
  precursor?: string | null;
  source?: string | null;
  createdVia?: "manual" | "news_match" | "ai" | "insight";
  // The insight this event was grounded in/derived from — set on the manual Knowledge Base
  // "+ Add to Signals" flow and on KB-derived "observed" events, read back by the Knowledge
  // Base page to show "✓ In Signals" instead of the add button.
  insightId?: string | null;
  links: EventLink[];
}): Promise<EventWithLinks> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      project_id: input.projectId,
      title: input.title,
      description: input.description ?? null,
      category: input.category ?? null,
      status: input.status,
      is_wildcard: input.isWildcard ?? false,
      occurred_on: input.occurredOn ?? null,
      window_label: input.windowLabel ?? null,
      impact: input.impact ?? null,
      likelihood: input.likelihood ?? null,
      precursor: input.precursor ?? null,
      source: input.source ?? null,
      created_via: input.createdVia ?? "manual",
      insight_id: input.insightId ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  if (input.links.length > 0) {
    const { error: linkError } = await supabase
      .from("event_signal_links")
      .insert(input.links.map((l) => ({ project_id: input.projectId, event_id: data.id, signal_id: l.signalId, side: l.side })));
    if (linkError) throw linkError;
  }

  revalidatePath("/signals");
  return { ...data, links: input.links };
}

// RLS (0003_rls.sql) only scopes to the caller's org, not this specific project — a stale
// event id from a sibling project in the same org would otherwise silently update/delete the
// wrong project's event. The explicit .eq("project_id", ...) on both the pre-fetch and the
// update (plus .select().single(), which throws when 0 rows match) is what actually enforces
// "this id belongs to this project."
export async function updateEvent(input: {
  projectId: string;
  id: string;
  title?: string;
  description?: string;
  category?: SteepCategory | null;
  status?: "observed" | "possible";
  isWildcard?: boolean;
  occurredOn?: string | null;
  windowLabel?: string | null;
  impact?: number | null;
  likelihood?: "Low" | "Medium" | "High" | null;
  precursor?: string | null;
  source?: string | null;
}): Promise<EventRow> {
  const supabase = createClient();
  const { id, projectId, isWildcard, occurredOn, windowLabel, ...rest } = input;

  const { data: before, error: beforeError } = await supabase.from("events").select("status, likelihood").eq("id", id).eq("project_id", projectId).single();
  if (beforeError) throw beforeError;

  const { data, error } = await supabase
    .from("events")
    .update({
      ...rest,
      ...(isWildcard !== undefined ? { is_wildcard: isWildcard } : {}),
      ...(occurredOn !== undefined ? { occurred_on: occurredOn } : {}),
      ...(windowLabel !== undefined ? { window_label: windowLabel } : {}),
    })
    .eq("id", id)
    .eq("project_id", projectId)
    .select()
    .single();
  if (error) throw error;

  await recordLikelihoodChangeIfAny(supabase, before, data);

  revalidatePath("/signals");
  return data;
}

export async function deleteEvent(projectId: string, id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("events").delete().eq("id", id).eq("project_id", projectId).select("id").single();
  if (error) throw error;
  revalidatePath("/signals");
}

// Signals Library v2 — the event drawer's "attach to a force"/"switch side" actions, and the
// Inbox's "Group into forces" confirm flow (both new_force and attach proposals link events).
// Upsert on (event_id, signal_id) since re-linking to the same force just changes its side.
export async function linkEvent(input: { projectId: string; eventId: string; signalId: string; side: "a" | "b" }): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("event_signal_links")
    .upsert(
      { project_id: input.projectId, event_id: input.eventId, signal_id: input.signalId, side: input.side },
      { onConflict: "event_id,signal_id" }
    );
  if (error) throw error;
  revalidatePath("/signals");
}

export async function unlinkEvent(projectId: string, eventId: string, signalId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("event_signal_links")
    .delete()
    .eq("event_id", eventId)
    .eq("signal_id", signalId)
    .eq("project_id", projectId);
  if (error) throw error;
  revalidatePath("/signals");
}

// Used by both manual editing and the news-match promotion flow (ai-news-items.ts).
export async function promoteEventToObserved(projectId: string, eventId: string, input: { occurredOn: string | null; source?: string | null }): Promise<EventRow> {
  const supabase = createClient();

  const { data: before, error: beforeError } = await supabase.from("events").select("status, likelihood").eq("id", eventId).eq("project_id", projectId).single();
  if (beforeError) throw beforeError;

  const { data, error } = await supabase
    .from("events")
    .update({
      status: "observed" as const,
      occurred_on: input.occurredOn,
      ...(input.source ? { source: input.source } : {}),
    })
    .eq("id", eventId)
    .eq("project_id", projectId)
    .select()
    .single();
  if (error) throw error;

  await recordLikelihoodChangeIfAny(supabase, before, data);

  revalidatePath("/signals");
  return data;
}
