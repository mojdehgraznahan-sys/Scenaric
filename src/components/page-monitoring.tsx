"use client";

// Monitoring — leading indicators (Step 8, Build Plan §11). Real data throughout: the main
// list + sparkline come from GET /projects/:id/indicators (indicators joined with their last 7
// indicator_readings — real history, not the fake trend-shape sparkline the original design
// mockup had), the alert banner from GET /projects/:id/indicators/alert-summary (real,
// grounded rationale text, hidden entirely when nothing is in Alert), and "Add indicator" is a
// real create flow (manual, or "Suggest with AI" against the existing generate endpoint).
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { createManualIndicator, type IndicatorWithReadings, type AlertIndicatorSummary } from "@/lib/actions/indicators";
import type { Scenario } from "@/lib/types";

// Same window-global toast convention page-narrative.tsx already uses (GlobalToast in
// app-shell.tsx) — not the unrelated shadcn useToast() hook in ui/use-toast.ts.
interface FmWindow extends Window {
  FM_toast?: (opts: { message: string; actionText?: string; action?: string; duration?: number }) => void;
}

const GRID_COLS = "grid-cols-[minmax(260px,2.2fr)_1.2fr_90px_80px_74px_84px]";

function statusColor(st: "On track" | "Watch" | "Alert") {
  if (st === "Alert") return { bg: "#FEF2F2", fg: "#EF4444", dot: "#EF4444" };
  if (st === "Watch") return { bg: "#FFFBEB", fg: "#B45309", dot: "#F59E0B" };
  return { bg: "#ECFDF5", fg: "#065F46", dot: "#10B981" };
}

function trendArrow(trend: "up" | "flat" | "down" | null) {
  if (trend === "up") return "↑";
  if (trend === "down") return "↓";
  if (trend === "flat") return "→";
  return "—";
}

// Real 7-day history, no library — value domain is exactly {0,1,2} (On track/Watch/Alert
// ordinal, see indicators-monitoring.ts's STATUS_ORDINAL), so this deliberately renders as a
// discrete 3-level staircase rather than a smoothed line — an honest rendering of a genuinely
// discrete signal, not a display bug.
const SPARK_W = 64;
const SPARK_H = 20;
const SPARK_PAD = 3;

function Sparkline({ readings, color }: { readings: { date: string; value: number }[]; color: string }) {
  if (readings.length === 0) return <span className="text-[11.5px] text-text-3">—</span>;

  const y = (v: number) => SPARK_PAD + (SPARK_H - 2 * SPARK_PAD) - (v / 2) * (SPARK_H - 2 * SPARK_PAD);
  const x = (i: number, n: number) => (n <= 1 ? SPARK_W / 2 : SPARK_PAD + (i / (n - 1)) * (SPARK_W - 2 * SPARK_PAD));

  if (readings.length === 1) {
    return (
      <svg width={SPARK_W} height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} role="img" aria-label="1 day of history">
        <circle cx={x(0, 1)} cy={y(readings[0].value)} r={2} fill={color} />
      </svg>
    );
  }

  const points = readings.map((r, i) => `${x(i, readings.length)},${y(r.value)}`).join(" ");
  const last = readings[readings.length - 1];
  return (
    <svg width={SPARK_W} height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} role="img" aria-label={`${readings.length} days of history`}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(readings.length - 1, readings.length)} cy={y(last.value)} r={2} fill={color} />
    </svg>
  );
}

