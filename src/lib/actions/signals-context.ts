"use server";

// Shared context snapshot for the Signals page's "Ask AI" prompts (SIGNALS_ASK_AI_PROMPTS.md,
// its "Context assembly" note) — every Find/Sharpen/Rank/Test prompt reads from this instead of
// each re-querying projects/signals ad hoc the way suggestSignals/askSignalsChat/
// runMacroTrendSweep etc. already did before this file existed.
import { createClient } from "@/lib/supabase/server";
import { getOnboardingAnswers, type OnboardingAnswers } from "./projects";
import type { SteepCategory } from "./signals";

export type { OnboardingAnswers };

const STEEP_CATEGORIES: SteepCategory[] = ["Social", "Technology", "Economic", "Ecological", "Political"];

// Keeps prompt payloads bounded — full source text isn't needed for these prompts, just
// enough to reason about the signal (spec's "truncate signal bodies" instruction).
const BODY_TRUNCATE_LENGTH = 240;

export interface SignalsContextSignal {
  id: string;
  title: string;
  body: string;
  category: SteepCategory;
  impact: number | null;
  uncertainty: "Low" | "Medium" | "High" | null;
}

export interface SignalsContext {
  projectId: string;
  focalQuestion: string;
  horizon: string;
  industry: string;
  /** onboarding.companyName ?? projects.name — see 0034_onboarding_answers.sql's header note
   *  on why there's no dedicated company-name column. */
  company: string | null;
  /** null only for projects created before Phase 0 shipped (no onboarding_answers row). */
  onboarding: OnboardingAnswers | null;
  signals: SignalsContextSignal[];
  categoryDistribution: Record<SteepCategory, number>;
  existingSignalTitles: string[];
}

export async function buildSignalsContext(projectId: string): Promise<SignalsContext> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("name, focal_question, refined_focal_question, horizon, industry")
    .eq("id", projectId)
    .single();
  if (projectError) throw projectError;

  const { data: signalRows, error: signalsError } = await supabase
    .from("signals")
    .select("id, title, body, category, impact, uncertainty")
    .eq("project_id", projectId);
  if (signalsError) throw signalsError;

  const onboarding = await getOnboardingAnswers(projectId);

  const signals: SignalsContextSignal[] = signalRows.map((s) => ({
    id: s.id,
    title: s.title,
    body: s.body.length > BODY_TRUNCATE_LENGTH ? `${s.body.slice(0, BODY_TRUNCATE_LENGTH)}…` : s.body,
    category: s.category,
    impact: s.impact,
    uncertainty: s.uncertainty,
  }));

  const categoryDistribution = STEEP_CATEGORIES.reduce(
    (acc, cat) => {
      acc[cat] = 0;
      return acc;
    },
    {} as Record<SteepCategory, number>
  );
  for (const s of signals) categoryDistribution[s.category] += 1;

  return {
    projectId,
    focalQuestion: project.refined_focal_question ?? project.focal_question,
    horizon: project.horizon,
    industry: project.industry,
    company: onboarding?.companyName ?? project.name,
    onboarding,
    signals,
    categoryDistribution,
    existingSignalTitles: signals.map((s) => s.title),
  };
}
