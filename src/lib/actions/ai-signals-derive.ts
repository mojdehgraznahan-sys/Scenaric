"use server";

// Knowledge Base -> Signals (design/06-kb-to-signals): groups a project's own insights into
// driving forces, then drafts events for each one, so a user who's uploaded sources doesn't
// land on a blank Signals page. Same closed-book, "never invent, only organize what's given"
// discipline as ai-forces.ts's groupInboxIntoForces/generateForPole — and, like those, this
// stages into force_proposals/event_proposals rather than writing signals/events directly.
// See 0044_research_suggestions_grounded_signals.sql's comment: an earlier version of this
// exact shape (ai-signals.ts's suggestSignals) wrote straight into signals+signal_insight_links
// with no review step, and was moved to a staged+confirm flow specifically because that
// violated the "never auto-insert research findings" rule enforced everywhere else.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runStructured } from "@/lib/ai/client";
import { createClient } from "@/lib/supabase/server";
import { getOnboardingAnswers } from "./projects";
import { FORCE_FRAMING_RULES, sharesVerbatimPhrase, validateForceCandidate } from "./force-writing-rules";
import { PERSONA_MACRO_SCOUT, PERSONA_EVIDENCE_DRAFTER } from "@/lib/ai/personas";

const STEEP = ["Social", "Technology", "Economic", "Ecological", "Political"] as const;

// Deliberately NOT imported from ai-forces.ts — that file imports deriveEventsForForce from
// this one (confirmForceProposal calls it once a KB-derived force is confirmed), so importing
// back from there would create a circular module dependency between the two action files.
async function getProjectFocalQuestion(projectId: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.from("projects").select("focal_question, refined_focal_question").eq("id", projectId).single();
  if (error) throw error;
  return data.refined_focal_question ?? data.focal_question;
}

/* ─────────────────────────── deriveForcesFromInsights ─────────────────────────── */

const DeriveForcesSchema = z.object({
  forces: z
    .array(
      z.object({
        title: z.string(),
        pole_a: z.string(),
        pole_b: z.string(),
        body: z.string(),
        category: z.enum(STEEP),
        impact: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
        uncertainty: z.enum(["Low", "Medium", "High"]),
        from_insight_ids: z.array(z.string()).min(1),
        rationale: z.string(),
      })
    )
    .max(9),
  attach_to_existing: z.array(z.object({ signal_id: z.string(), insight_ids: z.array(z.string()) })),
  unused_insight_ids: z.array(z.string()),
});

const DERIVE_FORCES_TASK_PROMPT = `${PERSONA_MACRO_SCOUT}

Task: You are helping a CEO map how their business could play
out over the next {horizon} in {industry}, for the decision: {focal} — not summarizing their
Knowledge Base back to them. Below are insights extracted from their own documents, interviews,
surveys and web sources. Group them into driving forces: forward-looking uncertainties that
matter to this decision and could go two different ways over the horizon. The insights are
your evidence for inferring each force — they are never the force itself.

Input: { focal_question, horizon, industry, onboarding: { awake, decision, given, open, actors },
         insights: [{ id, category, text, confidence, source_name }],
         existing_signals: [{ id, title, body, category }] }

For each force, return:
${FORCE_FRAMING_RULES}
- impact 1-5: how much the force would change the decision, not how important it is to the
  industry.
- uncertainty: Low, Medium or High over the horizon.
- from_insight_ids: the ids of the insights that support it. At least one.
- rationale: one sentence on why these insights belong together.

Rules:
- Use only the insights given. Do not invent forces with no supporting insight.
- Don't create a force that duplicates an existing one (check meaning, not wording) — instead
  return it under attach_to_existing: [{ signal_id, insight_ids }].
- Return 4 to 9 forces total (new + attached). List insights that fit nowhere in
  unused_insight_ids.

Output schema:
{ forces: [{ title, pole_a, pole_b, body, category, impact, uncertainty, from_insight_ids,
             rationale }],
  attach_to_existing: [{ signal_id, insight_ids }], unused_insight_ids: [string] }`;

export interface DeriveForcesResult {
  proposalBatchId: string;
  proposalCount: number;
}

