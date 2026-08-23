// Shared indicator-status vocabulary — plain type/constant, not a server action. Lives outside
// src/lib/actions/*.ts because every file there is "use server", and Next.js requires every
// top-level export of a "use server" file to be an async function; a plain Record constant
// re-exported from one fails the production build ("A 'use server' file can only export async
// functions, found object").
export type IndicatorStatus = "On track" | "Watch" | "Alert";

// "up" = escalating severity (a scenario's discriminating signal strengthening), "down" = the
// reverse — a scenario isn't intrinsically good or bad, so this is a strength-of-signal axis,
// not a "risk" or "good/bad" one. Shared by indicators-monitoring.ts's own trend/status writes
// and ai-monitoring-tasks.ts's "most likely scenario" ranking, so both use the exact same
// severity weighting rather than redefining it.
export const STATUS_ORDINAL: Record<IndicatorStatus, number> = { "On track": 0, Watch: 1, Alert: 2 };
