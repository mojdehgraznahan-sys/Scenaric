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

// Storyline's force-tag — the first force an event links to, and the pole text it pulls
// toward. Undefined when the event has no links (nothing to show).
export function eventForcePole(
  ev: Pick<EventItem, "links">,
  signals: Signal[]
): { forceTitle: string; toward: string; extraForces: number } | undefined {
  const first = ev.links[0];
  if (!first) return undefined;
  const force = signals.find((s) => s.id === first.signalId);
  if (!force) return undefined;
  const uniqueForceIds = new Set(ev.links.map((l) => l.signalId));
  return { forceTitle: force.title, toward: slPole(force, first.side), extraForces: Math.max(0, uniqueForceIds.size - 1) };
}
