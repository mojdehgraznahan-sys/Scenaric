"use server";

// Signals Library v2 (design/handoff/2026-09-28) — the three AI calls behind the redesigned
// page's inline force-matching, "Group into forces", and per-pole "✦ Suggest". Two are
// closed-book (suggestForceForEvent, groupInboxIntoForces — reason only over the project's own
// signals/events, same discipline as ai-signals-rank.ts's critical-uncertainties prompt);
// generateForPole is research-mode allowed (Steps 2/3-style, see client.ts's
// RESEARCH_MODE_ALLOWED_STEPS) but — unlike last session's reverted generateEventsForSignal —
// only ever drafts into event_proposals, never writing a real event until the user confirms.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { runStructured } from "@/lib/ai/client";
import { AIWebSearchError, NotFoundError } from "@/lib/ai/errors";
import { createClient } from "@/lib/supabase/server";
import { createSignal } from "./signals";
import { scoreOneSignal } from "./ai-signals";
import { createEvent, linkEvent } from "./events";
import type { Database } from "@/lib/supabase/types";

export type ForceProposalRow = Database["public"]["Tables"]["force_proposals"]["Row"];
export type EventProposalRow = Database["public"]["Tables"]["event_proposals"]["Row"];

const STEEP = ["Social", "Technology", "Economic", "Ecological", "Political"] as const;

async function getProjectFocalQuestion(projectId: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.from("projects").select("focal_question, refined_focal_question").eq("id", projectId).single();
  if (error) throw error;
  return data.refined_focal_question ?? data.focal_question;
}

/* ─────────────────────────── suggestForceForEvent (closed-book) ─────────────────────────── */

const SuggestForceSchema = z.object({
  match: z.boolean(),
  signal_id: z.string().nullable(),
  side: z.enum(["a", "b"]).nullable(),
  rationale: z.string().nullable(),
});

const SUGGEST_FORCE_TASK_PROMPT = `Task: Given a draft event headline, decide whether it pulls on
one of this project's existing forces (signals) — and if so, toward which of that force's two
named poles.

Input: { focal_question: string, title: string, body: string,
         signals: [{ id, title, body, category, pole_a, pole_b }] }

Rules:
- Only match if the event genuinely bears on the SAME underlying uncertainty a signal already
  represents — do not force a match onto a semantically unrelated signal just because it shares
  a topic word.
- If it matches, \`side\` is "a" when the event pulls toward that signal's pole_a, or "b" when it
  pulls toward pole_b — pick whichever pole the event's own content moves toward.
- \`rationale\` is one short clause naming the shared thread, written to read naturally right
  after "Suggested: <force title>, toward <pole>. ..." — do not restate the force/pole names in
  it, they're already shown.
- If nothing in signals is a genuine match, set match:false and leave signal_id/side/rationale
  null — never force a weak match onto the closest-sounding signal.

Output schema:
{ match: boolean, signal_id: string | null, side: "a"|"b" | null, rationale: string | null }`;

export interface SuggestForceResult {
  signalId: string;
  side: "a" | "b";
  rationale: string;
}

export async function suggestForceForEvent(projectId: string, input: { title: string; body: string }): Promise<SuggestForceResult | null> {
  const supabase = createClient();
  const focalQuestion = await getProjectFocalQuestion(projectId);

  const { data: signals, error: signalsError } = await supabase
    .from("signals")
    .select("id, title, body, category, pole_a, pole_b")
    .eq("project_id", projectId);
  if (signalsError) throw signalsError;
  if (signals.length === 0) return null;

  const output = await runStructured({
    step: "signals.suggest_force_for_event",
    projectId,
    taskPrompt: SUGGEST_FORCE_TASK_PROMPT,
    input: {
      focal_question: focalQuestion,
      title: input.title,
      body: input.body,
      signals: signals.map((s) => ({ id: s.id, title: s.title, body: s.body, category: s.category, pole_a: s.pole_a, pole_b: s.pole_b })),
    },
    schema: SuggestForceSchema,
    effort: "low",
  });

  if (!output.match || !output.signal_id || !output.side) return null;
  return { signalId: output.signal_id, side: output.side, rationale: output.rationale ?? "" };
}

/* ─────────────────────────── groupInboxIntoForces (closed-book) ─────────────────────────── */

const GroupNewForceSchema = z.object({
  title: z.string(),
  category: z.enum(STEEP),
  pole_a: z.string(),
  pole_b: z.string(),
  member_event_ids_side_a: z.array(z.string()),
  member_event_ids_side_b: z.array(z.string()),
  rationale: z.string(),
});
const GroupAttachSchema = z.object({
  event_id: z.string(),
  signal_id: z.string(),
  side: z.enum(["a", "b"]),
  rationale: z.string(),
});
const GroupInboxSchema = z.object({
  new_forces: z.array(GroupNewForceSchema).max(5),
  attach: z.array(GroupAttachSchema).max(20),
  leftover_event_ids: z.array(z.string()),
});

