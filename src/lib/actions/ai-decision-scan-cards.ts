"use server";

// Drafts one action card's title/body once decision-scan.ts has already deterministically
// decided a threshold was crossed (design/2026-10-05/01-shared-decision-layer/PROMPTS.md,
// Prompt 3 step 5). Kept separate from ai-decision-scan-evaluation.ts on purpose: WHICH
// threshold fired and WHICH route move (if any) it affects are decided in code from real rows
// (decision-scan.ts), never by the model — this call only writes the explanation prose from
// facts it's handed, the same "draft text from given facts, don't decide the facts" split
// ai-strategy-recommendation.ts already uses for its rationale.
import { z } from "zod";
import { runStructured } from "@/lib/ai/client";

const ActionCardDraftSchema = z.object({
  title: z.string(),
  body: z.string(),
});

const ACTION_CARD_DRAFT_TASK_PROMPT = `Task: Write the title and body for one action card — a
short recommendation surfaced to the CEO or CSO because a specific threshold was crossed. The
trigger, evidence, target scenario, and (if any) affected route move are already decided; just
write clear, specific prose citing them.

Input: { trigger_kind: string, target_scenario_name: string | null, evidence_title: string,
         evidence_detail: string, affected_move_title: string | null,
         affected_move_new_status: string | null }

Rules:
- title: one short, imperative sentence (e.g. "Pause the Singapore single-HQ consolidation"),
  under 70 characters.
- body: 1-3 sentences. Name the evidence_title/evidence_detail as what changed, and if
  affected_move_title is given, name the specific recommended action on that move. Never
  mention a move, number, or fact that isn't in the input — this is closed-book over the given
  facts only, not a chance to invent detail.
- Never claim or imply a probability or percentage for the scenario.

Output schema: { title: string, body: string }`;

export interface ActionCardDraftInput {
  triggerKind: string;
  targetScenarioName: string | null;
  evidenceTitle: string;
  evidenceDetail: string;
  affectedMoveTitle: string | null;
  affectedMoveNewStatus: string | null;
}

export async function draftActionCard(projectId: string, input: ActionCardDraftInput, batchId: string): Promise<{ title: string; body: string }> {
  return runStructured({
    step: "decisions.draft_card",
    projectId,
    taskPrompt: ACTION_CARD_DRAFT_TASK_PROMPT,
    input: {
      trigger_kind: input.triggerKind,
      target_scenario_name: input.targetScenarioName,
      evidence_title: input.evidenceTitle,
      evidence_detail: input.evidenceDetail,
      affected_move_title: input.affectedMoveTitle,
      affected_move_new_status: input.affectedMoveNewStatus,
    },
    schema: ActionCardDraftSchema,
    effort: "low",
    thinking: false,
    batchId,
  });
}
