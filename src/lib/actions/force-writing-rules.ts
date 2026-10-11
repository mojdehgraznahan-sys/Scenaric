// Shared standard for every AI call that writes a driving-force (signal) title/poles/body —
// suggestSignals (ai-signals.ts), the research-mode producers (ai-research-suggestions.ts),
// news-item promotion (ai-news-items.ts), and the Knowledge-Base-derive pipeline
// (ai-signals-derive.ts). Centralized because the same "factual trend statement" instruction
// and the same missing-poles gap had already drifted into three of those files via copy-paste
// — this is the one place the standard lives so it can't happen a fourth time.
// Server-only (not "use server") — this module exports plain utility functions alongside one
// async call, and is only ever imported by other server-action files, never called directly
// from a Client Component. A "use server" file may only export async functions.
import "server-only";
import { runStructured } from "@/lib/ai/client";
import { z } from "zod";
import type { SteepCategory } from "./signals";

// Interpolate this block into any task prompt that asks the model to name a driving force.
// Deliberately framed around what the app is actually for — mapping a CEO's future, not
// reporting what a source document already said.
export const FORCE_FRAMING_RULES = `- \`title\`: a neutral noun phrase naming what varies over the horizon — not which way it
  goes. Forward-framed: this is something that is still open, not a fact already settled.
  Never a direction verb (accelerates, deepens, surges, stalls, shifts, dominates, doubles) and
  never a year. Good: "Pace of enterprise AI adoption", "Volatility of regional currencies".
  Bad: "AI adoption accelerates" (picks a side), "2027 trade deal" (a date, not a variable).
- \`pole_a\`/\`pole_b\`: two short (2-4 word), parallel phrases naming the two genuinely distinct
  outcomes this force could resolve to. Each must read naturally as "{title}: {pole}".
- \`body\`: one sentence, starting "How…" or "Whether…", stating the forward uncertainty itself
  — not a recap of the evidence behind it.
- Do NOT reuse the wording of any single insight, quote, or source you were given. If your
  title or body could be mistaken for a rephrased sentence from the input, you have not zoomed
  out far enough — state the underlying forward-looking tension the evidence points to, never a
  summary of the evidence itself.
- A specific named actor, policy, program, law, or agency (a union, a regulator, a named
  statute) is evidence FOR a force, never a force on its own — fold it into the broader forward
  uncertainty it bears on rather than naming it as the title.`;

const DIRECTION_WORDS = ["accelerates", "deepens", "surges", "stalls", "shifts", "dominates", "doubles"];

export function isValidForceTitle(title: string, poleA: string, poleB: string): boolean {
  const lower = title.toLowerCase();
  if (DIRECTION_WORDS.some((w) => lower.includes(w))) return false;
  if (/\b(19|20)\d{2}\b/.test(title)) return false;
  if (poleA.trim().toLowerCase() === poleB.trim().toLowerCase()) return false;
  if (lower === poleA.trim().toLowerCase() || lower === poleB.trim().toLowerCase()) return false;
  return true;
}

// Catches near-verbatim copying the direction-verb/year check can't — a title or body that
// shares a long run of words with something it was supposedly only "inspired by". Deliberately
// cheap (no AI call): a shared N-word run is a strong enough signal on its own, and this runs
// in a regenerate-once loop where false positives just cost one extra model call, not a bug.
export function sharesVerbatimPhrase(candidate: string, sourceTexts: string[], minWords = 6): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const candidateWords = normalize(candidate);
  if (candidateWords.length < minWords) return false;
  const candidateGrams = new Set<string>();
  for (let i = 0; i <= candidateWords.length - minWords; i++) {
    candidateGrams.add(candidateWords.slice(i, i + minWords).join(" "));
  }
  if (candidateGrams.size === 0) return false;
  for (const source of sourceTexts) {
    const sourceWords = normalize(source);
    for (let i = 0; i <= sourceWords.length - minWords; i++) {
      if (candidateGrams.has(sourceWords.slice(i, i + minWords).join(" "))) return true;
    }
  }
  return false;
}

export function validateForceCandidate(candidate: { title: string; body?: string; poleA: string; poleB: string }, sourceTexts: string[]): boolean {
  if (!isValidForceTitle(candidate.title, candidate.poleA, candidate.poleB)) return false;
  if (sharesVerbatimPhrase(candidate.title, sourceTexts)) return false;
  if (candidate.body && sharesVerbatimPhrase(candidate.body, sourceTexts)) return false;
  return true;
}

/* ─────────────────────────── draftForcePoles ─────────────────────────── */
// The one-off case: news-item promotion creates a signal directly, with no existing AI call to
// attach real poles to (unlike suggestSignals/the research producers, which already call the
// model to draft the whole signal). Low-volume manual action — a single call, no
// regenerate-once loop.

const DraftForcePolesSchema = z.object({
  title: z.string(),
  pole_a: z.string(),
  pole_b: z.string(),
});

const DRAFT_FORCE_POLES_TASK_PROMPT = `Task: You are given a specific occurrence (a news item) that a
user is promoting into a tracked driving force. Reframe it as a forward-looking, two-sided
force — not a restatement of the occurrence itself.

Input: { title: string, body: string, category: string }

${FORCE_FRAMING_RULES}

Output schema: { title: string, pole_a: string, pole_b: string }`;

export interface DraftForcePolesResult {
  title: string;
  poleA: string;
  poleB: string;
}

export async function draftForcePoles(projectId: string, input: { title: string; body: string; category: SteepCategory }): Promise<DraftForcePolesResult> {
  const output = await runStructured({
    step: "signals.draft_force_poles",
    projectId,
    taskPrompt: DRAFT_FORCE_POLES_TASK_PROMPT,
    input,
    schema: DraftForcePolesSchema,
    effort: "low",
  });
  return { title: output.title, poleA: output.pole_a, poleB: output.pole_b };
}
