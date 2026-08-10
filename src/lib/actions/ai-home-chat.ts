"use server";

// Home dashboard's "Ask anything…" — a real, grounded freeform chat (ask-ai.tsx's
// context="home" branch, ScenarioChatPanel), never the canned-reply demo. Same
// read-then-JSON-input pattern as askSignalsChat (ai-signals.ts) / askMonitoringChat
// (ai-monitoring-chat.ts), just grounded across all four project entities at once
// (signals/scenarios/indicators/news) rather than one page's own single entity type.
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/client";
import { z } from "zod";

const HomeChatSchema = z.object({
  answer: z.string(),
  cites: z.array(z.string()),
  // Non-null only when the answer relies on anything beyond the supplied project data
  // (general knowledge, extrapolation) — the exact "inference" field name the global
  // SYSTEM_PREAMBLE (ai/client.ts) already documents for this purpose.
  inference: z.string().nullable(),
});

const HOME_CHAT_TASK_PROMPT = `Task: Answer the user's question about their scenario-planning
project as a whole — grounded strictly in the signals, scenarios, indicators, and news items
already in this project. This is a project-wide variant of the other pages' own scoped chats
(Signals/Monitoring/Strategy); answer broadly across all four entity types as relevant to the
question.

Input: { question: string, focal_question: string,
         signals: [{id, title, category, impact, uncertainty}],
         scenarios: [{id, name, tagline}],
         indicators: [{id, name, status}],
         news_items: [{id, title, summary, impact}] }

Rules:
- Answer ONLY using the supplied data. Never invent a signal, scenario, indicator, news item,
  statistic, or fact not traceable to one of them.
- If you reason beyond the supplied data (general knowledge, extrapolation, an inference not
  directly stated in any item), put that reasoning in \`inference\` — never inline it in
  \`answer\` as if it were sourced from the project's own data. Leave inference null when the
  answer is fully grounded.
- If the question has no supporting evidence in the given data, say so plainly rather than
  fabricating an answer.
- Keep \`answer\` under ~120 words unless the user explicitly asks for more depth.
- \`cites\` lists the real ids (from signals/scenarios/indicators/news_items) the answer
  actually relied on.

Output schema: { answer: string, cites: string[], inference: string | null }`;

export interface HomeChatResult {
  answer: string;
  cites: string[];
  inference: string | null;
}

// POST .../projects/:id/home/chat { question }
export async function askHomeChat(input: { projectId: string; question: string }): Promise<HomeChatResult> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("focal_question, refined_focal_question")
    .eq("id", input.projectId)
    .single();
  if (projectError) throw projectError;
  const focalQuestion = project.refined_focal_question ?? project.focal_question;

  const [{ data: signals, error: signalsError }, { data: scenarios, error: scenariosError }, { data: indicators, error: indicatorsError }, { data: newsItems, error: newsError }] =
    await Promise.all([
      supabase.from("signals").select("id, title, category, impact, uncertainty").eq("project_id", input.projectId),
      supabase.from("scenarios").select("id, name, tagline").eq("project_id", input.projectId).eq("is_archived", false),
      supabase.from("indicators").select("id, name, status").eq("project_id", input.projectId),
      supabase.from("news_items").select("id, title, summary, impact").eq("project_id", input.projectId).order("published_at", { ascending: false }).limit(20),
    ]);
  if (signalsError) throw signalsError;
  if (scenariosError) throw scenariosError;
  if (indicatorsError) throw indicatorsError;
  if (newsError) throw newsError;

  const output = await runStructured({
    step: "home.chat",
    projectId: input.projectId,
    taskPrompt: HOME_CHAT_TASK_PROMPT,
    input: {
      question: input.question,
      focal_question: focalQuestion,
      signals,
      scenarios,
      indicators,
      news_items: newsItems,
    },
    schema: HomeChatSchema,
    effort: "medium",
  });

  return { answer: output.answer, cites: output.cites, inference: output.inference };
}
