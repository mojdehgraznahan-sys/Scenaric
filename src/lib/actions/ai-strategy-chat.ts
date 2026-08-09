"use server";

// Strategy page's "Ask anything…" freeform chat — a project-scoped variant of askSignalsChat's
// grounded-chat + confirm-before-save pattern (ai-signals.ts), sitting alongside the fixed task
// menu (ai-strategy-tasks.ts), never replacing it — same split as Storyline/Narrative's own
// ScenarioChatPanel + fixed task menu (ai-scenario-chat.ts + ai-storyline-tasks.ts/
// ai-narrative-tasks.ts). Grounded strictly in this project's own strategic_options/
// strategy_scenario_scores/scenarios/implications — never general external-LLM knowledge
// presented as project fact (Build Plan §13's "Ask AI chat" ground rule). Any new-option idea
// this surfaces is a `suggested_option`, never auto-persisted — the same "labeled + requires
// confirmation before it's saved into the project" contract as askSignalsChat's suggested_signal
// (see strategy.ts's createManualStrategicOption, called only after the user clicks "+ Add as
// option" in ask-ai.tsx).
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/client";
import { z } from "zod";

const StrategyChatSchema = z.object({
  answer: z.string(),
  cites: z.array(z.string()),
  suggested_option: z
    .object({
      name: z.string(),
      notes: z.string(),
      rationale: z.string(),
      grounded_in: z.array(z.string()),
      origin: z.enum(["grounded", "external_pattern"]),
    })
    .optional(),
});

const STRATEGY_CHAT_TASK_PROMPT = `Task: Answer the user's question about their strategic options —
grounded strictly in the strategic_options, strategy_scenario_scores, scenarios, and implications
already in this project. This is a project-scoped variant of general Q&A: never answer from
general market/industry knowledge as if it were project fact.

Input: { question: string, focal_question: string,
  options: [{ id: string, name: string, notes: string|null, risk: string|null, cost: string|null }],
  scores: [{ option_id: string, option_name: string, scenario_id: string, scenario_name: string,
    robust: boolean, rationale: string }],
  implications: [{ id: string, scenario_id: string, scenario_name: string, text: string, category: string|null }] }

Rules:
- Answer ONLY using the supplied options/scores/implications. Name options and scenarios exactly
  as stored. Never invent an option, scenario, score, or implication not present here.
- cites lists the option/scenario/implication ids the answer actually relied on.
- If the question requires information not present here (a different project, general industry
  trends, a scenario/option that doesn't exist), say so plainly and name which page would supply
  it — never fabricate an answer to fill the gap.
- If, and only if, the user is specifically asking for a new option or hedge idea, you may
  propose one via suggested_option — grounded_in must cite real implication ids from this input
  if the idea is traceable to one; if it's a well-established pattern not present in this
  project's own data, you may still propose it but set origin:"external_pattern", grounded_in:
  [], and say plainly in answer that this isn't from the project's own data and must be reviewed
  before it's added. Do not populate suggested_option for a plain informational question — only
  when a new option is genuinely what's being asked for.
- Keep answer under ~120 words unless the user explicitly asks for more depth.

Output schema:
{ answer: string, cites: string[],
  suggested_option?: { name: string, notes: string, rationale: string, grounded_in: string[],
    origin: "grounded"|"external_pattern" } }`;

export interface StrategyChatResult {
  answer: string;
  cites: string[];
  suggestedOption?: {
    name: string;
    notes: string;
    rationale: string;
    groundedIn: string[];
    origin: "grounded" | "external_pattern";
  };
}

export async function askStrategyChat(input: { projectId: string; question: string }): Promise<StrategyChatResult> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("focal_question, refined_focal_question")
    .eq("id", input.projectId)
    .single();
  if (projectError) throw projectError;

  const { data: options, error: optionsError } = await supabase
    .from("strategic_options")
    .select("id, name, notes, risk, cost")
    .eq("project_id", input.projectId);
  if (optionsError) throw optionsError;

  let scores: { strategy_id: string; scenario_id: string; robust: boolean; rationale: string }[] = [];
  if (options.length > 0) {
    const { data, error } = await supabase
      .from("strategy_scenario_scores")
      .select("strategy_id, scenario_id, robust, rationale")
      .in(
        "strategy_id",
        options.map((o) => o.id)
      );
    if (error) throw error;
    scores = data;
  }

  const scenarioIds = Array.from(new Set(scores.map((s) => s.scenario_id)));
  let scenarioRows: { id: string; name: string }[] = [];
  if (scenarioIds.length > 0) {
    const { data, error } = await supabase.from("scenarios").select("id, name").in("id", scenarioIds);
    if (error) throw error;
    scenarioRows = data;
  }
  const scenarioNameById = new Map(scenarioRows.map((s) => [s.id, s.name]));
  const optionNameById = new Map(options.map((o) => [o.id, o.name]));

  let implicationRows: { id: string; scenario_id: string; text: string; category: string | null }[] = [];
  if (scenarioIds.length > 0) {
    const { data, error } = await supabase.from("implications").select("id, scenario_id, text, category").in("scenario_id", scenarioIds);
    if (error) throw error;
    implicationRows = data;
  }

  const output = await runStructured({
    step: "strategy.chat",
    projectId: input.projectId,
    taskPrompt: STRATEGY_CHAT_TASK_PROMPT,
    input: {
      question: input.question,
      focal_question: project.refined_focal_question ?? project.focal_question,
      options: options.map((o) => ({ id: o.id, name: o.name, notes: o.notes, risk: o.risk, cost: o.cost })),
      scores: scores.map((s) => ({
        option_id: s.strategy_id,
        option_name: optionNameById.get(s.strategy_id) ?? s.strategy_id,
        scenario_id: s.scenario_id,
        scenario_name: scenarioNameById.get(s.scenario_id) ?? s.scenario_id,
        robust: s.robust,
        rationale: s.rationale,
      })),
      implications: implicationRows.map((imp) => ({
        id: imp.id,
        scenario_id: imp.scenario_id,
        scenario_name: scenarioNameById.get(imp.scenario_id) ?? imp.scenario_id,
        text: imp.text,
        category: imp.category,
      })),
    },
    schema: StrategyChatSchema,
    effort: "medium",
  });

  return {
    answer: output.answer,
    cites: output.cites,
    ...(output.suggested_option
      ? {
          suggestedOption: {
            name: output.suggested_option.name,
            notes: output.suggested_option.notes,
            rationale: output.suggested_option.rationale,
            groundedIn: output.suggested_option.grounded_in,
            origin: output.suggested_option.origin,
          },
        }
      : {}),
  };
}
