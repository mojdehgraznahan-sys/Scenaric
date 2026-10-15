import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Scoped intentionally narrow — this repo has no test runner convention yet
// (design/2026-10-05 Phase 1 plan). Only pure-function modules under src/lib get tested;
// widen `include` if/when more of them get their own tests.
export default defineConfig({
  resolve: {
    // Mirrors tsconfig.json's "@/*" -> "./src/*" path mapping — Next's bundler resolves that
    // alias on its own, but a tested module importing another "@/..." module (e.g.
    // onboarding/validate.ts reusing lib/ai/errors.ts's ValidationError) needs Vite to resolve
    // it too, which it doesn't do by default.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/lib/**/*.test.ts"],
  },
});
