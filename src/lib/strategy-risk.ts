// Risk is a byproduct of real robust-count data, never a raw model guess (§0 Principle 5) —
// shared by ai-strategy.ts's option scoring and ai-strategy-tasks.ts's stressTestOption, which
// must re-derive an option's risk the exact same way after a stress test flips a score, not
// with a second, possibly-diverging rubric. Lives outside src/lib/actions/*.ts because every
// file there is "use server", and Next.js requires every top-level export of a "use server"
// file to be an async function; this plain synchronous helper re-exported from one fails the
// production build ("A 'use server' file can only export async functions").
export const riskFromRobustCount = (robustCount: number): "Low" | "Medium" | "High" => {
  if (robustCount >= 3) return "Low";
  if (robustCount === 2) return "Medium";
  return "High";
};
