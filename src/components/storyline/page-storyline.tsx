"use client";

// Storyline page — causal chain of signals showing HOW a scenario unfolds, backed by the
// real generation pipeline (autoSuggestStoryline + generateScenarioGrounding, exposed via
// POST .../generate, POST .../refresh-grounding, GET .../storyline — all synchronous, so
// "generating" is just the UI state while that fetch is in flight, no polling needed).
import * as React from "react";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { useStore, usePersistentState } from "@/lib/store";
import { useNavigate } from "@/lib/use-navigate";
import type { Database } from "@/lib/supabase/types";
import { REAL_PHASES, toStoryNode, toStoryEdge, computeChainConfidence } from "./story-adapter";
import { DEFAULT_COLUMN_LABELS, edgeKey, type StoryNode, type StoryEdge } from "./data";
import { ScenarioContextHeader } from "./scenario-context-header";
import { StorylineCanvas } from "./canvas";
import { StorylineSidePanel, StorylineToast, type StorylineToastState } from "./pieces";
import { SignalPickerModal } from "./signal-picker-modal";

type ScenarioStorylineRow = Database["public"]["Tables"]["scenario_storylines"]["Row"];
type PlausibilityCheckRow = Database["public"]["Tables"]["plausibility_checks"]["Row"];
type SignpostRow = Database["public"]["Tables"]["signposts"]["Row"];

interface StorylineApiResult {
  storyline: ScenarioStorylineRow | null;
  nodes: Database["public"]["Tables"]["storyline_nodes"]["Row"][];
  edges: Database["public"]["Tables"]["storyline_edges"]["Row"][];
  plausibility: PlausibilityCheckRow | null;
  signposts: SignpostRow[];
}

async function loadStoryline(scenarioId: string): Promise<StorylineApiResult> {
  const res = await fetch(`/api/scenarios/${scenarioId}/storyline`);
  if (!res.ok) throw new Error(`Failed to load storyline (${res.status}).`);
  return res.json();
}

