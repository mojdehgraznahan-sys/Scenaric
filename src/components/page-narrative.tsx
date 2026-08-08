"use client";

// Scenario Narratives — full reading view. Faithful Tailwind/shadcn port of
// the handoff page-narrative.jsx.
import * as React from "react";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useStore, usePersistentState } from "@/lib/store";
import { useNavigate } from "@/lib/use-navigate";
import { ScenarioContextHeader } from "@/components/storyline/scenario-context-header";
import { updateScenarioNarrative } from "@/lib/actions/scenarios";
import { listImplications, type ImplicationRow } from "@/lib/actions/implications";

const CATEGORY_LABEL: Record<string, string> = {
  capital: "Capital allocation",
  hiring: "Hiring / org",
  tech: "Tech stack",
  partners: "Partners",
  other: "Other",
};

interface FmWindow extends Window {
  FM_toast?: (opts: { message: string; actionText?: string; action?: string; duration?: number }) => void;
}

interface ExpandNarrativeResponse {
  sufficientEvidence: boolean;
  gap?: string | null;
  narrative?: string | null;
}

interface GenerateImplicationsResponse {
  sufficientEvidence: boolean;
  gap?: string | null;
  count: number;
}

export function PageNarrative() {
  const store = useStore();
  const scenarios = store.scenarios;
  const navigate = useNavigate();
  // Same persisted key ScenarioContextHeader's breadcrumb picker (Storyline/Narrative) already
  // uses — previously this page had its own separate, un-synced local `active` state, so the
  // breadcrumb and the reading pane below could disagree about which scenario was selected.
  const [active, setActive] = usePersistentState<string>("fm.storylineScenario", (scenarios[0] && scenarios[0].id) || "sc1");
  const current = scenarios.find((s) => s.id === active) || scenarios[0];

  const [editing, setEditing] = React.useState(false);
  const [draftSummary, setDraftSummary] = React.useState("");
  const [draftNarrative, setDraftNarrative] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const [expanding, setExpanding] = React.useState(false);
  const [expandGap, setExpandGap] = React.useState<string | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = React.useState(false);

  const [implications, setImplications] = React.useState<ImplicationRow[]>([]);
  const [implicationsLoading, setImplicationsLoading] = React.useState(false);
  const [generatingImplications, setGeneratingImplications] = React.useState(false);
  const [implicationsGap, setImplicationsGap] = React.useState<string | null>(null);

  const [generatingIndicators, setGeneratingIndicators] = React.useState(false);

  // Switching scenarios mid-edit would otherwise save a draft under the wrong scenario, or
  // leave a stale "insufficient evidence" banner showing for a scenario that's not thin —
  // drop both instead of carrying them across a switch.
  React.useEffect(() => {
    setEditing(false);
    setExpandGap(null);
  }, [current?.id]);

  // Keeps the Ask AI drawer (mounted in AppShell, a sibling of this page) current on which
  // scenario its fixed narrative task menu is scoped to — same pattern page-storyline.tsx
  // uses for storylineAskAiContext.
  React.useEffect(() => {
    if (!current) return;
    store.setNarrativeAskAiContext({ scenarioId: current.id });
    return () => store.setNarrativeAskAiContext(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const toast = (message: string) => {
    const w = window as FmWindow;
    if (w.FM_toast) w.FM_toast({ message });
  };

  const startEdit = () => {
    if (!current) return;
    setDraftSummary(current.summary);
    setDraftNarrative(current.narrative);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!current) return;
    setSaving(true);
    try {
      await updateScenarioNarrative(current.id, { narrative: draftNarrative, summary: draftSummary });
      if (store.activeProjectId) await store.refreshScenarios(store.activeProjectId);
      setEditing(false);
      toast("Narrative saved");
    } catch (err) {
      console.error("[narrative] failed to save edit", err);
      toast("Couldn't save your edit");
    } finally {
      setSaving(false);
    }
  };

  const runExpand = async () => {
    if (!current) return;
    setExpanding(true);
    setExpandGap(null);
    try {
      const res = await fetch(`/api/scenarios/${current.id}/narrative/expand`, { method: "POST" });
      if (!res.ok) throw new Error(`Expand failed (${res.status}).`);
      const result: ExpandNarrativeResponse = await res.json();
      if (!result.sufficientEvidence) {
        setExpandGap(result.gap || "The model found insufficient evidence for a coherent narrative.");
        return;
      }
      if (store.activeProjectId) await store.refreshScenarios(store.activeProjectId);
      toast("Narrative expanded with AI");
    } catch (err) {
      console.error("[narrative] expand request failed", err);
      toast("Couldn't reach the AI — try again");
    } finally {
      setExpanding(false);
    }
  };

  const onExpandClick = () => {
    if (current?.narrativeEditedByUser) {
      setConfirmOverwrite(true);
      return;
    }
    runExpand();
  };

  // Default narrative generation — auto-runs the same call "Expand with AI" does, once,
  // whenever the selected scenario truly has no narrative yet. expandNarrativeWithAI
  // (ai-narrative.ts) already enforces the >=4-node storyline floor server-side and returns
  // sufficientEvidence:false otherwise, which runExpand already surfaces as the "Go to
  // Storyline" banner below — never auto-generates a thin narrative, matches the manual path.
  // Only re-checks when the scenario id changes (not on every render), so this can't loop:
  // once a narrative exists (auto- or manually-authored) current.narrative is truthy and the
  // guard below stops firing for that scenario.
  React.useEffect(() => {
    if (current && !current.narrative) {
      runExpand();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const runGenerateImplications = async (scenarioId: string) => {
    setGeneratingImplications(true);
    setImplicationsGap(null);
    try {
      const res = await fetch(`/api/scenarios/${scenarioId}/implications/generate`, { method: "POST" });
      if (!res.ok) throw new Error(`Generate failed (${res.status}).`);
      const result: GenerateImplicationsResponse = await res.json();
      if (!result.sufficientEvidence) {
        setImplicationsGap(result.gap || "The model found insufficient evidence for scenario-specific implications.");
        return;
      }
      setImplications(await listImplications(scenarioId));
    } catch (err) {
      console.error("[narrative] implications generate failed", err);
      setImplicationsGap("Couldn't generate implications right now — try again.");
    } finally {
      setGeneratingImplications(false);
    }
  };

  // Implications — fetch on scenario select; auto-generate once if none exist yet and the
  // scenario has a narrative to ground them in. Depends on current.narrative (not just id)
  // so that if the auto-expand effect above just populated a narrative for this same
  // scenario, this re-checks and picks up the now-satisfied precondition rather than
  // requiring a second scenario switch to notice.
  React.useEffect(() => {
    if (!current) return;
    let cancelled = false;
    setImplicationsGap(null);
    setImplicationsLoading(true);
    listImplications(current.id)
      .then((rows) => {
        if (cancelled) return;
        setImplications(rows);
        setImplicationsLoading(false);
        if (rows.length === 0 && current.narrative) {
          runGenerateImplications(current.id);
        }
      })
      .catch((err) => {
        console.error("[narrative] failed to load implications", err);
        if (!cancelled) setImplicationsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, current?.narrative]);

  // "Track indicators" — Step 8 (Build Plan §11), generates + persists real indicators for
  // this scenario, then hands off to Monitoring pre-filtered to them. Not the same feature
  // as Signpost (ai-grounding.ts) — see SCHWARTZ_METHODOLOGY_SKILL.md's "Signpost" section.
  const onTrackIndicators = async () => {
    if (!current || !store.activeProjectId) return;
    setGeneratingIndicators(true);
    try {
      const res = await fetch(`/api/projects/${store.activeProjectId}/indicators/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: current.id }),
      });
      if (!res.ok) throw new Error(`Generate failed (${res.status}).`);
      const result: { sufficientEvidence: boolean; gap?: string | null; count: number } = await res.json();
      if (!result.sufficientEvidence) {
        toast(result.gap || "Couldn't generate indicators for this scenario.");
        return;
      }
      toast(`Generated ${result.count} indicator(s)`);
      navigate(`/monitoring?scenarioId=${current.id}`);
    } catch (err) {
      console.error("[narrative] indicators generate failed", err);
      toast("Couldn't generate indicators right now — try again.");
    } finally {
      setGeneratingIndicators(false);
    }
  };

  // Empty state — no scenarios built yet.
  if (!scenarios.length || !current) {
    return (
      <div className="scroll-y flex-1 overflow-y-auto p-5">
        <div className="rounded-xl border border-border bg-card p-7 shadow-card">
          <ScenarioContextHeader view="narrative" className="pt-0 pb-4" />
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-brand-orangeLight">
              <Icons.Edit3 size={22} stroke="#F97316" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-brand-dark">No scenarios yet</h3>
            <p className="mb-[18px] max-w-[360px] text-sm leading-[1.5] text-muted-foreground">
              Build your four scenarios from the Matrix, then come back to write their narratives.
            </p>
            <Button variant="primary" size="sm" onClick={() => navigate("/matrix")}>
              <Icons.Grid size={12} /> Go to Matrix
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="scroll-y flex-1 overflow-y-auto p-5">
      <div className="grid grid-cols-[240px_1fr] gap-4">
        {/* Scenarios list */}
        <div className="self-start rounded-xl border border-border bg-card p-3 shadow-card">
          <div className="px-1.5 pb-2 pt-1 font-mono text-[10.5px] tracking-[0.06em] text-text-3">4 SCENARIOS</div>
          {scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={cn(
                "mb-0.5 flex w-full flex-col gap-[3px] rounded-md border-0 px-[11px] py-2.5 text-left",
                active === s.id ? "bg-bg" : "bg-transparent"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="h-[9px] w-[9px] rounded-full" style={{ background: s.color }} />
                <span className="text-[13px] font-semibold text-brand-dark">{s.name}</span>
              </div>
              <div className="pl-[17px] text-[11.5px] text-muted-foreground">{s.tagline}</div>
            </button>
          ))}
        </div>

        {/* Narrative reading view */}
        <div className="rounded-xl border border-border bg-card p-7 shadow-card">
          <ScenarioContextHeader view="narrative" className="pt-0 pb-4" />
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-4 w-4 rounded-full" style={{ background: current.color }} />
              <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-3">
                Scenario · {scenarios.indexOf(current) + 1}/4
              </div>
            </div>
            {editing ? (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={saveEdit} disabled={saving}>
                  {saving ? <Icons.Refresh size={12} className="animate-spin" /> : <Icons.Check size={12} />} Save
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={startEdit}>
                  <Icons.Edit3 size={12} /> Edit
                </Button>
                <Button variant="soft" size="sm" onClick={onExpandClick} disabled={expanding}>
                  {expanding ? <Icons.Refresh size={12} className="animate-spin" /> : <Icons.Sparkle size={12} />} Expand with AI
                </Button>
              </div>
            )}
          </div>

          <h1 className="mb-1.5 text-[32px] font-semibold tracking-[-0.025em] [text-wrap:balance]">{current.name}</h1>
          <div className="mb-[26px] text-sm font-medium" style={{ color: current.color }}>
            {current.tagline}
          </div>

          {expandGap && (
            <div className="mb-[22px] flex items-center justify-between gap-3 rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-[12.5px] text-[#B91C1C]">
              <span>{expandGap}</span>
              <button
                onClick={() => {
                  try {
                    localStorage.setItem("fm.storylineScenario", JSON.stringify(current.id));
                  } catch {}
                  navigate("/storyline");
                }}
                className="flex-shrink-0 whitespace-nowrap border-0 bg-transparent p-0 text-[12.5px] font-semibold text-[#B91C1C] underline"
              >
                Go to Storyline
              </button>
            </div>
          )}

          {editing ? (
            <>
              <Textarea
                value={draftSummary}
                onChange={(e) => setDraftSummary(e.target.value)}
                rows={2}
                className="mb-[18px] text-[15px] italic"
                placeholder="One-line summary…"
              />
              <div className="mb-[22px] h-px bg-border" />
              <Textarea
                value={draftNarrative}
                onChange={(e) => setDraftNarrative(e.target.value)}
                rows={10}
                className="text-[15px] leading-[1.75]"
                placeholder="Narrative…"
              />
            </>
          ) : (
            <>
              <p className="mb-[22px] text-[17px] italic leading-[1.6] text-[#374151] [text-wrap:pretty]">{current.summary}</p>
              <div className="mb-[22px] h-px bg-border" />
              <p className="m-0 text-[15px] leading-[1.75] text-brand-dark [text-wrap:pretty]">{current.narrative}</p>
            </>
          )}

          {/* Implications */}
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-mono text-[13px] font-semibold uppercase tracking-[0.08em] text-text-3">Implications</h3>
              <button
                onClick={() => runGenerateImplications(current.id)}
                disabled={generatingImplications || !current.narrative}
                className="flex items-center gap-1 border-0 bg-transparent p-0 text-[11.5px] font-medium text-brand-orange disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icons.Refresh size={11} className={generatingImplications ? "animate-spin" : undefined} />
                {generatingImplications ? "Regenerating…" : "Regenerate"}
              </button>
            </div>

            {implicationsGap ? (
              <div className="rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-[12.5px] text-[#B91C1C]">{implicationsGap}</div>
            ) : implicationsLoading ? (
              <div className="text-[13px] text-muted-foreground">Loading…</div>
            ) : implications.length === 0 ? (
              <div className="text-[13px] text-muted-foreground">
                {current.narrative ? "No implications yet." : "Write or generate a narrative first."}
              </div>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {implications.map((imp) => (
                  <li key={imp.id} className="flex gap-2.5 text-sm leading-[1.55] text-[#374151]">
                    <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: current.color }} />
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-1.5">
                        <span className="inline-flex items-center rounded px-[7px] py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] bg-[#F3F4F6] text-[#4B5563]">
                          {CATEGORY_LABEL[imp.category ?? "other"]}
                        </span>
                      </div>
                      <div>{imp.text}</div>
                      <div className="mt-1 text-[11.5px] italic leading-[1.4] text-text-3">&quot;{imp.grounded_in_text}&quot;</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-7 flex gap-2">
            {/* scenarioId carries through so page-strategy.tsx can eventually pre-filter/
                pre-score against this scenario's implications — no wind-tunnel scoring
                endpoint exists yet (Build Plan §12), see the TODO there. */}
            <Button variant="primary" onClick={() => navigate(`/strategy?scenarioId=${current.id}`)}>
              See strategic options <Icons.ArrowRight size={14} />
            </Button>
            <Button variant="ghost" onClick={onTrackIndicators} disabled={generatingIndicators}>
              {generatingIndicators && <Icons.Refresh size={12} className="animate-spin" />} Track indicators
            </Button>
          </div>
        </div>
      </div>

      {/* Confirm before an AI regeneration overwrites a manual edit */}
      <Dialog open={confirmOverwrite} onOpenChange={setConfirmOverwrite}>
        <DialogContent className="max-w-[440px] rounded-2xl p-6">
          <DialogTitle className="mb-1.5 text-lg font-semibold tracking-[-0.01em]">Overwrite your edits?</DialogTitle>
          <p className="mb-[18px] text-sm leading-[1.55] text-muted-foreground">
            You&apos;ve manually edited this narrative. Regenerating with AI will overwrite your changes.
          </p>
          <div className="flex gap-2">
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => {
                setConfirmOverwrite(false);
                runExpand();
              }}
            >
              Overwrite and regenerate
            </Button>
            <Button variant="ghost" onClick={() => setConfirmOverwrite(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
