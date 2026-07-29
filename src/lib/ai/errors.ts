// Client-safe: no "server-only" import, unlike ./client.ts. Split out so components
// (e.g. ask-ai.tsx) can catch/check this error without pulling server-only code into
// the client bundle.
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
