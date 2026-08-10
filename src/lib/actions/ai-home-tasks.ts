"use server";

// Home dashboard's "Ask AI" — a fixed task menu (ask-ai.tsx's context="home" branch), never
// freeform (freeform is ai-home-chat.ts, same split as every other page's own tasks/chat
// pair — see ai-monitoring-tasks.ts/ai-monitoring-chat.ts, the direct template for all four
// tasks below). Same "code computes the real numbers, AI only narrates them" discipline used
// throughout this codebase (ai-strategy-recommendation.ts, ai-monitoring-tasks.ts) — the model
// never invents a count, a tile's done/not-done state, or a route.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/client";
import { z } from "zod";
import { getProjectDashboard } from "./dashboard";
import { getNextGate, getMonitorCandidate } from "./dashboard-recommendations";
import { STEP_LABELS, STEP_GATE } from "@/lib/step-tracker";
import type { Database } from "@/lib/supabase/types";

// ─────────────────────── Task 1: What should I do next? ───────────────────────

const NextStepsSchema = z.object({ answer: z.string() });

const NEXT_STEPS_PROMPT = `Task: Write one short, conversational paragraph (2-4 sentences)
telling the user what to do next in their scenario-planning project, using ONLY the real data
given — deterministic narration of an already-decided next step, not creative brainstorming.

Input: { focal_question: string,
         next_step: { label: string, current: number | null, required: number | null } | null
           /* null means the whole 9-step methodology is already complete */,
         monitor: { kind: "alerts"|"no_indicators_yet"|"all_on_track",
           indicators_total: number, indicators_in_alert: number } }

Rules:
- If next_step is non-null, name it by its real label and cite current/required when both are
  numbers (e.g. "you have 2 of the 4 signals needed").
- If next_step is null, say the methodology itself is complete and point toward reviewing
  strategy instead.
- Briefly mention the monitor status too (e.g. indicators in alert) only if it's genuinely
  relevant right now — don't pad the answer with it otherwise.
- Never invent a step name, count, or indicator not present in the input.

Output schema: { answer: string }`;

export interface NextStepsResult {
  answer: string;
}

// POST .../projects/:id/home/ask-ai { task: "next_steps" } — reuses the exact same
// getNextGate/getMonitorCandidate candidates as POST /dashboard/recommendations (Task 1 of
// this feature), just narrated conversationally instead of as compact card copy.
export async function whatShouldIDoNext(projectId: string): Promise<NextStepsResult> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("focal_question, refined_focal_question")
    .eq("id", projectId)
    .single();
  if (projectError) throw projectError;
  const focalQuestion = project.refined_focal_question ?? project.focal_question;

  const dashboard = await getProjectDashboard(projectId);
  const [nextGate, monitor] = await Promise.all([
    getNextGate(projectId, dashboard.stepsComplete),
    getMonitorCandidate(projectId, dashboard.kpis.indicators.value),
  ]);

  const output = await runStructured({
    step: "home_ask_ai.next_steps",
    projectId,
    taskPrompt: NEXT_STEPS_PROMPT,
    input: {
      focal_question: focalQuestion,
      next_step: nextGate ? { label: nextGate.label, current: nextGate.current, required: nextGate.required } : null,
      monitor: { kind: monitor.kind, indicators_total: monitor.indicatorsTotal, indicators_in_alert: monitor.indicatorsInAlert },
    },
    schema: NextStepsSchema,
    effort: "low",
    thinking: false,
  });

  return { answer: output.answer };
}

// ─────────────────────── Task 2: Summarize this week's signals ───────────────────────

const WeekSignalsSchema = z.object({
  categories: z
    .array(
      z.object({
        index: z.number(),
        summary: z.string(),
      })
    )
    .max(5),
});

const WEEK_SIGNALS_PROMPT = `Task: For each STEEP category below, write a 1-2 sentence summary
of the real signals added this week, using ONLY their given titles/bodies — never invent a
signal or a detail not present in them.

Input: { categories: [{ index: number, category: string, signals: [{ title: string, body: string }] }] }

Rules:
- One summary per category given, referencing that category's own index.
- Ground every sentence in the actual signal titles/bodies given — no generic filler.
- Keep each summary to 1-2 sentences.

Output schema: { categories: [{ index: number, summary: string }] }`;