export async function deriveForcesFromInsights(projectId: string): Promise<DeriveForcesResult> {
  const supabase = createClient();
  const focalQuestion = await getProjectFocalQuestion(projectId);

  const { data: project, error: projectError } = await supabase.from("projects").select("horizon, industry").eq("id", projectId).single();
  if (projectError) throw projectError;

  const onboarding = await getOnboardingAnswers(projectId);

  const { data: insights, error: insightsError } = await supabase
    .from("insights")
    .select("id, category, text, confidence, source_id")
    .eq("project_id", projectId);
  if (insightsError) throw insightsError;
  if (insights.length === 0) {
    return { proposalBatchId: "", proposalCount: 0 };
  }

  const sourceIds = Array.from(new Set(insights.map((i) => i.source_id).filter((id): id is string => id != null)));
  const sourceNameById = new Map<string, string>();
  if (sourceIds.length > 0) {
    const { data: sources, error: sourcesError } = await supabase.from("sources").select("id, name").in("id", sourceIds);
    if (sourcesError) throw sourcesError;
    for (const s of sources) sourceNameById.set(s.id, s.name);
  }

  const { data: signals, error: signalsError } = await supabase.from("signals").select("id, title, body, category").eq("project_id", projectId);
  if (signalsError) throw signalsError;

  const runOnce = () =>
    runStructured({
      step: "signals.derive.forces",
      projectId,
      taskPrompt: DERIVE_FORCES_TASK_PROMPT,
      input: {
        focal_question: focalQuestion,
        horizon: project.horizon,
        industry: project.industry,
        onboarding: onboarding
          ? { awake: onboarding.awake, decision: onboarding.decision, given: onboarding.given, open: onboarding.open, actors: onboarding.actors }
          : null,
        insights: insights.map((i) => ({
          id: i.id,
          category: i.category,
          text: i.text,
          confidence: i.confidence,
          source_name: i.source_id ? sourceNameById.get(i.source_id) ?? null : null,
        })),
        existing_signals: signals.map((s) => ({ id: s.id, title: s.title, body: s.body, category: s.category })),
      },
      schema: DeriveForcesSchema,
      effort: "medium",
      maxTokens: 6000,
    });

  let output = await runOnce();
  const insightIds = new Set(insights.map((i) => i.id));
  const signalIds = new Set(signals.map((s) => s.id));
  const insightTextById = new Map(insights.map((i) => [i.id, i.text]));

  // Checks the force against its OWN grounding insights' text — not just a direction-verb/year
  // filter, but the "did you just restate the Knowledge Base" check this fix exists for.
  const isValidForce = (f: z.infer<typeof DeriveForcesSchema>["forces"][number]) =>
    f.from_insight_ids.every((id) => insightIds.has(id)) &&
    validateForceCandidate({ title: f.title, body: f.body, poleA: f.pole_a, poleB: f.pole_b }, f.from_insight_ids.map((id) => insightTextById.get(id) ?? ""));

  const validate = (o: z.infer<typeof DeriveForcesSchema>) =>
    o.forces.every(isValidForce) && o.attach_to_existing.every((a) => signalIds.has(a.signal_id) && a.insight_ids.every((id) => insightIds.has(id)));

  if (!validate(output)) {
    output = await runOnce();
    // Drop anything still invalid on the second attempt rather than failing the whole run —
    // partial, correct results beat none.
    output = {
      ...output,
      forces: output.forces.filter(isValidForce),
      attach_to_existing: output.attach_to_existing.filter((a) => signalIds.has(a.signal_id) && a.insight_ids.every((id) => insightIds.has(id))),
    };
  }

  // attach_to_existing adds grounding metadata to an already-reviewed signal — no new visible
  // content, so this writes directly rather than through a proposal (see ai-signals-derive.ts's
  // header comment / the plan's Context section for why that line is drawn here).
  for (const a of output.attach_to_existing) {
    if (a.insight_ids.length === 0) continue;
    const { error } = await supabase
      .from("signal_insight_links")
      .upsert(a.insight_ids.map((insight_id) => ({ project_id: projectId, signal_id: a.signal_id, insight_id })), { onConflict: "signal_id,insight_id" });
    if (error) console.error("[signals-derive] failed to attach insights to existing signal", a.signal_id, error);
  }

  if (output.forces.length === 0) {
    return { proposalBatchId: "", proposalCount: 0 };
  }

  const batchId = crypto.randomUUID();
  const rows = output.forces.map((f) => ({
    project_id: projectId,
    kind: "new_force" as const,
    title: f.title,
    category: f.category,
    pole_a: f.pole_a,
    pole_b: f.pole_b,
    member_links: [],
    rationale: f.rationale,
    batch_id: batchId,
    grounded_insight_ids: f.from_insight_ids,
  }));

  const { data: inserted, error: insertError } = await supabase.from("force_proposals").insert(rows).select();
  if (insertError) throw insertError;

  revalidatePath("/signals");
  return { proposalBatchId: batchId, proposalCount: inserted.length };
}

