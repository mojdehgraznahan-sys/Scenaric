"use server";

// Settings page's "Ask anything…" — a real, grounded freeform chat (ask-ai.tsx's
// context="settings" branch, ScenarioChatPanel), never the canned-reply demo. Same
// read-then-JSON-input pattern as askHomeChat (ai-home-chat.ts), scoped to the project's own
// identity fields + signals rather than the whole-project grounding Home chat uses.
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/client";
import { AIWebSearchError } from "@/lib/ai/errors";
import Anthropic from "@anthropic-ai/sdk";
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

// research:true variant — the Settings "Ask AI" freeform box's explicit "Research" send action
// (see RESEARCH_MODE_ALLOWED_STEPS's "settings.research_chat" entry in ../ai/client.ts). Only
// reachable when the user deliberately clicks "Research" instead of "Send"; never the default.
// sufficient_evidence/gap is the same escape valve ai-news-feed.ts/ai-research-suggestions.ts
// use — without it, a first observed failure mode was the model satisfying the schema with a
// placeholder ("I'll research this for you now.") and an empty webCitations array instead of
// actually invoking web_search.
const SettingsResearchChatSchema = z.object({
  sufficient_evidence: z.boolean(),
  gap: z.string().nullable(),
  answer: z.string(),
  cites: z.array(z.string()),
  inference: z.string().nullable(),
  webCitations: z.array(z.object({ title: z.string(), url: z.string() })),
});

const SETTINGS_RESEARCH_CHAT_TASK_PROMPT = `Task: The user has explicitly asked to research this
question live rather than answer only from the project's own stored data — e.g. competitive
landscape, regulatory/rules changes, geopolitical developments, tariffs, or international-market
conditions relevant to this project's industry and focal question. You MUST call the web_search
tool at least once and read real results before writing your final answer — never finalize a
response (including \`sufficient_evidence: false\`) without having actually searched first; an
acknowledgment like "I'll research this now" is never a valid final answer on its own.

Input: { question: string, project: { name: string, focal_question: string,
  refined_focal_question: string | null, horizon: string, industry: string, summary: string },
  signals: [{ id: string, title: string, category: string }] }

Rules:
- Ground the answer in what you actually find via web_search — never fabricate a statistic,
  regulation, company name, or event.
- If, after actually searching, nothing genuinely relevant turns up, return
  sufficient_evidence:false and a gap explaining what you looked for and why it came up empty —
  do not pad with generic industry commentary or an empty acknowledgment to look complete.
- \`webCitations\` lists the real title/url of each source the answer actually relied on — must
  be non-empty whenever sufficient_evidence is true.
- If you also reason beyond what you found (extrapolation, general knowledge), put that in
  \`inference\` — never inline it in \`answer\` as if it were a cited fact.
- \`cites\` lists any of this project's own signal ids the answer also relied on (empty if none).
- Keep \`answer\` under ~150 words unless the user explicitly asks for more depth.

Output schema: { sufficient_evidence: boolean, gap: string | null, answer: string,
  cites: string[], inference: string | null, webCitations: [{ title: string, url: string }] }`;

export interface SettingsChatResult {
  answer: string;
  cites: string[];
  inference: string | null;
  researched: boolean;
  webCitations: { title: string; url: string }[];
}

// POST .../projects/:id/settings/chat { question, research? }
// research:false (default, omitted) is byte-identical to the original closed-book behavior —
// same step ("settings.chat"), same prompt, no webSearch. research:true is the one explicit,
// user-invoked exception to Step 1's closed-book rule (see SCHWARTZ_METHODOLOGY_SKILL.md).
export async function askSettingsChat(input: { projectId: string; question: string; research?: boolean }): Promise<SettingsChatResult> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("name, focal_question, refined_focal_question, horizon, industry, summary")
    .eq("id", input.projectId)
    .single();
  if (projectError) throw projectError;

  const { data: signals, error: signalsError } = await supabase.from("signals").select("id, title, category").eq("project_id", input.projectId);
  if (signalsError) throw signalsError;

  if (input.research) {
    let output: z.infer<typeof SettingsResearchChatSchema>;
    try {
      output = await runStructured({
        step: "settings.research_chat",
        projectId: input.projectId,
        taskPrompt: SETTINGS_RESEARCH_CHAT_TASK_PROMPT,
        input: { question: input.question, project, signals },
        schema: SettingsResearchChatSchema,
        effort: "medium",
        webSearch: { maxUses: 5 },
        maxTokens: 6000,
      });
    } catch (err) {
      if (err instanceof Anthropic.APIError) throw new AIWebSearchError(err);
      throw err;
    }
    if (!output.sufficient_evidence) {
      return { answer: output.gap || "Couldn't find anything relevant via live search — try rephrasing.", cites: [], inference: null, researched: true, webCitations: [] };
    }
    return { answer: output.answer, cites: output.cites, inference: output.inference, researched: true, webCitations: output.webCitations };
  }

  const output = await runStructured({
    step: "settings.chat",
    projectId: input.projectId,
    taskPrompt: SETTINGS_CHAT_TASK_PROMPT,
    input: { question: input.question, project, signals },
    schema: SettingsChatSchema,
    effort: "medium",
  });

  return { answer: output.answer, cites: output.cites, inference: output.inference, researched: false, webCitations: [] };
}
