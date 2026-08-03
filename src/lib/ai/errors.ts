// Client-safe: no "server-only" import, unlike ./client.ts. Split out so components
// (e.g. ask-ai.tsx) can catch/check this error without pulling server-only code into
// the client bundle. The SDK import below is type-only, so it's erased at compile time
// and doesn't pull the real SDK into the client bundle either.
import type { APIError } from "@anthropic-ai/sdk";

export class AIGenerationFailedError extends Error {
  constructor(
    public readonly step: string,
    public readonly reason: "refusal" | "schema_validation_failed",
    public readonly attempts: number
  ) {
    super(`AI generation failed for step "${step}" after ${attempts} attempt(s): ${reason}`);
    this.name = "AIGenerationFailedError";
  }
}

// Distinguishes "couldn't load the scenario/project to generate from" (bad id, RLS, DB
// error) from AIGenerationFailedError above ("loaded fine, the model call itself failed") —
// callers (e.g. a storyline-generation route) can give a different user-facing message for
// each via instanceof.
export class StorylineScenarioNotFoundError extends Error {
  constructor(
    public readonly scenarioId: string,
    public readonly cause: unknown
  ) {
    super(`Scenario ${scenarioId} (or its project) could not be loaded.`);
    this.name = "StorylineScenarioNotFoundError";
  }
}

// Thrown by a web-search-enabled call when the failure happened at the API/transport level
// (rate limit, auth, the org's plan lacking web search access, etc.) rather than the model
// producing a bad response — distinct from AIGenerationFailedError (schema/refusal). Wraps
// the real Anthropic.APIError as `cause` so a caller needing more granularity (e.g.
// cause.status === 429 for "rate limited") still can, without this class guessing at every
// individual status code itself.
export class AIWebSearchError extends Error {
  constructor(public readonly cause: APIError) {
    super(`Web-search-enabled AI call failed: ${cause.message}`);
    this.name = "AIWebSearchError";
  }
}
