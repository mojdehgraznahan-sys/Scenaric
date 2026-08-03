// Shared error → HTTP response mapping for Route Handlers (first used by the Storyline API
// surface, src/app/api/scenarios/[id]/storyline/**). Server Actions don't need this — thrown
// errors there are Next's own problem to serialize — but a Route Handler must turn a thrown
// error into a real Response itself.
import { NextResponse } from "next/server";
import { StorylineScenarioNotFoundError, AIWebSearchError, AIGenerationFailedError } from "@/lib/ai/errors";

export interface ApiErrorBody {
  error: string;
  // Only present for AIWebSearchError — lets the client tell a rate limit (429) from a
  // permission/auth problem (403/401) without this file guessing at every status code itself.
  cause?: { status: number | undefined; type: string | null };
}

export function errorResponse(err: unknown): NextResponse<ApiErrorBody> {
  if (err instanceof StorylineScenarioNotFoundError) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
  if (err instanceof AIWebSearchError) {
    return NextResponse.json({ error: err.message, cause: { status: err.cause.status, type: err.cause.type } }, { status: 502 });
  }
  if (err instanceof AIGenerationFailedError) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
  console.error("[api] unexpected error", err);
  return NextResponse.json({ error: "Internal server error." }, { status: 500 });
}

// Same mapping, but as a plain string for embedding in a 200 response's per-half result
// (e.g. /generate, where one half failing shouldn't turn the whole response into an error
// status) rather than as the response itself.
export function describeError(err: unknown): string {
  if (err instanceof StorylineScenarioNotFoundError) return err.message;
  if (err instanceof AIWebSearchError) return err.message;
  if (err instanceof AIGenerationFailedError) return err.message;
  if (err instanceof Error) return err.message;
  console.error("[api] unexpected error", err);
  return "Internal server error.";
}
