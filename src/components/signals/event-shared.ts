// Signals page "Events" view — shared non-JSX helpers, ported verbatim from the design
// prototype's components/events.jsx (the literal source of truth for this feature).
import { cn } from "@/lib/utils";

// Matches both past-tense ("added", "raised", ...) and present-tense headline verbs ("adds",
// "raises", ...) — news headlines are often written in the historical present.
const EVENT_PAST_RE =
  /\b(announced|raised|signed|launched|passed|approved|banned|cut|reversed|broke|hit|confirmed|added|mandated|elected|imposed|lifted|acquired|ruled|froze|collapsed|defaulted|adds|raises|signs|launches|passes|approves|bans|cuts|reverses|breaks|hits|confirms|mandates|imposes|lifts|acquires|rules|freezes|collapses|defaults)\b/i;
const EVENT_DATE_RE = /\b(19|20)\d{2}\b|\bQ[1-4]\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d/i;

export interface LooksLikeEventHit {
  status: "observed" | "possible";
  why: string;
}

export function looksLikeEvent(t: string): LooksLikeEventHit | null {
  if (!t) return null;
  if (EVENT_PAST_RE.test(t)) return { status: "observed", why: "uses a past-tense action" };
  if (EVENT_DATE_RE.test(t)) return { status: "possible", why: "names a specific date" };
  return null;
}

// Mono label style used throughout the Events view (status/date text, footer counts, tags).
export const EV_MONO = "font-mono text-[10.5px] tracking-[0.06em]";

// Shared card-face shell — border/radius/padding match the existing SignalCard exactly
// (page-signals.tsx), so EventCard/SignalCardBack look identical in anatomy.
export function cardFaceClass(...extra: (string | undefined | false)[]): string {
  return cn("flex flex-1 min-w-0 flex-col gap-2 rounded-[10px] border border-border bg-white p-3.5", ...extra);
}

// Same High/Medium/Low severity pill treatment as page-signals.tsx's uncertaintyBadge()/
// BADGE_BASE (reused here rather than duplicated in each file, since Likelihood and
// Uncertainty are the same visual severity concept) — deliberately reusing production's
// existing colors instead of porting the prototype's separate .badge-high/mid/low CSS classes.
export const SEVERITY_BADGE_BASE = "inline-flex items-center rounded px-[7px] py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]";

export function severityBadgeClass(level: "Low" | "Medium" | "High" | null | undefined): string {
  if (level === "High") return "bg-brand-orangeLight text-brand-orange700";
  if (level === "Medium") return "bg-[#FFFBEB] text-[#B45309]";
  return "bg-[#ECFDF5] text-[#065F46]";
}
