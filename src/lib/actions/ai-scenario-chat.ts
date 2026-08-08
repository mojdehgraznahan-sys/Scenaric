"use server";

// Storyline/Narrative's own "Ask anything…" freeform chat — a scenario-scoped variant of
// askSignalsChat (ai-signals.ts), same grounded-chat convention: never fabricate an answer
// from general knowledge, always cite the real project data actually used. Sits alongside
// each page's fixed task menu (never replaces it) — see ask-ai.tsx's context: "storyline" /
// "narrative" branches, and the Build Plan §13 "Ask AI chat" spec this generalizes from
// (project-wide there; scoped to one scenario here since that's what both pages already are).
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/client";
import { StorylineScenarioNotFoundError } from "@/lib/ai/errors";
import { z } from "zod";
import { getStoryline } from "./storyline";
import { listImplications } from "./implications";
import { listIndicatorsForScenario } from "./indicators";

const ScenarioChatSchema = z.object({
  answer: z.string(),
  cites: z.array(z.string()),
});

const SCENARIO_CHAT_TASK_PROMPT = `Task: Answer the user's question about ONE scenario —
grounded strictly in that scenario's own storyline chain, narrative, implications, and
indicators already in this project. This is a scenario-scoped variant of general project
Q&A: do not reference other scenarios, other projects, or general world knowledge even if
asked — those aren't available in this chat context.

Input: { question: string, scenario: {name, tagline, summary, narrative, logic},
         storyline_nodes: [{id, phase, title, body}],
         storyline_edges: [{from, to, relationship}],
         implications: [{id, text, category}],
         indicators: [{id, name, status}] }

Rules:
- Answer ONLY using the supplied scenario data. Never invent a fact, node, event, or
  statistic not present in it.
- If the question requires information not present here (asks about a different scenario,
  a signal not in this chain, or general market/industry knowledge), say so plainly and
  name which page would supply it (e.g. "that's covered in the Signals Library" or "add
  more of the chain in Storyline first") — never answer from general knowledge as if it
  were project fact.
- Keep \`answer\` under ~120 words unless the user explicitly asks for more depth.
- \`cites\` lists the node/implication/indicator ids the answer actually relied on.

Output schema:
{ answer: string, cites: string[] }`;

export interface ScenarioChatResult {
  answer: string;
  cites: string[];
}

export async function askScenarioChat(input: { scenarioId: string; question: string }): Promise<ScenarioChatResult> {
  const supabase = createClient();

  const { data: scenario, error: scenarioError } = await supabase
    .from("scenarios")
    .select("id, project_id, name, tagline, summary, narrative, logic")
    .eq("id", input.scenarioId)
    .single();
  if (scenarioError) throw new StorylineScenarioNotFoundError(input.scenarioId, scenarioError);

  const { nodes, edges } = await getStoryline(input.scenarioId);
  const implications = await listImplications(input.scenarioId);
  const indicators = await listIndicatorsForScenario(input.scenarioId);

  const output = await runStructured({
    step: "scenario.chat",
    projectId: scenario.project_id,
    taskPrompt: SCENARIO_CHAT_TASK_PROMPT,
    input: {
      question: input.question,
      scenario: { name: scenario.name, tagline: scenario.tagline, summary: scenario.summary, narrative: scenario.narrative, logic: scenario.logic },
      storyline_nodes: nodes.map((n) => ({ id: n.id, phase: n.phase, title: n.title, body: n.body })),
      storyline_edges: edges.map((e) => ({ from: e.from_node_id, to: e.to_node_id, relationship: e.relationship })),
      implications: implications.map((imp) => ({ id: imp.id, text: imp.text, category: imp.category })),
      indicators: indicators.map((ind) => ({ id: ind.id, name: ind.name, status: ind.status })),
    },
    schema: ScenarioChatSchema,
    effort: "medium",
  });

  return { answer: output.answer, cites: output.cites };
}
