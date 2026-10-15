// Shared field groupings for AI prompts that should ground in onboarding's framing interview
// (src/lib/onboarding/interview.ts) — one place for the two subsets reused across the
// generative call sites that need them, instead of repeating the same destructuring at each one.
// Same spirit as force-writing-rules.ts's FORCE_FRAMING_RULES: a single shared snippet, not a
// per-caller copy. Returns null (not an object of nulls) when there's nothing usable, matching
// the "only ground in what's actually there" discipline already used wherever onboarding context
// is read elsewhere (e.g. ai-research-suggestions.ts's `if (!ctx.onboarding?.x) return {...}`).
import type { OnboardingAnswers } from "@/lib/actions/projects";

// Block A — what's being decided, who owns it, what breaks if it's gotten wrong. For prompts
// that generate or justify a course of action (strategy options, implications, initiatives,
// route moves).
export function decisionFraming(o: OnboardingAnswers | null): { decision: string | null; owner: string | null; stakes: string | null } | null {
  if (!o || !(o.decision || o.owner || o.stakes)) return null;
  return { decision: o.decision, owner: o.owner, stakes: o.stakes };
}

// Block C — the user's own best/worst endings and turning points. For prompts that generate or
// flesh out a scenario's world/trajectory (scenario logics, storyline, narrative).
export function bothEndings(o: OnboardingAnswers | null): { good: string | null; bad: string | null; turns: string | null } | null {
  if (!o || !(o.good || o.bad || o.turns)) return null;
  return { good: o.good, bad: o.bad, turns: o.turns };
}
