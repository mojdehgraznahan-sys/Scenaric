"use server";

// Settings page's "Ask anything…" — a real, grounded freeform chat (ask-ai.tsx's
// context="settings" branch, ScenarioChatPanel), never the canned-reply demo. Same
// read-then-JSON-input pattern as askHomeChat (ai-home-chat.ts), scoped to the project's own
// identity fields + signals rather than the whole-project grounding Home chat uses.
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/client";
import { z } from "zod";

const SettingsChatSchema = z.object({
  answer: z.string(),
  cites: z.array(z.string()),
  // Non-null only when the answer relies on anything beyond the supplied project data —
  // same convention askHomeChat introduced (the exact "inference" field name the global
  // SYSTEM_PREAMBLE in ai/client.ts documents).
  inference: z.string().nullable(),
});

const SETTINGS_CHAT_TASK_PROMPT = `Task: Answer the user's question about this project's own
identity/setup — its focal question, horizon, industry, and name — grounded strictly in the
project's own fields and signals already in this project. This is a narrower, settings-scoped
variant of general project Q&A: do not reference scenarios, storyline, or indicators even if
asked — those aren't available in this chat context, say so if asked about them.

Input: { question: string, project: { name: string, focal_question: string,
  refined_focal_question: string | null, horizon: string, industry: string, summary: string },
  signals: [{ id: string, title: string, category: string }] }

Rules:
- Answer ONLY using the supplied project fields and signals. Never invent a fact not present
  in them.
- If you reason beyond the supplied data (general knowledge, extrapolation), put that
  reasoning in \`inference\` — never inline it in \`answer\` as if it were sourced from the
  project's own data. Leave inference null when the answer is fully grounded.
- Keep \`answer\` under ~100 words unless the user explicitly asks for more depth.
- \`cites\` lists the real signal ids the answer actually relied on (empty if none).

Output schema: { answer: string, cites: string[], inference: string | null }`;

export interface SettingsChatResult {
  answer: string;
  cites: string[];
  inference: string | null;
}

// POST .../projects/:id/settings/chat { question }
export async function askSettingsChat(input: { projectId: string; question: string }): Promise<SettingsChatResult> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("name, focal_question, refined_focal_question, horizon, industry, summary")
    .eq("id", input.projectId)
    .single();
  if (projectError) throw projectError;

  const { data: signals, error: signalsError } = await supabase.from("signals").select("id, title, category").eq("project_id", input.projectId);
  if (signalsError) throw signalsError;

  const output = await runStructured({
    step: "settings.chat",
    projectId: input.projectId,
    taskPrompt: SETTINGS_CHAT_TASK_PROMPT,
    input: { question: input.question, project, signals },
    schema: SettingsChatSchema,
    effort: "medium",
  });

  return { answer: output.answer, cites: output.cites, inference: output.inference };
}
