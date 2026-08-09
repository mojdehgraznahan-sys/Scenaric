"use server";

// Monitoring page's "Ask anything…" freeform chat — a project-scoped variant of
// askStrategyChat's grounded-chat + confirm-before-save pattern (ai-strategy-chat.ts), sitting
// alongside the fixed task menu (ai-monitoring-tasks.ts), never replacing it. Grounded strictly
// in this project's own indicators/indicator_readings/scenarios — never general external-LLM
// knowledge presented as project fact. Any new-indicator idea this surfaces is a
// `suggested_indicator`, never auto-persisted — the same "labeled + requires confirmation
// before it's saved into the project" contract as askStrategyChat's suggested_option (see
// indicators.ts's createManualIndicator, called only after the user clicks "+ Add indicator"
// in ask-ai.tsx).
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/client";
import { z } from "zod";

const MonitoringChatSchema = z.object({
  answer: z.string(),
  cites: z.array(z.string()),
  suggested_indicator: z
    .object({
      name: z.string(),
      notes: z.string(),
      scenario_id: z.string().nullable(),
      trigger_condition: z.string(),
      rationale: z.string(),
      grounded_in: z.array(z.string()),
      origin: z.enum(["grounded", "external_pattern"]),
    })
    .optional(),
});

const MONITORING_CHAT_TASK_PROMPT = `Task: Answer the user's question about their leading
indicators — grounded strictly in the indicators, their recent readings, and the scenarios
already in this project. Never answer from general market/industry knowledge as if it were
project fact.

Input: { question: string, focal_question: string,
  indicators: [{ id: string, name: string, scenario_id: string | null,
    scenario_name: string | null, status: string, trend: string | null,
    trigger_condition: string | null }],
  scenarios: [{ id: string, name: string }],
  recent_readings: [{ indicator_id: string, indicator_name: string, date: string,
    status_at_time: string, rationale: string | null }] /* up to 50 most recent, project-wide */ }

Rules:
- Answer ONLY using the supplied indicators/readings/scenarios. Name indicators and scenarios
  exactly as stored. Never invent an indicator, scenario, reading, or news item not present here.
- cites lists the indicator/scenario ids the answer actually relied on.
- If the question requires information not present here (a different project, general industry
  trends, an indicator that doesn't exist), say so plainly and name which page would supply it —
  never fabricate an answer to fill the gap.
- If, and only if, the user is specifically asking for a new indicator idea, you may propose one
  via suggested_indicator — grounded_in must cite real indicator ids from this input if the idea
  is traceable to one of them; if it's a well-established pattern not present in this project's
  own data, you may still propose it but set origin:"external_pattern", grounded_in: [], and say
  plainly in answer that this isn't from the project's own data and must be reviewed before it's
  added. scenario_id must be a real id from scenarios, or null if it doesn't fit one specific
  scenario. Do not populate suggested_indicator for a plain informational question — only when a
  new indicator is genuinely what's being asked for.
- Keep answer under ~120 words unless the user explicitly asks for more depth.

Output schema:
{ answer: string, cites: string[],
  suggested_indicator?: { name: string, notes: string, scenario_id: string | null,
    trigger_condition: string, rationale: string, grounded_in: string[],
    origin: "grounded"|"external_pattern" } }`;

export interface MonitoringChatResult {
  answer: string;
  cites: string[];
  suggestedIndicator?: {
    name: string;
    notes: string;
    scenarioId: string | null;
    scenarioName: string | null;
    triggerCondition: string;
    rationale: string;
    groundedIn: string[];
    origin: "grounded" | "external_pattern";
  };
}

export async function askMonitoringChat(input: { projectId: string; question: string }): Promise<MonitoringChatResult> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("focal_question, refined_focal_question")
    .eq("id", input.projectId)
    .single();
  if (projectError) throw projectError;

  const { data: indicators, error: indicatorsError } = await supabase
    .from("indicators")
    .select("id, scenario_id, name, status, trend, trigger_condition")
    .eq("project_id", input.projectId);
  if (indicatorsError) throw indicatorsError;

  const scenarioIds = Array.from(new Set(indicators.map((i) => i.scenario_id).filter((id): id is string => id != null)));
  let scenarioRows: { id: string; name: string }[] = [];
  if (scenarioIds.length > 0) {
    const { data, error } = await supabase.from("scenarios").select("id, name").in("id", scenarioIds);
    if (error) throw error;
    scenarioRows = data;
  }
  const scenarioNameById = new Map(scenarioRows.map((s) => [s.id, s.name]));

  let recentReadings: { indicator_id: string; indicator_name: string; date: string; status_at_time: string; rationale: string | null }[] = [];
  if (indicators.length > 0) {
    const nameById = new Map(indicators.map((i) => [i.id, i.name]));
    const { data, error } = await supabase
      .from("indicator_readings")
      .select("indicator_id, date, status_at_time, rationale")
      .in(
        "indicator_id",
        indicators.map((i) => i.id)
      )
      .order("date", { ascending: false })
      .limit(50);
    if (error) throw error;
    recentReadings = data.map((r) => ({
      indicator_id: r.indicator_id,
      indicator_name: nameById.get(r.indicator_id) ?? r.indicator_id,
      date: r.date,
      status_at_time: r.status_at_time,
      rationale: r.rationale,
    }));
  }

  const output = await runStructured({
    step: "monitoring.chat",
    projectId: input.projectId,
    taskPrompt: MONITORING_CHAT_TASK_PROMPT,
    input: {
      question: input.question,
      focal_question: project.refined_focal_question ?? project.focal_question,
      indicators: indicators.map((i) => ({
        id: i.id,
        name: i.name,
        scenario_id: i.scenario_id,
        scenario_name: i.scenario_id ? (scenarioNameById.get(i.scenario_id) ?? null) : null,
        status: i.status,
        trend: i.trend,
        trigger_condition: i.trigger_condition,
      })),
      scenarios: scenarioRows,
      recent_readings: recentReadings,
    },
    schema: MonitoringChatSchema,
    effort: "medium",
  });

  const validScenarioIds = new Set(scenarioRows.map((s) => s.id));
  const validIndicatorIds = new Set(indicators.map((i) => i.id));

  let suggestedIndicator: MonitoringChatResult["suggestedIndicator"];
  if (output.suggested_indicator) {
    const s = output.suggested_indicator;
    const scenarioId = s.scenario_id && validScenarioIds.has(s.scenario_id) ? s.scenario_id : null;
    suggestedIndicator = {
      name: s.name,
      notes: s.notes,
      scenarioId,
      scenarioName: scenarioId ? (scenarioNameById.get(scenarioId) ?? null) : null,
      triggerCondition: s.trigger_condition,
      rationale: s.rationale,
      groundedIn: s.grounded_in.filter((id) => validIndicatorIds.has(id)),
      origin: s.origin,
    };
  }

  return { answer: output.answer, cites: output.cites, suggestedIndicator };
}
