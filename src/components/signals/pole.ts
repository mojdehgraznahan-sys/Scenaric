// Signals Library v2 (design/handoff/2026-09-28) — shared, non-JSX helpers for the two-pole
// force model. Unlike the reference design's slSide() (which has to infer a side from frozen
// `toward` text because its demo seed data predates a real `side` column), production
// EventLink.side is always populated at write time (events.ts's createEvent/linkEvent) — so
// there's nothing to infer here, just one place that turns a stored side into display text.
import type { EventItem, Signal, SteepCategory } from "@/lib/types";

export function slPole(sig: Pick<Signal, "poleA" | "poleB">, side: "a" | "b"): string {
  return side === "a" ? sig.poleA : sig.poleB;
}

// Ported from the pre-rebuild event-card.tsx: a missing/legacy-null event category falls back
// to its first linked signal's category, or "Political" as a last resort when it has no links
// at all (an orphaned Inbox item has no signal to borrow a category from).
export function eventCategory(ev: EventItem, signals: Signal[]): SteepCategory {
  if (ev.category) return ev.category;
  const first = ev.links[0];
  const linked = first && signals.find((s) => s.id === first.signalId);
  return linked ? linked.category : "Political";
}