export function PageStoryline() {
  const store = useStore();
  const navigate = useNavigate();
  const scenarios = store.scenarios;
  const [scenarioId] = usePersistentState<string>("fm.storylineScenario", (scenarios[0] && scenarios[0].id) || "sc1");
  const scenario =
    scenarios.find((s) => s.id === scenarioId) ||
    scenarios[0] || { id: scenarioId, name: "Scenario", color: "#F97316", tagline: "", quadrant: "TR" as const };
  const [selected, setSelected] = React.useState<string | null>(null);

  const [columnLabels, setColumnLabels] = usePersistentState<string[]>("fm.storyColumnLabels", DEFAULT_COLUMN_LABELS);
  const [panelOpen, setPanelOpen] = usePersistentState("fm.storyPanelOpen", true);
  const [addModalOpen, setAddModalOpen] = React.useState(false);
  // Set when the modal is opened from a specific phase column's "+ Add signal" slot, so the
  // modal can pre-select that column instead of its own fewest-nodes default.
  const [modalInitialPhase, setModalInitialPhase] = React.useState<string | undefined>(undefined);

  // Page-level toast
  const [toast, setToast] = React.useState<StorylineToastState | null>(null);
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1700);
    return () => clearTimeout(t);
  }, [toast]);
  const showToast = React.useCallback(
    (msg: string, kind: "success" | "error" = "success") => setToast({ msg, kind, ts: Date.now() }),
    []
  );

  // ─── Real data load ───────────────────────────────────────────────────
  const [loaded, setLoaded] = React.useState<StorylineApiResult | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [generating, setGenerating] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    if (!scenarioId) return;
    let cancelled = false;
    setLoaded(null);
    setLoadError(null);
    loadStoryline(scenarioId)
      .then((result) => {
        if (!cancelled) setLoaded(result);
      })
      .catch((err) => {
        console.error("[storyline] failed to load", err);
        if (!cancelled) setLoadError("Couldn't load this scenario's storyline.");
      });
    return () => {
      cancelled = true;
    };
  }, [scenarioId]);

  const [nodes, setNodes] = React.useState<StoryNode[]>([]);
  const [edges, setEdges] = React.useState<StoryEdge[]>([]);
  React.useEffect(() => {
    if (!loaded) return;
    setNodes(loaded.nodes.map((n) => toStoryNode(n, n.signal_id ? store.signals.find((s) => s.id === n.signal_id) : undefined)));
    setEdges(loaded.edges.map(toStoryEdge));
    setSelected(null);
    // Deliberately not depending on store.signals — an unrelated global signals refresh
    // shouldn't clobber in-progress local edits between reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const reload = React.useCallback(async () => {
    try {
      setLoaded(await loadStoryline(scenarioId));
    } catch (err) {
      console.error("[storyline] failed to reload", err);
    }
  }, [scenarioId]);

  const runGenerate = React.useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/scenarios/${scenarioId}/storyline/generate`, { method: "POST" });
      if (!res.ok) throw new Error(`Generate failed (${res.status}).`);
    } catch (err) {
      console.error("[storyline] generate request failed", err);
      showToast("Couldn't generate the storyline", "error");
    } finally {
      await reload();
      setGenerating(false);
    }
  }, [scenarioId, reload, showToast]);

  // Calls the same Ask AI "Validate plausibility" task as the storyline-mode Ask AI menu
  // (ai-storyline-tasks.ts's validateStorylinePlausibility) — not /refresh-grounding, which
  // is signposts+plausibility combined; this is plausibility only, no web search, reasoning
  // over the chain itself. The side panel only renders score/rationale/checked-at, same as
  // before — the richer per-weak-link breakdown this task also returns is shown in the Ask AI
  // drawer, not here.
  const runRefreshGrounding = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/scenarios/${scenarioId}/storyline/ask-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "validate_plausibility" }),
      });
      if (!res.ok) throw new Error(`Refresh failed (${res.status}).`);
      showToast("Plausibility refreshed");
    } catch (err) {
      console.error("[storyline] validate-plausibility request failed", err);
      showToast("Refresh failed", "error");
    } finally {
      await reload();
      setRefreshing(false);
    }
  }, [scenarioId, reload, showToast]);

  const status = generating ? "generating" : (loaded?.storyline?.status ?? "not_generated");
  const errorMessage = loaded?.storyline?.error_message ?? null;

  // Evidentiary strength of the chain itself — a formula, not the AI-assessed Plausibility
  // judgment shown in the side panel (deliberately distinct concepts, see story-adapter.ts).
  const confidence = React.useMemo(() => computeChainConfidence(nodes, edges), [nodes, edges]);

  // Highlight path from a selected node (ancestors + descendants).
  const highlighted = React.useMemo(() => {
    if (!selected) return null;
    const ancestors = new Set([selected]);
    const descendants = new Set([selected]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of edges) {
        if (descendants.has(e.from) && !descendants.has(e.to)) {
          descendants.add(e.to);
          changed = true;
        }
        if (ancestors.has(e.to) && !ancestors.has(e.from)) {
          ancestors.add(e.from);
          changed = true;
        }
      }
    }
    const allEdges = edges.filter(
      (e) => (descendants.has(e.from) && descendants.has(e.to)) || (ancestors.has(e.from) && ancestors.has(e.to))
    );
    const nodeSet = new Set<string>(ancestors);
    descendants.forEach((d) => nodeSet.add(d));
    return { nodes: nodeSet, edges: new Set(allEdges.map(edgeKey)) };
  }, [selected, edges]);

  // Keeps the Ask AI drawer (mounted in AppShell, a sibling of this page) current on which
  // scenario + highlighted path to scope "Validate this chain"/"Explain this chain" to, and
  // node titles (every node, not just the highlighted subset) so its results can name nodes
  // instead of showing raw ids.
  React.useEffect(() => {
    store.setStorylineAskAiContext({
      scenarioId,
      nodeIds: highlighted ? Array.from(highlighted.nodes) : [],
      nodeTitleById: Object.fromEntries(nodes.map((n) => [n.id, n.title])),
    });
    return () => store.setStorylineAskAiContext(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId, highlighted, nodes]);

  if (loadError) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">{loadError}</div>
    );
  }

  return (
    <div data-screen-label="App · storyline" className="flex flex-1 flex-col overflow-hidden">
      {/* Scenario context header + actions */}
      <div className="flex flex-shrink-0 items-start gap-4 border-b border-border bg-white px-6">
        <div className="min-w-0 flex-1">
          <ScenarioContextHeader view="storyline" />
        </div>
        <div className="flex items-center gap-2.5 pt-6">
          <Button variant="primary" size="sm" onClick={() => navigate("/narrative")}>
            Develop narratives <Icons.ArrowRight size={12} />
          </Button>
        </div>
      </div>

      {/* Summary bar — stats */}
      <div className="flex items-center gap-6 border-b border-border bg-white px-6 py-3">
        <div className="ml-auto flex items-center gap-[18px] text-xs text-muted-foreground">
          <div>
            <div className="font-mono text-[10.5px] tracking-[0.06em] text-text-3">SIGNALS</div>
            <div className="font-mono text-[18px] font-semibold tracking-[-0.02em] text-brand-dark">{nodes.length}</div>
          </div>
          <div>
            <div className="font-mono text-[10.5px] tracking-[0.06em] text-text-3">LINKS</div>
            <div className="font-mono text-[18px] font-semibold tracking-[-0.02em] text-brand-dark">{edges.length}</div>
          </div>
          <div className="w-[140px]">
            <div className="font-mono text-[10.5px] tracking-[0.06em] text-text-3">CONFIDENCE</div>
            <div className="mt-1 flex items-center gap-1.5">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F3F4F6]">
                <div className="h-full" style={{ width: confidence + "%", background: scenario.color }} />
              </div>
              <span className="font-mono text-xs font-semibold" style={{ color: scenario.color }}>
                {nodes.length > 0 ? `${confidence}%` : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main row: canvas + context panel */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="scroll-y flex-1 overflow-auto bg-bg py-6">
          {!loaded ? (
            <div className="flex min-h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <StorylineCanvas
              phases={REAL_PHASES}
              scenarioColor={scenario.color}
              selected={selected}
              setSelected={setSelected}
              highlighted={highlighted}
              columnLabels={columnLabels}
              setColumnLabels={setColumnLabels}
              nodes={nodes}
              setNodes={setNodes}
              edges={edges}
              setEdges={setEdges}
              scenarioId={scenarioId}
              generationStatus={status}
              generationError={errorMessage}
              onGenerate={runGenerate}
              onBrowseLibrary={() => {
                setModalInitialPhase(undefined);
                setAddModalOpen(true);
              }}
              onAddSignalToPhase={(phaseId) => {
                setModalInitialPhase(phaseId);
                setAddModalOpen(true);
              }}
              showToast={showToast}
            />
          )}
        </div>
        <StorylineSidePanel
          open={panelOpen}
          onToggle={() => setPanelOpen(!panelOpen)}
          scenario={scenario}
          scenarioId={scenarioId}
          nodes={nodes}
          edges={edges}
          plausibility={loaded?.plausibility ?? null}
          onRefreshGrounding={runRefreshGrounding}
          refreshing={refreshing}
          signposts={loaded?.signposts ?? []}
          showToast={showToast}
        />
      </div>

      {/* Page-level toast */}
      <StorylineToast toast={toast} />

      {/* Add-signal modal */}
      <SignalPickerModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        initialPlacement={modalInitialPhase}
        scenarioId={scenarioId}
        nodes={nodes}
        edges={edges}
        phases={REAL_PHASES}
        columnLabels={columnLabels}
        setNodes={setNodes}
        setEdges={setEdges}
        showToast={showToast}
      />
    </div>
  );
}