/* ─────────────────────────── deriveEventsForForce ─────────────────────────── */

const DeriveEventsSchema = z.object({
  events: z
    .array(
      z.object({
        title: z.string(),
        status: z.enum(["observed", "possible"]),
        side: z.enum(["a", "b"]),
        from_insight_id: z.string().nullable(),
        occurred_on: z.string().nullable(),
        window_label: z.string().nullable(),
        likelihood: z.enum(["Low", "Medium", "High"]).nullable(),
        impact: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
        wildcard: z.boolean(),
        precursor: z.string().nullable(),
      })
    )
    .max(4),
});

const DERIVE_EVENTS_TASK_PROMPT = `${PERSONA_EVIDENCE_DRAFTER}

Task: You are helping a CEO see how this one force could play
out — the point is what happens NEXT, not a recap of what your evidence already says. An event
is ONE occurrence: who did what, where, and when. Someone reading the news must be able to say
"that happened" or "it hasn't happened yet".

Input: { focal_question, force: { title, pole_a, pole_b, body },
         insights: [{ id, text, source_name }] /* only insights this force is grounded in */,
         existing_event_titles: string[],
         sibling_forces: [{title, pole_a, pole_b, category}] /* the rest of this project's force
         landscape — context only, so you don't draft an event that actually belongs to a
         different force's territory; every event you name must still pull on THIS force alone */ }

Two kinds — weight toward (2): this tool is for mapping the future, not logging the past.

1. Observed (grounded in the Knowledge Base) — the minority of events, not the default. Only
   turn an insight into an observed event if it marks a genuine, discrete inflection point for
   this force — not routine supporting detail every grounding insight happens to contain. Write
   the title as a headline naming what happened, in your own words — never a reworded restatement
   of the insight's own sentence or numbers. Full sentence, actor + verb, past or present tense,
   18 words or fewer. Set status:"observed", from_insight_id to that insight's id, occurred_on to
   a real or approximate date if implied (else null), side to whichever pole it pulls toward.
   Skip insights that are opinion with no occurrence behind them, and skip any that don't meet
   this bar — it is fine to return zero observed events for a thin or routine insight set.
2. Possible (inferred) — at least 2 of these, covering both poles. This is the real point: given
   the pattern these insights point to, name the next concrete, dated thing a CEO would see
   happen if this pole continues — a filing, a contract award, a departure, a product launch, a
   policy change, a competitor move. It must be a genuinely new occurrence that has not happened
   yet, never a restatement of present evidence. Title: specific actor + action, 18 words or
   fewer, no hedging words ("may", "could", "increasingly"). Set status:"possible",
   from_insight_id: null, window_label to a coarse future period, likelihood (Low/Medium/High),
   impact 1-5.

Rules:
- At most 4 events per force in total, across both kinds; at least 2 must be "possible".
- No trends ("rising pressure on…"), and no restating the force.
- Don't duplicate an existing event, even if worded differently.
- Flag anything that would break the whole scenario frame as wildcard:true, with a precursor.

Output schema:
{ events: [{ title, status: "observed"|"possible", side: "a"|"b", from_insight_id: string|null,
             occurred_on: string|null, window_label: string|null,
             likelihood: "Low"|"Medium"|"High"|null, impact: 1-5, wildcard: boolean,
             precursor: string|null }] }`;

const HEDGE_WORDS = ["may", "could", "might", "increasingly", "trend"];

function isValidEventTitle(title: string): boolean {
  const words = title.trim().split(/\s+/);
  if (words.length === 0 || words.length > 18) return false;
  const lower = title.toLowerCase();
  if (HEDGE_WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(lower))) return false;
  // Crude subject+verb check: at least two words, one of them not purely punctuation.
  return words.length >= 2;
}

export interface DeriveEventsResult {
  proposalCount: number;
}