export function PageMonitoring() {
  const store = useStore();
  const projectId = store.activeProjectId;
  const scenarios = store.scenarios;
  const activeScenarios = React.useMemo(() => scenarios.filter((s) => !s.archived), [scenarios]);

  // "Track indicators" on the Narrative page generates for one scenario, persists it for
  // real, then lands here as /monitoring?scenarioId={id} to pre-filter to it.
  const searchParams = useSearchParams();
  const scenarioIdParam = searchParams.get("scenarioId");

  const [indicators, setIndicators] = React.useState<IndicatorWithReadings[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState("All");
  const [scenarioFilter, setScenarioFilter] = React.useState<string | null>(scenarioIdParam);
  const [alerts, setAlerts] = React.useState<AlertIndicatorSummary[]>([]);
  const [addOpen, setAddOpen] = React.useState(false);

  // Ask AI drawer scoping (ask-ai.tsx's context="monitoring" branch) — "Explain this
  // indicator's status" needs the currently-selected row; cleared on unmount so the drawer's
  // task correctly disables again once nothing is selected.
  React.useEffect(() => {
    return () => store.setMonitoringAskAiContext(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRowClick = (indicator: IndicatorWithReadings) => {
    const current = store.monitoringAskAiContext?.selectedIndicator;
    store.setMonitoringAskAiContext(current?.id === indicator.id ? null : { selectedIndicator: { id: indicator.id, name: indicator.name } });
  };

  const toast = React.useCallback((message: string) => {
    const w = window as FmWindow;
    if (w.FM_toast) w.FM_toast({ message });
  }, []);

  const refreshIndicators = React.useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/indicators`);
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      setIndicators(await res.json());
    } catch (err) {
      console.error("[monitoring] failed to load indicators", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAlerts = React.useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}/indicators/alert-summary`);
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      setAlerts(await res.json());
    } catch (err) {
      console.error("[monitoring] failed to load alert summary", err);
    }
  }, []);

  React.useEffect(() => {
    setScenarioFilter(scenarioIdParam);
  }, [scenarioIdParam]);

  React.useEffect(() => {
    if (!projectId) return;
    refreshIndicators(projectId);
    refreshAlerts(projectId);
  }, [projectId, refreshIndicators, refreshAlerts]);

  const onCreated = React.useCallback(() => {
    if (!projectId) return;
    refreshIndicators(projectId);
    refreshAlerts(projectId);
  }, [projectId, refreshIndicators, refreshAlerts]);

  const scenarioFiltered = scenarioFilter ? indicators.filter((i) => i.scenario_id === scenarioFilter) : indicators;
  const filtered = statusFilter === "All" ? scenarioFiltered : scenarioFiltered.filter((i) => i.status === statusFilter);
  const filterScenario = scenarioFilter ? scenarios.find((s) => s.id === scenarioFilter) : null;

  const summary = [
    { label: "All", count: scenarioFiltered.length, color: "text-brand-dark", dot: "#1E1B2E" },
    { label: "Alert", count: scenarioFiltered.filter((i) => i.status === "Alert").length, color: "text-[#EF4444]", dot: "#EF4444" },
    { label: "Watch", count: scenarioFiltered.filter((i) => i.status === "Watch").length, color: "text-[#F59E0B]", dot: "#F59E0B" },
    { label: "On track", count: scenarioFiltered.filter((i) => i.status === "On track").length, color: "text-[#10B981]", dot: "#10B981" },
  ];

  return (
    <div className="scroll-y flex-1 overflow-y-auto p-5">
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Monitoring</h2>
            <div className="mt-0.5 text-[13px] text-muted-foreground">Leading indicators tell you which scenario is unfolding.</div>
          </div>
          <Button variant="primary" size="sm" onClick={() => setAddOpen(true)} disabled={!projectId}>
            <Icons.Plus size={12} /> Add indicator
          </Button>
        </div>

        {/* Alert summary — real, grounded rationale from the most recent grounded reading;
            hidden entirely when nothing is in Alert, never a stale placeholder. */}
        {alerts.length > 0 && (
          <div className="mb-3.5 flex items-start gap-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3.5">
            <Icons.Bell size={16} stroke="#EF4444" className="mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="mb-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[#991B1B]">
                {alerts.length} indicator{alerts.length === 1 ? "" : "s"} in alert
              </div>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px] leading-[1.55] text-[#7F1D1D]">
                {alerts.map((a) => {
                  const scenario = a.scenarioId ? scenarios.find((s) => s.id === a.scenarioId) : null;
                  return (
                    <li key={a.indicatorId}>
                      <strong>{a.indicatorName}</strong>
                      {scenario ? (
                        <>
                          {" → "}
                          <strong>{scenario.name}</strong>
                        </>
                      ) : null}
                      {": "}
                      {a.rationale} <span className="text-[11px] text-[#991B1B]/70">(as of {a.asOfDate})</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {filterScenario && (
          <div className="mb-3.5 flex items-center gap-2 rounded-[10px] border border-brand-orange100 bg-brand-orangeLight px-3.5 py-2.5 text-[12.5px] text-brand-orange700">
            <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: filterScenario.color }} />
            <span className="flex-1">
              Showing indicators for <strong>{filterScenario.name}</strong>
            </span>
            <button
              onClick={() => setScenarioFilter(null)}
              className="flex-shrink-0 border-0 bg-transparent p-0 text-[12.5px] font-semibold text-brand-orange700 underline"
            >
              Show all
            </button>
          </div>
        )}

        {/* Status summary */}
        <div className="mb-[18px] grid grid-cols-4 gap-3">
          {summary.map((s) => (
            <button
              key={s.label}
              onClick={() => setStatusFilter(s.label)}
              className={cn(
                "rounded-[10px] bg-white text-left",
                statusFilter === s.label ? "border-[1.5px] border-brand-dark px-3.5 py-[11px]" : "border border-border px-3.5 py-3"
              )}
            >
              <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-text-3">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />
                {s.label}
              </div>
              <div className={cn("mt-1 text-[26px] font-semibold tracking-[-0.02em]", s.color)}>{s.count}</div>
            </button>
          ))}
        </div>

        {/* Indicator list */}
        <div className="overflow-hidden rounded-xl border border-border">
          <div
            className={cn(
              "grid border-b border-border bg-[#F9FAFB] px-3.5 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground",
              GRID_COLS
            )}
          >
            <div>INDICATOR</div>
            <div>SCENARIO</div>
            <div className="text-center">STATUS</div>
            <div className="text-center">TREND</div>
            <div className="text-center">7-DAY</div>
            <div className="text-center">GROUNDED</div>
          </div>
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No indicators yet — click &quot;Add indicator&quot; or generate some from a scenario&apos;s Narrative page (&quot;Track indicators&quot;).
            </div>
          ) : (
            filtered.map((ind, i) => {
              const c = statusColor(ind.status);
              const scenario = scenarios.find((s) => s.id === ind.scenario_id);
              const isSelected = store.monitoringAskAiContext?.selectedIndicator?.id === ind.id;
              return (
                <div
                  key={ind.id}
                  onClick={() => onRowClick(ind)}
                  title="Select for Ask AI"
                  className={cn(
                    "grid cursor-pointer items-center px-3.5 py-3 hover:bg-[#FAFAFA]",
                    GRID_COLS,
                    i < filtered.length - 1 && "border-b border-[#F3F4F6]",
                    isSelected && "ring-2 ring-inset ring-brand-orange"
                  )}
                >
                  <div>
                    <div className="text-[13.5px] font-medium text-brand-dark">{ind.name}</div>
                    {ind.note && <div className="mt-0.5 text-[11.5px] text-text-3">{ind.note}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: scenario?.color || "#9CA3AF" }} />
                    <span className="text-[12.5px] text-[#374151]">{scenario?.name || "—"}</span>
                  </div>
                  <div className="text-center">
                    <span
                      className="inline-flex items-center rounded px-[7px] py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]"
                      style={{ background: c.bg, color: c.fg }}
                    >
                      {ind.status}
                    </span>
                  </div>
                  <div className="text-center text-[13px] font-semibold" style={{ color: c.fg }}>
                    {trendArrow(ind.trend)}
                  </div>
                  <div className="flex justify-center">
                    <Sparkline readings={ind.readings} color={c.dot} />
                  </div>
                  <div className="text-center text-[11.5px] text-text-3">{ind.grounded_in ? "✓" : "—"}</div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <AddIndicatorDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        projectId={projectId}
        scenarios={activeScenarios}
        indicators={indicators}
        onCreated={onCreated}
        toast={toast}
      />
    </div>
  );
}

type AddMode = "manual" | "ai";

function AddIndicatorDialog({
  open,
  onOpenChange,
  projectId,
  scenarios,
  indicators,
  onCreated,
  toast,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  scenarios: Scenario[];
  indicators: IndicatorWithReadings[];
  onCreated: () => void;
  toast: (message: string) => void;
}) {
  const [mode, setMode] = React.useState<AddMode>("manual");

  const [name, setName] = React.useState("");
  const [note, setNote] = React.useState("");
  const [scenarioId, setScenarioId] = React.useState("none");
  const [triggerCondition, setTriggerCondition] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const [aiScenarioId, setAiScenarioId] = React.useState("");
  const [confirmReplace, setConfirmReplace] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [aiNotice, setAiNotice] = React.useState<string | null>(null);

  const resetAndClose = () => {
    setName("");
    setNote("");
    setScenarioId("none");
    setTriggerCondition("");
    setAiScenarioId("");
    setConfirmReplace(false);
    setAiNotice(null);
    setMode("manual");
    onOpenChange(false);
  };

  const onCreateManual = async () => {
    if (!projectId || !name.trim() || creating) return;
    setCreating(true);
    try {
      await createManualIndicator({
        projectId,
        scenarioId: scenarioId === "none" ? null : scenarioId,
        name: name.trim(),
        note: note.trim() || null,
        triggerCondition: triggerCondition.trim() || null,
      });
      toast("Indicator added");
      onCreated();
      resetAndClose();
    } catch (err) {
      console.error("[monitoring] failed to create indicator", err);
      toast("Couldn't add that indicator — try again");
    } finally {
      setCreating(false);
    }
  };

  // generateIndicatorsForScenario deletes ALL existing indicators for the scenario before
  // inserting new ones (ai-indicators.ts) — not additive. Checked client-side against the
  // indicators already loaded on the page, no extra query needed.
  const existingCountForAiScenario = aiScenarioId ? indicators.filter((i) => i.scenario_id === aiScenarioId).length : 0;
  const isDestructive = existingCountForAiScenario > 0;

  const onSuggestWithAi = async () => {
    if (!projectId || !aiScenarioId || generating) return;
    if (isDestructive && !confirmReplace) return;
    setGenerating(true);
    setAiNotice(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/indicators/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: aiScenarioId }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      const result: { sufficientEvidence: boolean; gap?: string | null; count: number } = await res.json();
      if (!result.sufficientEvidence) {
        setAiNotice(result.gap || "The model found insufficient evidence to generate indicators for this scenario.");
        return;
      }
      toast(`Generated ${result.count} indicator(s)`);
      onCreated();
      resetAndClose();
    } catch (err) {
      console.error("[monitoring] indicator generate failed", err);
      setAiNotice("Something went wrong generating indicators — try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && resetAndClose()}>
      <DialogContent className="max-w-[480px] p-6">
        <DialogTitle className="mb-3 text-[18px] font-semibold">Add indicator</DialogTitle>
        <div className="mb-4 flex gap-2">
          <Button variant={mode === "manual" ? "primary" : "ghost"} size="sm" onClick={() => setMode("manual")}>
            Manual
          </Button>
          <Button variant={mode === "ai" ? "primary" : "ghost"} size="sm" onClick={() => setMode("ai")}>
            <Icons.Sparkle size={12} /> Suggest with AI
          </Button>
        </div>

        {mode === "manual" ? (
          <div className="flex flex-col gap-3.5">
            <div>
              <Label htmlFor="ind-name" className="mb-1.5 block text-xs">
                Name
              </Label>
              <Input id="ind-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. EU AI Act high-risk ruling published" />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Scenario</Label>
              <Select value={scenarioId} onValueChange={setScenarioId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No scenario</SelectItem>
                  {scenarios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ind-note" className="mb-1.5 block text-xs">
                Note
              </Label>
              <Textarea id="ind-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional context for this indicator" />
            </div>
            <div>
              <Label htmlFor="ind-trigger" className="mb-1.5 block text-xs">
                Trigger condition
              </Label>
              <Textarea
                id="ind-trigger"
                rows={3}
                value={triggerCondition}
                onChange={(e) => setTriggerCondition(e.target.value)}
                placeholder="What separates On track / Watch / Alert for this indicator?"
              />
              <div className="mt-1 text-[11px] text-text-3">Used by daily monitoring to judge status — recommended but not required.</div>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={onCreateManual} disabled={!name.trim() || creating}>
                {creating ? "Adding…" : "Add indicator"}
              </Button>
              <Button variant="ghost" onClick={resetAndClose}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            <div>
              <Label className="mb-1.5 block text-xs">Scenario</Label>
              <Select
                value={aiScenarioId}
                onValueChange={(v) => {
                  setAiScenarioId(v);
                  setConfirmReplace(false);
                  setAiNotice(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a scenario" />
                </SelectTrigger>
                <SelectContent>
                  {scenarios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isDestructive && (
              <div className="rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] p-3 text-[12.5px] text-[#92400E]">
                <p className="m-0 mb-2">
                  This scenario already has {existingCountForAiScenario} indicator{existingCountForAiScenario === 1 ? "" : "s"}. Generating new ones
                  replaces them — the old ones are deleted, not merged.
                </p>
                <label className="flex cursor-pointer items-center gap-2 text-[12.5px]">
                  <input type="checkbox" checked={confirmReplace} onChange={(e) => setConfirmReplace(e.target.checked)} />
                  I understand this replaces the existing indicators
                </label>
              </div>
            )}

            {aiNotice && <div className="rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2.5 text-[12.5px] text-[#92400E]">{aiNotice}</div>}

            <div className="flex gap-2">
              <Button
                variant="primary"
                className="flex-1"
                onClick={onSuggestWithAi}
                disabled={!aiScenarioId || generating || (isDestructive && !confirmReplace)}
              >
                {generating ? "Generating…" : isDestructive ? "Replace existing indicators" : "Suggest indicators"}
              </Button>
              <Button variant="ghost" onClick={resetAndClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
