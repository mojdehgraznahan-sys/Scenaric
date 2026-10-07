import { defineConfig } from "vitest/config";

// Scoped intentionally narrow — this repo has no test runner convention yet
// (design/2026-10-05 Phase 1 plan). Only src/lib/decision-model.ts's pure roll-up math is
// tested for now; widen `include` if/when more pure-function modules get their own tests.
export default defineConfig({
  test: {
    include: ["src/lib/**/*.test.ts"],
  },
});