const GROUP_INBOX_TASK_PROMPT = `Task: The given events have no force yet ("Inbox"). For each,
decide whether it should attach to an EXISTING force (and which pole it pulls toward), or
whether it's evidence of a genuinely NEW force this project hasn't captured — in which case
cluster it with any other inbox events describing the same underlying force.

Input: { focal_question: string,
         events: [{ id, title, body, category }],
         existing_signals: [{ id, title, body, category, pole_a, pole_b }] }

Rules:
- Prefer attaching to an existing signal when the event genuinely bears on the same underlying
  uncertainty — do not invent a new force when an existing one already covers it.
- Only propose a new force when at least one inbox event doesn't fit any existing signal. A new
  force needs a title, STEEP category, and two named poles (pole_a/pole_b) that this event (and
  any others clustered with it) plausibly pulls between — name both poles even if every member
  event currently pulls toward just one of them.
- Cluster multiple inbox events into ONE new force only when they describe the same underlying
  uncertainty, not merely the same topic area — a new force with a single member event is fine
  and expected, don't force a merge to make clusters look bigger.
- \`member_event_ids_side_a\`/\`member_event_ids_side_b\` split a new force's member event ids by
  which pole each one pulls toward.
- Every event id you were given must end up in exactly one place: an existing-signal attach, a
  new-force member list, or leftover_event_ids (if it genuinely doesn't fit anywhere yet — never
  force a placement to avoid a leftover).
- \`rationale\` in both new_forces and attach is 1-2 sentences, plain and specific — never a vibe.

Output schema:
{ new_forces: [{ title, category, pole_a, pole_b, member_event_ids_side_a: string[],
                  member_event_ids_side_b: string[], rationale }],
  attach: [{ event_id, signal_id, side: "a"|"b", rationale }],
  leftover_event_ids: string[] }`;

export interface GroupInboxResult {
  batchId: string;
  proposals: ForceProposalRow[];
  leftoverEventIds: string[];
}

export async function groupInboxIntoForces(projectId: string, eventIds: string[]): Promise<GroupInboxResult> {
  const supabase = createClient();
  const focalQuestion = await getProjectFocalQuestion(projectId);

  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, title, description, category")
    .eq("project_id", projectId)
    .in("id", eventIds);
  if (eventsError) throw eventsError;

  const { data: signals, error: signalsError } = await supabase
    .from("signals")
    .select("id, title, body, category, pole_a, pole_b")
    .eq("project_id", projectId);
  if (signalsError) throw signalsError;

  const output = await runStructured({
    step: "signals.group_inbox",
    projectId,
    taskPrompt: GROUP_INBOX_TASK_PROMPT,
    input: {
      focal_question: focalQuestion,
      events: events.map((e) => ({ id: e.id, title: e.title, body: e.description ?? "", category: e.category })),
      existing_signals: signals.map((s) => ({ id: s.id, title: s.title, body: s.body, category: s.category, pole_a: s.pole_a, pole_b: s.pole_b })),
    },
    schema: GroupInboxSchema,
    effort: "medium",
    maxTokens: 6000,
  });

  const batchId = crypto.randomUUID();
  const rows: Database["public"]["Tables"]["force_proposals"]["Insert"][] = [
    ...output.new_forces.map((f) => ({
      project_id: projectId,
      kind: "new_force" as const,
      title: f.title,
      category: f.category,
      pole_a: f.pole_a,
      pole_b: f.pole_b,
      member_links: [
        ...f.member_event_ids_side_a.map((event_id) => ({ event_id, side: "a" as const })),
        ...f.member_event_ids_side_b.map((event_id) => ({ event_id, side: "b" as const })),
      ],
      rationale: f.rationale,
      batch_id: batchId,
    })),
    ...output.attach.map((a) => ({
      project_id: projectId,
      kind: "attach" as const,
      title: events.find((e) => e.id === a.event_id)?.title ?? "",
      event_id: a.event_id,
      target_signal_id: a.signal_id,
      target_side: a.side,
      rationale: a.rationale,
      batch_id: batchId,
    })),
  ];

  if (rows.length === 0) {
    return { batchId, proposals: [], leftoverEventIds: output.leftover_event_ids };
  }

  const { data: inserted, error: insertError } = await supabase.from("force_proposals").insert(rows).select();
  if (insertError) throw insertError;

  revalidatePath("/signals");
  return { batchId, proposals: inserted, leftoverEventIds: output.leftover_event_ids };
}

export async function listForceProposals(projectId: string): Promise<ForceProposalRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("force_proposals")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "proposed")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

