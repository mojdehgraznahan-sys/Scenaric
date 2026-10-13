"use server";

// Initiatives CRUD (design/strategy_handoff's Prompt 2/3, 0050_initiatives.sql) — plain reads
// plus the one state-transition write (setInitiativeStatus). suggestInitiatives (the AI
// generator) lives in ./ai-suggest-initiatives.ts, same actions/ai-*.ts split used everywhere
// else in this codebase (events.ts/ai-forces.ts, scenarios.ts/ai-scenarios.ts, ...).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { initiativeLane, horizonForPhase, type InitiativeKind, type InitiativeWind } from "@/lib/decision-model";
import type { Database } from "@/lib/supabase/types";

export interface InitiativeTarget {
  id: string;
  eventId: string | null;
  title: string | null;
  control: "shape" | "influence" | "watch";
}

export interface InitiativeWithTargets {
  id: string;
  kind: InitiativeKind;
  title: string;
  why: string;
  question: string | null;
  informs: string | null;
  forceLabel: string | null;
  poleLabel: string | null;
  owner: string | null;
  cost: string | null;
  timeLabel: string | null;
  earlySign: string;
  stopIf: string;
  wind: Record<string, InitiativeWind>;
  evidence: { source: string; cite: string }[];
  status: "approved" | "dismissed" | null;
  createdBy: "ai" | "user";
  createdAt: string;
  targets: InitiativeTarget[];
}

function toInitiative(row: Database["public"]["Tables"]["initiatives"]["Row"], targets: InitiativeTarget[]): InitiativeWithTargets {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    why: row.why,
    question: row.question,
    informs: row.informs,
    forceLabel: row.force_label,
    poleLabel: row.pole_label,
    owner: row.owner,
    cost: row.cost,
    timeLabel: row.time_label,
    earlySign: row.early_sign,
    stopIf: row.stop_if,
    wind: row.wind,
    evidence: row.evidence,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    targets,
  };
}

export async function listInitiativesWithTargets(projectId: string): Promise<InitiativeWithTargets[]> {
  const supabase = createClient();
  const { data: rows, error } = await supabase.from("initiatives").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
  if (error) throw error;
  if (rows.length === 0) return [];

  const { data: targetRows, error: targetsError } = await supabase
    .from("initiative_targets")
    .select("id, initiative_id, event_id, title, control")
    .in("initiative_id", rows.map((r) => r.id));
  if (targetsError) throw targetsError;

  const targetsByInitiative = new Map<string, InitiativeTarget[]>();
  for (const t of targetRows) {
    const list = targetsByInitiative.get(t.initiative_id) ?? [];
    list.push({ id: t.id, eventId: t.event_id, title: t.title, control: t.control });
    targetsByInitiative.set(t.initiative_id, list);
  }

  return rows.map((row) => toInitiative(row, targetsByInitiative.get(row.id) ?? []));
}

// Approving/dismissing/undoing an initiative (design/strategy_handoff's Prompt 3
// set_initiative_status, ported as a plain action since this codebase doesn't use PL/pgSQL
// RPCs for anything but a genuinely racy multi-row update — see set_primary_strategic_option's
// own comment on when that's actually needed; this one isn't).
//
// Fix, not a straight port: the handoff's own spec always sets an approved initiative's move
// to horizon 'now'. That's the same "disconnected from Storyline" bug Draft Route had before
// this session's Phase B.1 fix — derive it instead from the primary target event's own phase
// (event_scenario_links for this specific scenario), via the same horizonForPhase anchor Draft
// Route now uses, so the two can't silently contradict each other for the same event.
export async function setInitiativeStatus(
  projectId: string,
  initiativeId: string,
  status: "approved" | "dismissed" | null,
  scenarioId: string
): Promise<void> {
  const supabase = createClient();

  const { data: initiative, error: initiativeError } = await supabase
    .from("initiatives")
    .select("id, kind, title, wind")
    .eq("id", initiativeId)
    .eq("project_id", projectId)
    .single();
  if (initiativeError) throw initiativeError;

  if (status === "approved") {
    const { data: primaryTarget, error: targetError } = await supabase
      .from("initiative_targets")
      .select("event_id")
      .eq("initiative_id", initiativeId)
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (targetError) throw targetError;

    let horizon: "now" | "2027" | "2028" | "2029_30" = "now";
    if (primaryTarget?.event_id) {
      const { data: link, error: linkError } = await supabase
        .from("event_scenario_links")
        .select("phase")
        .eq("event_id", primaryTarget.event_id)
        .eq("scenario_id", scenarioId)
        .maybeSingle();
      if (linkError) throw linkError;
      if (link) horizon = horizonForPhase(link.phase);
    }

    const { error: insertError } = await supabase.from("route_moves").insert({
      project_id: projectId,
      scenario_id: scenarioId,
      lane: initiativeLane(initiative.kind, initiative.wind),
      horizon,
      title: initiative.title,
      link_kind: "initiative",
      link_id: initiative.id,
      initiative_id: initiative.id,
      status: "active",
    });
    if (insertError) throw insertError;
  } else {
    // null (Undo) or 'dismissed' — either way, any route move this initiative produced is
    // gone; re-approving later (into whatever the then-current target is) inserts a fresh one.
    const { error: deleteError } = await supabase.from("route_moves").delete().eq("initiative_id", initiativeId).eq("project_id", projectId);
    if (deleteError) throw deleteError;
  }

  const { error: statusError } = await supabase.from("initiatives").update({ status }).eq("id", initiativeId).eq("project_id", projectId);
  if (statusError) throw statusError;

  revalidatePath("/strategy");
}