export interface WeekSignalCategory {
  category: "Social" | "Technology" | "Economic" | "Ecological" | "Political";
  count: number;
  summary: string;
}

export interface SummarizeWeekSignalsResult {
  totalSignals: number;
  categories: WeekSignalCategory[];
}

// POST .../projects/:id/home/ask-ai { task: "summarize_week_signals" } (default createClient(),
// cookie/session). Also reused by weekly-digest.ts's session-less cron, which passes
// createAdminClient() explicitly — the default here would silently match zero rows under RLS
// with no session to resolve current_org_id() from, not throw, same reasoning as every other
// supabaseClient-injectable action this session (pullNewsFeed, extractInsightsForProject, etc.).
export async function summarizeWeekSignals(projectId: string, supabaseClient?: SupabaseClient<Database>): Promise<SummarizeWeekSignalsResult> {
  const supabase = supabaseClient ?? createClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: signals, error } = await supabase
    .from("signals")
    .select("title, body, category")
    .eq("project_id", projectId)
    .gte("created_at", sevenDaysAgo);
  if (error) throw error;

  if (signals.length === 0) {
    return { totalSignals: 0, categories: [] };
  }

  // Deterministic grouping/counts — never AI-derived.
  const byCategory = new Map<string, { title: string; body: string }[]>();
  for (const s of signals) {
    const list = byCategory.get(s.category) ?? [];
    list.push({ title: s.title, body: s.body });
    byCategory.set(s.category, list);
  }
  const groups = Array.from(byCategory.entries()).map(([category, sigs], index) => ({ index, category, signals: sigs }));

  const output = await runStructured({
    step: "home_ask_ai.summarize_week_signals",
    projectId,
    taskPrompt: WEEK_SIGNALS_PROMPT,
    input: { categories: groups.map((g) => ({ index: g.index, category: g.category, signals: g.signals })) },
    schema: WeekSignalsSchema,
    effort: "low",
    thinking: false,
  });

  const summaryByIndex = new Map(output.categories.map((c) => [c.index, c.summary]));
  return {
    totalSignals: signals.length,
    categories: groups.map((g) => ({
      category: g.category as WeekSignalCategory["category"],
      count: g.signals.length,
      summary: summaryByIndex.get(g.index) ?? "",
    })),
  };
}

// ─────────────────────── Task 3: What's changed since I was last here? ───────────────────────

const WhatsChangedSchema = z.object({ answer: z.string() });

const WHATS_CHANGED_PROMPT = `Task: Write one short conversational paragraph (2-4 sentences)
summarizing what changed in this project since the user's last visit, using ONLY the real
counts/transitions given — never claim a change (e.g. to the matrix or strategy) that isn't
represented in the input; if a category has zero, say so plainly rather than omitting it
awkwardly.

Input: { new_signals: number, new_news_items: number,
         indicator_changes: [{ name: string, from_status: string, to_status: string }] }

Rules:
- Cite the real numbers given for new_signals and new_news_items.
- Name each indicator_changes entry by its real name and from→to transition — never invent one.
- If everything is 0/empty, say plainly that nothing changed since their last visit.

Output schema: { answer: string }`;

export interface WhatsChangedResult {
  firstVisit: boolean;
  answer: string | null;
}

