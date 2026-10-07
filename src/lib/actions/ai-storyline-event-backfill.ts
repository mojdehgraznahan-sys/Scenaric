"use server";

// One-time Storyline -> event backfill (design/2026-10-05 Phase 1 plan, Finding 3). Not a
// migration: storyline_nodes.signal_id names a force, but a force can have several events on
// either pole via event_signal_links, and a node never captured which pole/direction it meant
// server-side (ai-storyline.ts: "poles are only ever computed client-side... never persisted
// server-side") — so there's no deterministic SQL mapping from a node to one event. Solved the
// way every other fuzzy-mapping problem in this codebase already is: AI proposes, a human
// confirms what it's unsure about (same shape as force_proposals/event_proposals, 0038) —
// never a blind write. Admin-triggered (e.g. a one-off script or temporary route calling
// runStorylineEventBackfillForAllProjects), not wired into any cron — this runs once, not
// daily.
import { z } from "zod";
import { runStructured } from "@/lib/ai/client";
import { createAdminClient } from "@/lib/supabase/admin";

const BackfillSchema = z.object({
  matches: z
    .array(
      z.object({
        node_id: z.string(),
        matched_event_id: z.string().nullable(),
        confidence: z.enum(["high", "low"]),
      })
    )
    .max(200),
});

const BACKFILL_TASK_PROMPT = `Task: For each storyline node below, decide which (if any) of its
candidate events it is actually describing. Each node already names a force; its candidates are
every event linked to that same force, on either pole. Only mark confidence "high" when the
node's own title/body clearly and specifically point at one candidate — a generic restatement of
the force in general, or ambiguity between two similarly-worded candidates, must be confidence
"low" with matched_event_id null. Never invent an event id that isn't in that node's own
candidates list.

Input: { nodes: [{ id: string, title: string, body: string | null, phase: string,
           candidates: [{ event_id: string, title: string, body: string | null }] }] }

Output schema: { matches: [{ node_id: string, matched_event_id: string | null,
                              confidence: "high" | "low" }] }
Return exactly one entry per input node.`;

interface NodeForBackfill {
  id: string;
  title: string;
  body: string | null;
  phase: string;
  candidates: { eventId: string; title: string; body: string | null }[];
}

export interface StorylineEventBackfillResult {
  projectId: string;
  nodesConsidered: number;
  nodesMatched: number;
}

export async function runStorylineEventBackfillForProject(projectId: string, batchId: string): Promise<StorylineEventBackfillResult> {
  const supabase = createAdminClient();

  const { data: nodeRows, error: nodesError } = await supabase
    .from("storyline_nodes")
    .select("id, title, body, phase, signal_id")
    .eq("project_id", projectId)
    .not("signal_id", "is", null)
    .is("event_id", null);
  if (nodesError) throw nodesError;
  if (nodeRows.length === 0) return { projectId, nodesConsidered: 0, nodesMatched: 0 };

  const signalIds = Array.from(new Set(nodeRows.map((n) => n.signal_id as string)));
  const { data: signalLinks, error: linksError } = await supabase.from("event_signal_links").select("signal_id, event_id").in("signal_id", signalIds);
  if (linksError) throw linksError;
  const eventIdsBySignal = new Map<string, string[]>();
  for (const link of signalLinks) {
    const list = eventIdsBySignal.get(link.signal_id) ?? [];
    list.push(link.event_id);
    eventIdsBySignal.set(link.signal_id, list);
  }

  const allCandidateEventIds = Array.from(new Set(signalLinks.map((l) => l.event_id)));
  const { data: eventRows, error: eventsError } = allCandidateEventIds.length
    ? await supabase.from("events").select("id, title, description").in("id", allCandidateEventIds)
    : { data: [] as { id: string; title: string; description: string | null }[], error: null };
  if (eventsError) throw eventsError;
  const eventById = new Map(eventRows.map((e) => [e.id, e]));

  const nodes: NodeForBackfill[] = nodeRows
    .map((n) => {
      const candidateIds = eventIdsBySignal.get(n.signal_id as string) ?? [];
      const candidates = candidateIds.map((id) => eventById.get(id)).filter((e): e is { id: string; title: string; description: string | null } => e != null);
      return { id: n.id, title: n.title, body: n.body, phase: n.phase, candidates: candidates.map((c) => ({ eventId: c.id, title: c.title, body: c.description })) };
    })
    .filter((n) => n.candidates.length > 0); // nothing to match for a force with zero linked events

  if (nodes.length === 0) return { projectId, nodesConsidered: nodeRows.length, nodesMatched: 0 };

  const output = await runStructured({
    step: "storyline.backfill_event",
    projectId,
    taskPrompt: BACKFILL_TASK_PROMPT,
    input: { nodes: nodes.map((n) => ({ id: n.id, title: n.title, body: n.body, phase: n.phase, candidates: n.candidates.map((c) => ({ event_id: c.eventId, title: c.title, body: c.body })) })) },
    schema: BackfillSchema,
    effort: "low",
    thinking: false,
    batchId,
  });

  const candidateIdsByNode = new Map(nodes.map((n) => [n.id, new Set(n.candidates.map((c) => c.eventId))]));
  let nodesMatched = 0;
  for (const match of output.matches) {
    if (match.confidence !== "high" || !match.matched_event_id) continue;
    const validCandidates = candidateIdsByNode.get(match.node_id);
    if (!validCandidates || !validCandidates.has(match.matched_event_id)) continue; // never trust an id outside that node's own candidates
    const { error } = await supabase.from("storyline_nodes").update({ event_id: match.matched_event_id }).eq("id", match.node_id);
    if (error) throw error;
    nodesMatched += 1;
  }

  return { projectId, nodesConsidered: nodeRows.length, nodesMatched };
}

export async function runStorylineEventBackfillForAllProjects(): Promise<{ batchId: string; results: StorylineEventBackfillResult[] }> {
  const batchId = crypto.randomUUID();
  const supabase = createAdminClient();
  const { data: projects, error } = await supabase.from("projects").select("id").eq("archived", false);
  if (error) throw error;

  const results: StorylineEventBackfillResult[] = [];
  for (const project of projects) {
    results.push(await runStorylineEventBackfillForProject(project.id, batchId));
  }
  return { batchId, results };
}