export async function deriveEventsForForce(projectId: string, signalId: string, insightIds: string[]): Promise<DeriveEventsResult> {
  const supabase = createClient();
  if (insightIds.length === 0) return { proposalCount: 0 };

  const focalQuestion = await getProjectFocalQuestion(projectId);

  const { data: signal, error: signalError } = await supabase.from("signals").select("title, body, pole_a, pole_b").eq("id", signalId).single();
  if (signalError) throw signalError;

  const { data: insights, error: insightsError } = await supabase
    .from("insights")
    .select("id, text, source_id")
    .in("id", insightIds);
  if (insightsError) throw insightsError;

  const sourceIds = Array.from(new Set(insights.map((i) => i.source_id).filter((id): id is string => id != null)));
  const sourceNameById = new Map<string, string>();
  if (sourceIds.length > 0) {
    const { data: sources, error: sourcesError } = await supabase.from("sources").select("id, name").in("id", sourceIds);
    if (sourcesError) throw sourcesError;
    for (const s of sources) sourceNameById.set(s.id, s.name);
  }

  const { data: linkRows, error: linksError } = await supabase.from("event_signal_links").select("event_id").eq("signal_id", signalId);
  if (linksError) throw linksError;
  let existingEventTitles: string[] = [];
  if (linkRows.length > 0) {
    const { data: linkedEvents, error: linkedEventsError } = await supabase
      .from("events")
      .select("title")
      .in("id", linkRows.map((l) => l.event_id));
    if (linkedEventsError) throw linkedEventsError;
    existingEventTitles = linkedEvents.map((e) => e.title);
  }

  // Context only — the rest of this project's force landscape, so drafts aren't written in
  // total isolation from sibling forces (unlike deriveForcesFromInsights one level up, which is
  // already project-wide). No quadrant join here — this runs right after a KB force is
  // confirmed, typically before any matrix placement exists yet.
  const { data: siblingSignals, error: siblingSignalsError } = await supabase
    .from("signals")
    .select("title, pole_a, pole_b, category")
    .eq("project_id", projectId)
    .neq("id", signalId);
  if (siblingSignalsError) throw siblingSignalsError;

  const runOnce = () =>
    runStructured({
      step: "signals.derive.events",
      projectId,
      taskPrompt: DERIVE_EVENTS_TASK_PROMPT,
      input: {
        focal_question: focalQuestion,
        force: { title: signal.title, pole_a: signal.pole_a, pole_b: signal.pole_b, body: signal.body },
        insights: insights.map((i) => ({ id: i.id, text: i.text, source_name: i.source_id ? sourceNameById.get(i.source_id) ?? null : null })),
        existing_event_titles: existingEventTitles,
        sibling_forces: siblingSignals,
      },
      schema: DeriveEventsSchema,
      effort: "medium",
      maxTokens: 4096,
    });

  const insightTextIds = new Set(insights.map((i) => i.id));
  const insightTexts = insights.map((i) => i.text);
  // A possible event overlapping an insight's own wording is never legitimate (it hasn't
  // happened — there's nothing to quote); an observed event overlapping is the "restated the
  // Knowledge Base instead of naming what happened" failure this prompt is written against.
  const isValidEvent = (e: z.infer<typeof DeriveEventsSchema>["events"][number]) =>
    isValidEventTitle(e.title) && (e.from_insight_id === null || insightTextIds.has(e.from_insight_id)) && !sharesVerbatimPhrase(e.title, insightTexts);

  let output = await runOnce();
  let valid = output.events.filter(isValidEvent);
  if (valid.length < output.events.length) {
    output = await runOnce();
    valid = output.events.filter(isValidEvent);
  }

  if (valid.length === 0) return { proposalCount: 0 };

  const rows = valid.map((e) => ({
    project_id: projectId,
    signal_id: signalId,
    side: e.side,
    title: e.title,
    body: null,
    window_label: e.status === "possible" ? e.window_label : null,
    likelihood: e.status === "possible" ? e.likelihood : null,
    impact: e.impact,
    precursor: e.precursor,
    citation_title: e.from_insight_id ? sourceNameById.get(insights.find((i) => i.id === e.from_insight_id)?.source_id ?? "") ?? null : null,
    citation_url: null,
    event_status: e.status,
    occurred_on: e.status === "observed" ? e.occurred_on : null,
    insight_id: e.from_insight_id,
    wildcard: e.wildcard,
  }));

  const { error: insertError } = await supabase.from("event_proposals").insert(rows);
  if (insertError) throw insertError;

  revalidatePath("/signals");
  return { proposalCount: rows.length };
}
