"use client";

// Storyline page — causal chain of signals showing HOW a scenario unfolds.
// Faithful Tailwind/shadcn port of the handoff page-storyline.jsx PageStoryline.
import * as React from "react";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { useStore, usePersistentState } from "@/lib/store";
import { STORYLINE_DATA, DEFAULT_COLUMN_LABELS, edgeKey, enrichNode, type StoryNode, type StoryEdge } from "./data";
import { ScenarioContextHeader } from "./scenario-context-header";
import { StorylineCanvas } from "./canvas";
import { StorylineSidePanel, StorylineToast, type StorylineToastState } from "./pieces";
import { SignalPickerModal } from "./signal-picker-modal";

export function PageStoryline() {
  const store = useStore();
  const scenarios = store.scenarios;
  const [scenarioId] = usePersistentState<string>("fm.storylineScenario", (scenarios[0] && scenarios[0].id) || "sc1");
  const data = STORYLINE_DATA[scenarioId] || STORYLINE_DATA.sc1;
  const scenario =
    scenarios.find((s) => s.id === scenarioId) ||
    scenarios[0] || { id: scenarioId, name: "Scenario", color: "#F97316", tagline: "", quadrant: "TR" };
  const [selected, setSelected] = React.useState<string | null>(null);

  const [columnLabels, setColumnLabels] = usePersistentState<string[]>("fm.storyColumnLabels", DEFAULT_COLUMN_LABELS);
  const [panelOpen, setPanelOpen] = usePersistentState("fm.storyPanelOpen", true);
  const [addModalOpen, setAddModalOpen] = React.useState(false);

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

  // Per-scenario editable copies of edges + nodes.
  const [edgesByScenario, setEdgesByScenario] = React.useState<Record<string, StoryEdge[]>>(() => {
    const out: Record<string, StoryEdge[]> = {};
    Object.keys(STORYLINE_DATA).forEach((k) => (out[k] = STORYLINE_DATA[k].edges.map((e) => ({ ...e }))));
    return out;
  });
  const [nodesByScenario, setNodesByScenario] = React.useState<Record<string, StoryNode[]>>(() => {
    const out: Record<string, StoryNode[]> = {};
    Object.keys(STORYLINE_DATA).forEach((k) => (out[k] = STORYLINE_DATA[k].nodes.map(enrichNode)));
    return out;
  });

  const dataKey = edgesByScenario[scenarioId] ? scenarioId : "sc1";
  const edges = edgesByScenario[dataKey] || [];
  const nodes = nodesByScenario[dataKey] || [];
  const setEdges = (updater: StoryEdge[] | ((prev: StoryEdge[]) => StoryEdge[])) =>
    setEdgesByScenario((prev) => ({ ...prev, [dataKey]: typeof updater === "function" ? updater(prev[dataKey]) : updater }));
  const setNodes = (updater: StoryNode[] | ((prev: StoryNode[]) => StoryNode[])) =>
    setNodesByScenario((prev) => ({ ...prev, [dataKey]: typeof updater === "function" ? updater(prev[dataKey]) : updater }));

  const clearChain = () => {
    setNodes([]);
    setEdges([]);
    setSelected(null);
    try {
      localStorage.removeItem("fm.storyOnboardSeen");
    } catch {}
  };
  const autoSuggestChain = () => {
    const fresh = STORYLINE_DATA[scenarioId];
    if (!fresh) return;
    setNodes(fresh.nodes.map(enrichNode));
    setEdges(fresh.edges.map((e) => ({ ...e })));
    setSelected(null);
  };

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

  return (
    <div data-screen-label="App · storyline" className="flex flex-1 flex-col overflow-hidden">
      {/* Scenario context header + actions */}
      <div className="flex flex-shrink-0 items-start gap-4 border-b border-border bg-white px-6">
        <div className="min-w-0 flex-1">
          <ScenarioContextHeader view="storyline" />
        </div>
        <div className="flex items-center gap-2.5 pt-6">
          {nodes.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearChain} title="Clear the chain to see the empty state">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M 19 6 l -1 14 a 2 2 0 0 1 -2 2 H 8 a 2 2 0 0 1 -2 -2 L 5 6" />
              </svg>
              Clear
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={() => setAddModalOpen(true)}>
            <Icons.Plus size={12} /> Add Signal to Chain
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
                <div className="h-full" style={{ width: data.confidence * 100 + "%", background: scenario.color }} />
              </div>
              <span className="font-mono text-xs font-semibold" style={{ color: scenario.color }}>
                {Math.round(data.confidence * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main row: canvas + context panel */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="scroll-y flex-1 overflow-auto bg-bg py-6">
          <StorylineCanvas
            data={data}
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
            onAutoSuggest={autoSuggestChain}
            onBrowseLibrary={() => setAddModalOpen(true)}
            showToast={showToast}
          />
        </div>
        <StorylineSidePanel open={panelOpen} onToggle={() => setPanelOpen(!panelOpen)} scenario={scenario} data={data} nodes={nodes} edges={edges} />
      </div>

      {/* Page-level toast */}
      <StorylineToast toast={toast} />

      {/* Add-signal modal (stub; full picker in #12) */}
      <SignalPickerModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        scenarioId={scenarioId}
        nodes={nodes}
        edges={edges}
        phases={data.phases}
        columnLabels={columnLabels}
        setNodes={setNodes}
        setEdges={setEdges}
        showToast={showToast}
      />
    </div>
  );
}