async function getOwnForceProposal(projectId: string, id: string): Promise<ForceProposalRow> {
  const supabase = createClient();
  const { data, error } = await supabase.from("force_proposals").select("*").eq("id", id).eq("project_id", projectId).maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError(`Force proposal ${id} could not be found in project ${projectId}.`);
  return data;
}

export interface ConfirmForceProposalResult {
  proposal: ForceProposalRow;
  createdSignalId: string | null;
}

// Idempotent re-click, same shape as confirmResearchSuggestion — awaits scoring for a new_force
// proposal so the resulting signal is never left sitting unscored.
export async function confirmForceProposal(projectId: string, id: string): Promise<ConfirmForceProposalResult> {
  const supabase = createClient();
  const proposal = await getOwnForceProposal(projectId, id);
  if (proposal.status === "confirmed") return { proposal, createdSignalId: proposal.created_signal_id };

  if (proposal.kind === "new_force") {
    const signal = await createSignal({
      projectId,
      category: proposal.category ?? "Social",
      source: "Grouped from inbox",
      title: proposal.title,
      poleA: proposal.pole_a ?? "Doesn't happen",
      poleB: proposal.pole_b ?? proposal.title,
      origin: "ai",
    });
    await scoreOneSignal(projectId, signal.id);
    for (const link of proposal.member_links) {
      await linkEvent({ projectId, eventId: link.event_id, signalId: signal.id, side: link.side });
    }
    const { data: updated, error } = await supabase
      .from("force_proposals")
      .update({ status: "confirmed", created_signal_id: signal.id })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    revalidatePath("/signals");
    return { proposal: updated, createdSignalId: signal.id };
  }

  if (!proposal.event_id || !proposal.target_signal_id || !proposal.target_side) {
    throw new Error(`Attach proposal ${id} is missing its event/target fields.`);
  }
  await linkEvent({ projectId, eventId: proposal.event_id, signalId: proposal.target_signal_id, side: proposal.target_side });
  const { data: updated, error } = await supabase.from("force_proposals").update({ status: "confirmed" }).eq("id", id).select().single();
  if (error) throw error;
  revalidatePath("/signals");
  return { proposal: updated, createdSignalId: null };
}

export async function dismissForceProposal(projectId: string, id: string): Promise<void> {
  const supabase = createClient();
  await getOwnForceProposal(projectId, id);
  const { error } = await supabase.from("force_proposals").update({ status: "dismissed" }).eq("id", id).eq("project_id", projectId);
  if (error) throw error;
  revalidatePath("/signals");
}

/* ─────────────────────────── generateForPole (research-mode allowed) ─────────────────────────── */

const GenerateForPoleSchema = z.object({
  sufficient_evidence: z.boolean(),
  gap: z.string().nullable(),
  drafts: z
    .array(
      z.object({
        title: z.string(),
        body: z.string(),
        window_label: z.string(),
        likelihood: z.enum(["Low", "Medium", "High"]),
        impact: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
        precursor: z.string(),
        citation_title: z.string(),
        citation_url: z.string(),
      })
    )
    .max(3),
});

const GENERATE_FOR_POLE_TASK_PROMPT = `Task: Draft plausible future events that would pull ONE
named force toward ONE of its two poles — grounded in real current news, geopolitics,
supply-chain, technology, or discovery trends, never fabricated wholesale.

Input: { focal_question: string, signal: { title, body, category, pole_a, pole_b },
         target_pole: string, existing_event_titles: string[] }

Rules:
- Every draft must be reasoned from a REAL, current, cited trend found via web_search — the
  future event itself is necessarily speculative, but the trend it's extrapolated from is real.
- Each draft must specifically move the force toward target_pole, not the other pole.
- \`window_label\` is a coarse future period (e.g. "Q3 2027", "2028-2029") — never a made-up
  exact date.
- \`likelihood\` is Low/Medium/High for this specific event happening in that window.
- \`precursor\` names the specific, present-day-visible early sign to watch for.
- \`impact\` is 1-5: how much this event would reshape the focal decision if it occurred.
- citation_title/citation_url must be the real title/URL found via web_search — never invented.
- Skip anything semantically the same as an existing_event_titles entry.
- If web_search turns up nothing genuinely real and relevant, return sufficient_evidence:false
  and a gap explaining why — never pad with a weak or generic draft to look complete.
- Cap at 3 drafts per call.

Output schema:
{ sufficient_evidence: boolean, gap: string | null,
  drafts: [{ title, body, window_label, likelihood: "Low"|"Medium"|"High", impact: 1-5,
             precursor, citation_title, citation_url }] }`;

export interface GenerateForPoleResult {
  sufficientEvidence: boolean;
  gap: string | null;
  proposals: EventProposalRow[];
}

