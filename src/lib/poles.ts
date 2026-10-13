// Shared pole-quality validator — used by both server (force-writing-rules.ts's
// isValidForceTitle, the AI producers, the backfill) and client (MatrixV2.tsx, force-card.tsx's
// inline "fix it" editors). Plain module, no "server-only": a Client Component needs to run
// isPoleOk on every keystroke before enabling Save.
//
// A force is a variable; its two poles are opposite END STATES of that variable. A pole that's
// generic ("Low"/"Doesn't happen"), identical to the other pole, or identical to the force's own
// title carries no information — question 2 on the Matrix ("could you honestly picture either of
// these happening?") has nothing real to compare.
export const GENERIC_POLE =
  /^(low|high|no|yes|none|not|more|less|same|status quo|increase|decrease|happens|it happens|doesn.?t happen|does not happen|won.?t happen|nothing changes)$/i;

export function isPoleOk(title: string, pole: string): boolean {
  const trimmed = pole.trim();
  if (trimmed.length === 0) return false;
  if (GENERIC_POLE.test(trimmed)) return false;
  if (trimmed.toLowerCase() === title.trim().toLowerCase()) return false;
  return true;
}

export function arePolesWeak(title: string, poles: [string, string]): boolean {
  const [a, b] = poles;
  if (!isPoleOk(title, a) || !isPoleOk(title, b)) return true;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
