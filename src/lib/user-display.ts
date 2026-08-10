// Shared, pragma-free user-display helpers — safe to import from both client code
// (store.tsx, side-nav.tsx, page-settings.tsx) and server actions (me.ts, team.ts), so the
// initials/avatar-color derivation lives in exactly one place rather than being computed
// twice with a risk of drifting.

export function initialsFor(name: string | null | undefined, email: string): string {
  const source = (name || email || "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// First 3 entries are the exact pairs the Team tab's old hardcoded mock used, so whoever
// those colors land on today keeps the same look — the rest extend the same pastel style.
export const AVATAR_PALETTE: { bg: string; fg: string }[] = [
  { bg: "#E5E7EB", fg: "#6B7280" },
  { bg: "#DBEAFE", fg: "#1D4ED8" },
  { bg: "#EDE9FE", fg: "#6D28D9" },
  { bg: "#FFEDD5", fg: "#C2410C" },
  { bg: "#D1FAE5", fg: "#047857" },
  { bg: "#FCE7F3", fg: "#BE185D" },
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// Deterministic per-user pick — the same id always lands on the same color, no state stored.
export function avatarColorFor(id: string): string {
  return AVATAR_PALETTE[hashString(id) % AVATAR_PALETTE.length].bg;
}

// Looks up the matching foreground for a bg returned by avatarColorFor. Falls back to a
// neutral gray if the bg isn't in the palette (defensive — it always will be in practice,
// since avatarColorFor and avatarFgFor share the same palette).
export function avatarFgFor(bg: string): string {
  return AVATAR_PALETTE.find((c) => c.bg === bg)?.fg ?? "#6B7280";
}