// POST .../projects/:id/home/ask-ai { task: "whats_changed" }
export async function whatsChangedSinceLastVisit(projectId: string): Promise<WhatsChangedResult> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase.from("projects").select("dashboard_last_viewed_at").eq("id", projectId).single();
  if (projectError) throw projectError;

  // No historical KPI-snapshot table exists anywhere in this schema — only row-level
  // created_at/status-as-of comparisons against the last-viewed timestamp are honest here
  // (see dashboard-recommendations.ts's own comment on the same limitation).
  if (!project.dashboard_last_viewed_at) {
    return { firstVisit: true, answer: null };
  }
  const lastViewed = project.dashboard_last_viewed_at;
  const lastViewedDate = lastViewed.slice(0, 10);

  const [{ count: newSignals, error: signalsError }, { count: newNewsItems, error: newsError }] = await Promise.all([
    supabase.from("signals").select("id", { count: "exact", head: true }).eq("project_id", projectId).gt("created_at", lastViewed),
    supabase.from("news_items").select("id", { count: "exact", head: true }).eq("project_id", projectId).gt("published_at", lastViewed),
  ]);
  if (signalsError) throw signalsError;
  if (newsError) throw newsError;

  const { data: indicators, error: indicatorsError } = await supabase.from("indicators").select("id, name, status").eq("project_id", projectId);
  if (indicatorsError) throw indicatorsError;

  // Status "as of" last visit vs. live status now — one cheap query per indicator, same
  // per-indicator-reading-lookup shape ai-monitoring-tasks.ts's summarizeRecentChanges already
  // uses, just against the visit boundary instead of a fixed 7-day window.
  const indicatorChanges: { name: string; fromStatus: string; toStatus: string }[] = [];
  for (const indicator of indicators) {
    const { data: asOfReading, error: readingError } = await supabase
      .from("indicator_readings")
      .select("status_at_time")
      .eq("indicator_id", indicator.id)
      .lte("date", lastViewedDate)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (readingError) throw readingError;
    if (asOfReading && asOfReading.status_at_time !== indicator.status) {
      indicatorChanges.push({ name: indicator.name, fromStatus: asOfReading.status_at_time, toStatus: indicator.status });
    }
  }

  if ((newSignals ?? 0) === 0 && (newNewsItems ?? 0) === 0 && indicatorChanges.length === 0) {
    return { firstVisit: false, answer: "Nothing has changed in this project since your last visit." };
  }

  const output = await runStructured({
    step: "home_ask_ai.whats_changed",
    projectId,
    taskPrompt: WHATS_CHANGED_PROMPT,
    input: {
      new_signals: newSignals ?? 0,
      new_news_items: newNewsItems ?? 0,
      indicator_changes: indicatorChanges.map((c) => ({ name: c.name, from_status: c.fromStatus, to_status: c.toStatus })),
    },
    schema: WhatsChangedSchema,
    effort: "low",
    thinking: false,
  });

  return { firstVisit: false, answer: output.answer };
}

// ─────────────────────── Task 4: Explain my progress ───────────────────────

const ExplainProgressSchema = z.object({ answer: z.string() });

const EXPLAIN_PROGRESS_PROMPT = `Task: Write a short plain-language walkthrough (3-5 sentences)
of the user's methodology progress, using ONLY the real tile states and gate shortfall given —
never invent a tile, a count, or a reason not present in the input.

Input: { tiles: [{ label: string, done: boolean }],
         next_gate: { label: string, current: number | null, required: number | null } | null
           /* the SPECIFIC condition blocking the next not-done tile; null means every gate
           is already satisfied */ }

Rules:
- Mention how many of the 9 tiles are done vs. not.
- Explain WHY the next gate hasn't unlocked yet, citing next_gate's real current/required
  numbers when both are given.
- If next_gate is null, say the whole methodology is complete.
- Never invent a tile name or number not present in the input.

Output schema: { answer: string }`;

export interface ExplainProgressTile {
  label: string;
  done: boolean;
}

export interface ExplainProgressResult {
  tiles: ExplainProgressTile[];
  answer: string;
}

// POST .../projects/:id/home/ask-ai { task: "explain_progress" }
export async function explainProgress(projectId: string): Promise<ExplainProgressResult> {
  const dashboard = await getProjectDashboard(projectId);
  // Same clamp page-dashboard.tsx's own tile tracker uses — a fully-complete project can
  // return stepsComplete:9 from the RPC, but the tile array only has 8 distinct gate values.
  const stepsComplete = Math.max(0, Math.min(8, dashboard.stepsComplete));

  const tiles: ExplainProgressTile[] = STEP_LABELS.map((label, i) => ({ label, done: stepsComplete >= STEP_GATE[i] }));
  const nextGate = await getNextGate(projectId, dashboard.stepsComplete);

  const output = await runStructured({
    step: "home_ask_ai.explain_progress",
    projectId,
    taskPrompt: EXPLAIN_PROGRESS_PROMPT,
    input: {
      tiles,
      next_gate: nextGate ? { label: nextGate.label, current: nextGate.current, required: nextGate.required } : null,
    },
    schema: ExplainProgressSchema,
    effort: "low",
    thinking: false,
  });

  return { tiles, answer: output.answer };
}
