// Pure validation for updateOnboardingAnswers (src/lib/actions/projects.ts) — kept separate and
// dependency-free so it's unit-testable without a Supabase client, same split as lib/poles.ts.
import { ValidationError } from "@/lib/ai/errors";
import { INTERVIEW } from "./interview";

export const ONBOARDING_ANSWER_IDS = new Set(INTERVIEW.flatMap((b) => b.qs.map((q) => q.id)));

const MAX_ANSWER_LENGTH = 4000;

export interface ValidatedOnboardingPatch {
  clean: Record<string, string | null>;
}

// Throws ValidationError on an unknown key (not a real question id) or a value over 4,000
// characters after trimming. Trims every value; an empty string clears that answer (-> null),
// matching projects.ts's existing blankToNull convention for this same table.
export function validateOnboardingAnswerPatch(patch: Record<string, string>): ValidatedOnboardingPatch {
  const clean: Record<string, string | null> = {};
  for (const [id, rawValue] of Object.entries(patch)) {
    if (!ONBOARDING_ANSWER_IDS.has(id)) {
      throw new ValidationError(`"${id}" is not a known onboarding answer.`);
    }
    const trimmed = (rawValue ?? "").trim();
    if (trimmed.length > MAX_ANSWER_LENGTH) {
      throw new ValidationError(`"${id}" is too long (max ${MAX_ANSWER_LENGTH} characters).`);
    }
    clean[id] = trimmed.length > 0 ? trimmed : null;
  }
  return { clean };
}
