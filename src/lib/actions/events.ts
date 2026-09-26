"use server";

// Signals page "Events" view — CRUD for the events/event_signal_links tables
// (0037_events.sql). Same shape/conventions as signals.ts: plain fetch, explicit
// revalidatePath, a two-query-plus-JS-join for the linked rows (mirrors listSignals'
// signal_insight_links join).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { SteepCategory } from "./signals";

export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type EventLink = { signalId: string; toward: string };
export type EventWithLinks = EventRow & { links: EventLink[] };

export async function listEventsWithLinks(projectId: string): Promise<EventWithLinks[]> {
  const supabase = createClient();
  const { data: events, error } = await supabase.from("events").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
  if (error) throw error;

  const { data: links, error: linksError } = await supabase
    .from("event_signal_links")
    .select("event_id, signal_id, toward")
    .eq("project_id", projectId);
  if (linksError) throw linksError;

  const linksByEvent = new Map<string, EventLink[]>();
  for (const link of links) {
    const entry = { signalId: link.signal_id, toward: link.toward };
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
  createdVia?: "manual" | "news_match" | "ai";
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
    })
    .select()
    .single();
  if (error) throw error;

  if (input.links.length > 0) {
    const { error: linkError } = await supabase
      .from("event_signal_links")
      .insert(input.links.map((l) => ({ project_id: input.projectId, event_id: data.id, signal_id: l.signalId, toward: l.toward })));
    if (linkError) throw linkError;
  }

  revalidatePath("/signals");
  return { ...data, links: input.links };
}

export async function updateEvent(input: {
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
  const { id, isWildcard, occurredOn, windowLabel, ...rest } = input;
  const { data, error } = await supabase
    .from("events")
    .update({
      ...rest,
      ...(isWildcard !== undefined ? { is_wildcard: isWildcard } : {}),
      ...(occurredOn !== undefined ? { occurred_on: occurredOn } : {}),
      ...(windowLabel !== undefined ? { window_label: windowLabel } : {}),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  revalidatePath("/signals");
  return data;
}

export async function deleteEvent(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/signals");
}

// Used by both manual editing and the news-match promotion flow (ai-news-items.ts).
export async function promoteEventToObserved(eventId: string, input: { occurredOn: string | null; source?: string | null }): Promise<EventRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("events")
    .update({
      status: "observed" as const,
      occurred_on: input.occurredOn,
      ...(input.source ? { source: input.source } : {}),
    })
    .eq("id", eventId)
    .select()
    .single();
  if (error) throw error;
  revalidatePath("/signals");
  return data;
}