export async function generateForPole(projectId: string, signalId: string, side: "a" | "b"): Promise<GenerateForPoleResult> {
  const supabase = createClient();
  const focalQuestion = await getProjectFocalQuestion(projectId);

  const { data: signal, error: signalError } = await supabase
    .from("signals")
    .select("id, title, body, category, pole_a, pole_b")
    .eq("id", signalId)
    .single();
  if (signalError) throw signalError;

  // Two-query-plus-JS-join, same convention as events.ts's listEventsWithLinks — this repo's
  // hand-written Supabase types don't model embedded-resource joins.
  const { data: linkRows, error: linksError } = await supabase.from("event_signal_links").select("event_id").eq("signal_id", signalId);
  if (linksError) throw linksError;
  let existingEventTitles: string[] = [];
  if (linkRows.length > 0) {
    const { data: linkedEvents, error: linkedEventsError } = await supabase
      .from("events")
      .select("title")
      .in(
        "id",
        linkRows.map((l) => l.event_id)
      );
    if (linkedEventsError) throw linkedEventsError;
    existingEventTitles = linkedEvents.map((e) => e.title);
  }

  const targetPole = side === "a" ? signal.pole_a ?? "Doesn't happen" : signal.pole_b ?? signal.title;

  let output: z.infer<typeof GenerateForPoleSchema>;
  try {
    output = await runStructured({
      step: "events.generate_for_pole",
      projectId,
      taskPrompt: GENERATE_FOR_POLE_TASK_PROMPT,
      input: {
        focal_question: focalQuestion,
        signal: { title: signal.title, body: signal.body, category: signal.category, pole_a: signal.pole_a, pole_b: signal.pole_b },
        target_pole: targetPole,
        existing_event_titles: existingEventTitles,
      },
      schema: GenerateForPoleSchema,
      effort: "medium",
      webSearch: { maxUses: 5 },
      maxTokens: 6000,
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) throw new AIWebSearchError(err);
    throw err;
  }

  if (!output.sufficient_evidence || output.drafts.length === 0) {
    return { sufficientEvidence: false, gap: output.gap, proposals: [] };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("event_proposals")
    .insert(
      output.drafts.map((d) => ({
        project_id: projectId,
        signal_id: signalId,
        side,
        title: d.title,
        body: d.body,
        window_label: d.window_label,
        likelihood: d.likelihood,
        impact: d.impact,
        precursor: d.precursor,
        citation_title: d.citation_title,
        citation_url: d.citation_url,
      }))
    )
    .select();
  if (insertError) throw insertError;

  return { sufficientEvidence: true, gap: null, proposals: inserted };
}

export async function listEventProposals(projectId: string): Promise<EventProposalRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("event_proposals")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "proposed")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

async function getOwnEventProposal(projectId: string, id: string): Promise<EventProposalRow> {
  const supabase = createClient();
  const { data, error } = await supabase.from("event_proposals").select("*").eq("id", id).eq("project_id", projectId).maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError(`Event proposal ${id} could not be found in project ${projectId}.`);
  return data;
}

export interface ConfirmEventProposalResult {
  proposal: EventProposalRow;
  createdEventId: string;
}

export async function confirmEventProposal(projectId: string, id: string): Promise<ConfirmEventProposalResult> {
  const supabase = createClient();
  const proposal = await getOwnEventProposal(projectId, id);
  if (proposal.status === "added" && proposal.created_event_id) {
    return { proposal, createdEventId: proposal.created_event_id };
  }

  const { data: signal, error: signalError } = await supabase.from("signals").select("category").eq("id", proposal.signal_id).single();
  if (signalError) throw signalError;

  const event = await createEvent({
    projectId,
    title: proposal.title,
    description: proposal.body ?? undefined,
    category: signal.category,
    status: "possible",
    windowLabel: proposal.window_label,
    likelihood: proposal.likelihood,
    impact: proposal.impact,
    precursor: proposal.precursor,
    source: proposal.citation_url ? `${proposal.citation_title} — ${proposal.citation_url}` : proposal.citation_title,
    createdVia: "ai",
    links: [{ signalId: proposal.signal_id, side: proposal.side }],
  });

  const { data: updated, error } = await supabase
    .from("event_proposals")
    .update({ status: "added", created_event_id: event.id })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  revalidatePath("/signals");
  return { proposal: updated, createdEventId: event.id };
}

export async function dismissEventProposal(projectId: string, id: string): Promise<void> {
  const supabase = createClient();
  await getOwnEventProposal(projectId, id);
  const { error } = await supabase.from("event_proposals").update({ status: "dismissed" }).eq("id", id).eq("project_id", projectId);
  if (error) throw error;
}
