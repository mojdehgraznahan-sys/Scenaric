"use server";

// One-time weak-pole backfill (design/CLAUDE_CODE_MATRIX_POLES_PROMPTS.md) — fixes forces whose
// pole_a/pole_b are generic ("Doesn't happen"/the force's own title, see lib/poles.ts) rather
// than real opposite end states, the pattern the 0038 migration's honest-placeholder backfill
// (pole_a = "Doesn't happen", pole_b = title) left behind for any signal nobody has since edited.
//
// Same convention as indicators-retirement-seed.ts / ai-storyline-event-backfill.ts: a plain
// admin-client function, safe to rerun, admin-triggered once (e.g. a temporary script or route),
// not wired into any cron.
//
// Does NOT touch matrix_placements, axes, or axis_headlines, and needs no alias bookkeeping for
// event links: event_signal_links.side is already structural ('a'|'b'), so renaming pole_a/pole_b
// can never orphan an existing link — the display label is always derived live from side + the
// signal's current poles (see pole.ts's slPole()), never frozen text.
import { z } from "zod";
import { runStructured } from "@/lib/ai/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { arePolesWeak } from "@/lib/poles";
import { PERSONA_MACRO_SCOUT } from "@/lib/ai/personas";

const RegeneratePolesSchema = z.object({
  pole_a: z.string(),
  pole_b: z.string(),
});

const REGENERATE_POLES_TASK_PROMPT = `${PERSONA_MACRO_SCOUT}

Task: This existing force's poles are too generic to compare
against each other — rename both ends so they're real, opposite outcomes a strategist could
picture by the horizon. Keep the force's own title and meaning; only the pole wording is wrong.

Input: { title: string, body: string, events_pulling_a: string[], events_pulling_b: string[] }
/* events_pulling_a/b are titles of events already linked to this force on that side, if any — if
   present, name that pole so it reads consistently with what those events already describe. */

- \`pole_a\`/\`pole_b\`: a force is a variable; its two poles are opposite END STATES of that
  variable. Each is a short (2-5 word) outcome a strategist could picture by the horizon. Never
  "Doesn't happen", "Happens", "Low"/"High", "Yes"/"No", the force title itself, or a bare negation
  of the other pole.
  Bad: ["Doesn't happen", "US dependent on Chinese power-electronics components"]
  Good: ["US supply diversifies", "Dependence on China deepens"]
  Good: ["Tariffs soften", "Tariffs bite harder"]

Output schema: { pole_a: string, pole_b: string }`;

export interface PoleBackfillRow {
  signalId: string;
  projectId: string;
  title: string;
  oldPoles: [string, string];
  newPoles: [string, string];
  stillWeak: boolean;
}

async function regeneratePoles(
  projectId: string,
  signal: { title: string; body: string },
  eventsPullingA: string[],
  eventsPullingB: string[]
): Promise<{ poleA: string; poleB: string }> {
  const runOnce = () =>
    runStructured({
      step: "signals.backfill_poles",
      projectId,
      taskPrompt: REGENERATE_POLES_TASK_PROMPT,
      input: { title: signal.title, body: signal.body, events_pulling_a: eventsPullingA, events_pulling_b: eventsPullingB },
      schema: RegeneratePolesSchema,
      effort: "low",
    });

  let output = await runOnce();
  if (arePolesWeak(signal.title, [output.pole_a, output.pole_b])) {
    output = await runOnce();
  }
  return { poleA: output.pole_a, poleB: output.pole_b };
}

// Dry run by default — only `apply: true` writes anything. Call once with apply:false to review
// the report, then again with apply:true to commit it; a third call afterwards should report an
// empty list.
export async function backfillWeakPoles(options: { apply: boolean }): Promise<PoleBackfillRow[]> {
  const supabase = createAdminClient();

  const { data: signals, error } = await supabase.from("signals").select("id, project_id, title, body, pole_a, pole_b");
  if (error) throw error;

  const weak = signals.filter((s) => arePolesWeak(s.title, [s.pole_a ?? "", s.pole_b ?? ""]));
  if (weak.length === 0) return [];

  const { data: links, error: linksError } = await supabase
    .from("event_signal_links")
    .select("signal_id, side, event_id")
    .in(
      "signal_id",
      weak.map((s) => s.id)
    );
  if (linksError) throw linksError;

  const eventIds = Array.from(new Set(links.map((l) => l.event_id)));
  const { data: events, error: eventsError } =
    eventIds.length > 0 ? await supabase.from("events").select("id, title").in("id", eventIds) : { data: [] as { id: string; title: string }[], error: null };
  if (eventsError) throw eventsError;
  const titleByEventId = new Map(events.map((e) => [e.id, e.title]));

  const report: PoleBackfillRow[] = [];
  for (const s of weak) {
    const linksForSignal = links.filter((l) => l.signal_id === s.id);
    const eventsPullingA = linksForSignal
      .filter((l) => l.side === "a")
      .map((l) => titleByEventId.get(l.event_id))
      .filter((t): t is string => !!t);
    const eventsPullingB = linksForSignal
      .filter((l) => l.side === "b")
      .map((l) => titleByEventId.get(l.event_id))
      .filter((t): t is string => !!t);

    const { poleA, poleB } = await regeneratePoles(s.project_id, { title: s.title, body: s.body }, eventsPullingA, eventsPullingB);

    report.push({
      signalId: s.id,
      projectId: s.project_id,
      title: s.title,
      oldPoles: [s.pole_a ?? "", s.pole_b ?? ""],
      newPoles: [poleA, poleB],
      stillWeak: arePolesWeak(s.title, [poleA, poleB]),
    });

    if (options.apply) {
      const { error: updateError } = await supabase.from("signals").update({ pole_a: poleA, pole_b: poleB }).eq("id", s.id);
      if (updateError) throw updateError;
    }
  }

  return report;
}
