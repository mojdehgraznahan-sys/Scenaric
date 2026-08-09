"use client";

// Strategic Options — robustness grid. Real strategic_options/strategy_scenario_scores data
// (Build Plan §12) — no longer store.strategies (mock/local), which had no real ids for the
// Ask AI tasks (ai-strategy-tasks.ts) to scope against.
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { listStrategicOptions, type StrategicOptionWithScores } from "@/lib/actions/strategy";

const BADGE_BASE = "inline-flex items-center rounded px-[7px] py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]";
const GRID_COLS = "grid-cols-[minmax(260px,2fr)_repeat(4,1fr)_100px_90px]";

function riskBadge(risk: string | null) {
  if (risk === "Low") return "bg-[#ECFDF5] text-[#065F46]";
  if (risk === "Medium") return "bg-[#FFFBEB] text-[#B45309]";
  if (risk === "High") return "bg-brand-orangeLight text-brand-orange700";
  return "bg-[#F3F4F6] text-muted-foreground";
}

interface RecommendationState {
  rationale: string;
  primaryOptionId: string | null;
  pairingOptionId: string | null;
}

export function PageStrategy() {
  const store = useStore();
  const projectId = store.activeProjectId;
  // Same "!archived" filter Canvas already uses (page-canvas.tsx) — re-axis migration is out
  // of scope for this build, so a superseded axes set's scenarios simply never un-archive.
  const scenarios = React.useMemo(() => store.scenarios.filter((s) => !s.archived), [store.scenarios]);

  const [options, setOptions] = React.useState<StrategicOptionWithScores[]>([]);
  const [optionsLoading, setOptionsLoading] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [generateNotice, setGenerateNotice] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [markingPrimary, setMarkingPrimary] = React.useState(false);

  const refreshOptions = React.useCallback(async (id: string) => {
    setOptionsLoading(true);
    try {
      setOptions(await listStrategicOptions(id));
    } catch (err) {
      console.error("[strategy] failed to load strategic options", err);
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (projectId) refreshOptions(projectId);
  }, [projectId, refreshOptions]);

  const selected = options.find((o) => o.id === selectedId) ?? null;

  // GET /projects/:id/strategy/recommendation (Build Plan §12 follow-on) — replaces the
  // formerly-hardcoded recommendation text. The endpoint itself serves a cache hit instantly
  // and only calls the model on a genuine cache miss (ai-strategy-recommendation.ts).
  // sufficientEvidence:false (no strategic_options yet) means nothing renders.
  const [recommendation, setRecommendation] = React.useState<RecommendationState | null>(null);
  const [recommendationLoading, setRecommendationLoading] = React.useState(false);
  const fetchRecommendation = React.useCallback(async (id: string) => {
    setRecommendationLoading(true);
    try {
      const data: { sufficientEvidence: boolean; rationale: string | null; primaryOptionId: string | null; pairingOptionId: string | null } = await fetch(
        `/api/projects/${id}/strategy/recommendation`
      ).then((res) => res.json());
      setRecommendation(
        data.sufficientEvidence && data.rationale ? { rationale: data.rationale, primaryOptionId: data.primaryOptionId, pairingOptionId: data.pairingOptionId } : null
      );
    } catch {
      setRecommendation(null);
    } finally {
      setRecommendationLoading(false);
    }
  }, []);
  React.useEffect(() => {
    if (projectId) fetchRecommendation(projectId);
  }, [projectId, fetchRecommendation]);

  // Ask AI drawer scoping (ask-ai.tsx's context="strategy" branch) — "Stress-test this option"
  // needs the currently-open detail modal's option; cleared on close/unmount so the drawer's
  // tasks correctly disable again once nothing is selected.
  React.useEffect(() => {
    store.setStrategyAskAiContext({
      selectedOption: selected ? { id: selected.id, name: selected.name } : null,
      selectedCell: store.strategyAskAiContext?.selectedCell ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);
  React.useEffect(() => {
    return () => store.setStrategyAskAiContext(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Arrives as /strategy?scenarioId={id} from Narrative's "See strategic options" — kept as a
  // no-op read for now (out of scope to also pre-filter the grid by it here).
  const searchParams = useSearchParams();
  const scenarioIdParam = searchParams.get("scenarioId");
  void scenarioIdParam;

  const onGenerate = async () => {
    if (!projectId || generating) return;
    setGenerating(true);
    setGenerateNotice(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/strategy/generate`, { method: "POST" });
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      const result: { sufficientEvidence: boolean; gap?: string | null; rejected: { name: string; reason: string }[]; warnings: { optionId: string; message: string }[] } =
        await res.json();
      await refreshOptions(projectId);
      await fetchRecommendation(projectId);
      if (!result.sufficientEvidence) {
        setGenerateNotice(result.gap || "The model found insufficient evidence to generate strategic options.");
      } else if (result.warnings.length > 0) {
        setGenerateNotice(result.warnings.map((w) => w.message).join(" "));
      } else if (result.rejected.length > 0) {
        setGenerateNotice(`Generated options, but rejected ${result.rejected.length} candidate(s) that weren't viable in any scenario.`);
      }
    } catch (err) {
      console.error("[strategy] generate failed", err);
      setGenerateNotice("Something went wrong generating options — try again.");
    } finally {
      setGenerating(false);
    }
  };

  const onMarkPrimary = async () => {
    if (!projectId || !selected || markingPrimary) return;
    setMarkingPrimary(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/strategy/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_primary: true }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      await refreshOptions(projectId);
    } catch (err) {
      console.error("[strategy] mark as primary failed", err);
    } finally {
      setMarkingPrimary(false);
    }
  };

  const onCellClick = (option: StrategicOptionWithScores, scenarioId: string, scenarioName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const score = option.scores.find((s) => s.scenario_id === scenarioId);
    if (!score || score.robust) return; // only non-robust cells have a "why" to ask about
    const current = store.strategyAskAiContext;
    const isSame = current?.selectedCell?.optionId === option.id && current.selectedCell.scenarioId === scenarioId;
    store.setStrategyAskAiContext({
      selectedOption: current?.selectedOption ?? null,
      selectedCell: isSame ? null : { optionId: option.id, optionName: option.name, scenarioId, scenarioName },
    });
  };

  return (
    <div className="scroll-y flex-1 overflow-y-auto p-5">
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Strategic Options</h2>
            <div className="mt-0.5 text-[13px] text-muted-foreground">How robust is each option across your scenarios?</div>
          </div>
          <Button variant="primary" size="sm" onClick={onGenerate} disabled={!projectId || generating}>
            <Icons.Sparkle size={12} /> {generating ? "Generating…" : "Generate options"}
          </Button>
        </div>

        {generateNotice && (
          <div className="mb-3.5 rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-2.5 text-[12.5px] text-[#92400E]">{generateNotice}</div>
        )}

        {/* Robustness grid */}
        <div className="overflow-hidden rounded-xl border border-border">
          <div className={cn("grid border-b border-border bg-[#F9FAFB] px-3.5 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground", GRID_COLS)}>
            <div>OPTION</div>
            {scenarios.map((s) => (
              <div key={s.id} className="flex flex-col items-center gap-1 text-center">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                <span className="text-[10px] leading-[1.1]">
                  {s.name.split(" ").map((w, i) => (
                    <div key={i}>{w}</div>
                  ))}
                </span>
              </div>
            ))}
            <div className="text-center">RISK</div>
            <div className="text-center">COST</div>
          </div>

          {optionsLoading ? (
            <div className="px-3.5 py-6 text-center text-[13px] text-muted-foreground">Loading strategic options…</div>
          ) : options.length === 0 ? (
            <div className="px-3.5 py-6 text-center text-[13px] text-muted-foreground">No strategic options yet — click &quot;Generate options&quot; to wind-tunnel some against your scenarios.</div>
          ) : (
            options.map((option, i) => (
              <div
                key={option.id}
                onClick={() => setSelectedId(option.id)}
                className={cn("grid cursor-pointer items-center px-3.5 py-3.5 hover:bg-[#FAFAFA]", GRID_COLS, i < options.length - 1 && "border-b border-[#F3F4F6]")}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-brand-dark">{option.name}</span>
                    {option.is_primary && <span className={cn(BADGE_BASE, "bg-brand-orange text-white")}>Primary</span>}
                    {recommendation?.primaryOptionId === option.id && <span className={cn(BADGE_BASE, "bg-[#ECFDF5] text-[#065F46]")}>AI pick</span>}
                    {recommendation?.pairingOptionId === option.id && <span className={cn(BADGE_BASE, "bg-[#EFF6FF] text-[#1D4ED8]")}>Hedge pick</span>}
                  </div>
                  <div className="mt-0.5 text-xs leading-[1.45] text-muted-foreground">{option.notes}</div>
                </div>
                {scenarios.map((s) => {
                  const score = option.scores.find((sc) => sc.scenario_id === s.id);
                  const current = store.strategyAskAiContext?.selectedCell;
                  const isSelectedCell = current?.optionId === option.id && current.scenarioId === s.id;
                  return (
                    <div key={s.id} className="flex justify-center">
                      <span
                        onClick={(e) => onCellClick(option, s.id, s.name, e)}
                        title={score?.rationale}
                        className={cn(
                          "inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold",
                          !score
                            ? "bg-[#F3F4F6] text-muted-foreground"
                            : score.robust
                              ? "bg-[#ECFDF5] text-[#10B981]"
                              : cn("bg-[#FEF2F2] text-[#EF4444] cursor-pointer", isSelectedCell && "ring-2 ring-[#EF4444]")
                        )}
                      >
                        {!score ? "–" : score.robust ? "✓" : "·"}
                      </span>
                    </div>
                  );
                })}
                <div className="text-center">
                  <span className={cn(BADGE_BASE, riskBadge(option.risk))}>{option.risk ?? "Unscored"}</span>
                </div>
                <div className="text-center text-xs font-medium text-muted-foreground">{option.cost ?? "Unscored"}</div>
              </div>
            ))
          )}
        </div>

        {/* AI recommendation */}
        {(recommendationLoading || recommendation) && (
          <div className="mt-4 rounded-xl border border-brand-orange100 bg-brand-orangeLight p-4">
            <div className="mb-1.5 flex items-center gap-2">
              <Icons.Sparkle size={14} stroke="#F97316" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-orange700">AI Recommendation</span>
            </div>
            <div className="text-sm leading-[1.6] text-brand-dark">{recommendationLoading ? "Loading recommendation…" : recommendation!.rationale}</div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        {selected && (
          <DialogContent className="max-w-[540px] p-6">
            <div className="mb-3">
              <div className="font-mono text-[11px] tracking-[0.06em] text-text-3">STRATEGIC OPTION · {selected.created_via === "ai" ? "AI-GENERATED" : "MANUAL"}</div>
            </div>
            <DialogTitle className="mb-1.5 text-[22px] font-semibold tracking-[-0.015em]">{selected.name}</DialogTitle>
            <p className="mb-[18px] text-sm leading-[1.55] text-muted-foreground">{selected.notes}</p>
            <div className="mb-3.5">
              <div className="mb-2 font-mono text-[11px] tracking-[0.06em] text-text-3">SCENARIO SCORES</div>
              <div className="flex flex-col gap-1.5">
                {scenarios.map((s) => {
                  const score = selected.scores.find((sc) => sc.scenario_id === s.id);
                  return (
                    <div key={s.id} className="flex items-start gap-2 text-[12.5px] leading-[1.5]">
                      <span className={score?.robust ? "text-[#10B981]" : score ? "text-[#EF4444]" : "text-muted-foreground"}>{score?.robust ? "✓" : score ? "✕" : "–"}</span>
                      <span>
                        <strong className="font-medium">{s.name}</strong>
                        {score ? `: ${score.rationale}` : ": not yet scored"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mb-[18px] grid grid-cols-2 gap-2.5">
              <div className="rounded-[10px] border border-border p-3">
                <div className="font-mono text-[10.5px] tracking-[0.06em] text-text-3">RISK</div>
                <div className="mt-1.5">
                  <span className={cn(BADGE_BASE, riskBadge(selected.risk))}>{selected.risk ?? "Unscored"}</span>
                </div>
              </div>
              <div className="rounded-[10px] border border-border p-3">
                <div className="font-mono text-[10.5px] tracking-[0.06em] text-text-3">COST</div>
                <div className="mt-1.5 text-[13px] font-semibold">{selected.cost ?? "Unscored"}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={onMarkPrimary} disabled={selected.is_primary || markingPrimary}>
                {selected.is_primary ? "Primary ✓" : markingPrimary ? "Marking…" : "Mark as primary"}
              </Button>
              <Button variant="ghost" onClick={() => setSelectedId(null)}>
                Close
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
