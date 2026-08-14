"use server";

// Knowledge Base's "Ask anything…" — a real, grounded freeform chat (ask-ai.tsx's
// context="knowledge" branch, ScenarioChatPanel), never the canned-reply demo. Same
// read-then-JSON-input pattern as askHomeChat (ai-home-chat.ts). Closed-book: the six fixed
// tasks in ai-knowledge-tasks.ts are this page's live-web-research surface, so this chat only
// ever answers from what's already in the knowledge base (sources/insights/interviews) — never
// attaches webSearch.
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/client";
import { z } from "zod";

const KnowledgeChatSchema = z.object({
  answer: z.string(),
  cites: z.array(z.string()),
  // Non-null only when the answer relies on anything beyond the supplied knowledge-base data —
  // same convention askHomeChat introduced.
  inference: z.string().nullable(),
});

const KNOWLEDGE_CHAT_TASK_PROMPT = `Task: Answer the user's question about this project's
Knowledge Base — what's been uploaded/researched so far, what it says, and what's still
missing — grounded strictly in the sources, insights, and interviews already in this project.

Input: { question: string, focal_question: string,
  sources: [{ id: string, name: string, type: string, status: string }],
  insights: [{ id: string, text: string, category: string | null, confidence: string | null }],
  interviews: [{ id: string, participant_name: string, tag: string | null, key_quote: string | null }] }

Rules:
- Answer ONLY using the supplied sources/insights/interviews. Never invent a source, insight,
  quote, or fact not present in them.
- If asked "what's missing" or similar, reason about gaps relative to the focal question using
  only the supplied data's coverage — don't fabricate specific missing facts you have no way of
  knowing.
- If you reason beyond the supplied data (general knowledge, extrapolation), put that reasoning
  in \`inference\` — never inline it in \`answer\` as if it were sourced from the knowledge base.
  Leave inference null when the answer is fully grounded.
- Keep \`answer\` under ~120 words unless the user explicitly asks for more depth.
- \`cites\` lists the real source/insight/interview ids the answer actually relied on (empty if
  none).

Output schema: { answer: string, cites: string[], inference: string | null }`;

export interface KnowledgeChatResult {
  answer: string;
  cites: string[];
  inference: string | null;
}

// POST .../projects/:id/knowledge/chat { question }
export async function askKnowledgeChat(input: { projectId: string; question: string }): Promise<KnowledgeChatResult> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("focal_question, refined_focal_question")
    .eq("id", input.projectId)
    .single();
  if (projectError) throw projectError;

  const [{ data: sources, error: sourcesError }, { data: insights, error: insightsError }, { data: interviews, error: interviewsError }] = await Promise.all([
    supabase.from("sources").select("id, name, type, status").eq("project_id", input.projectId),
    supabase.from("insights").select("id, text, category, confidence").eq("project_id", input.projectId),
    supabase.from("interviews").select("id, participant_name, tag, key_quote").eq("project_id", input.projectId),
  ]);
  if (sourcesError) throw sourcesError;
  if (insightsError) throw insightsError;
  if (interviewsError) throw interviewsError;

  const output = await runStructured({
    step: "knowledge.chat",
    projectId: input.projectId,
    taskPrompt: KNOWLEDGE_CHAT_TASK_PROMPT,
    input: {
      question: input.question,
      focal_question: project.refined_focal_question ?? project.focal_question,
      sources,
      insights,
      interviews,
    },
    schema: KnowledgeChatSchema,
    effort: "medium",
  });

  return { answer: output.answer, cites: output.cites, inference: output.inference };
}
