"use client";

// StorylineCanvas — the bespoke causal-graph editor. Pointer-driven (like the Matrix):
// drag cards between phase columns, drag a card's "+" to create an arrow, grab an arrow
// endpoint to rewire, click an arrow for its popover, hover for a midpoint insert. Cycle
// detection prevents loops; backward-in-time edges are flagged amber. Faithful port of
// the handoff page-storyline.jsx canvas; dynamic positioning + SVG stay inline.
import * as React from "react";
import { Icons } from "@/lib/icons";
import { usePersistentState } from "@/lib/store";
import {
  CARD_W,
  COL_GAP,
  COL_PITCH,
  ROW_GAP,
  CAT_STYLE,
  DEFAULT_COLUMN_LABELS,
  edgeKey,
  enrichNode,
  type StoryData,
  type StoryNode,
  type StoryEdge,
} from "./data";
import { SignalCard, SignalCardPlaceholder } from "./signal-card";
import { ColumnHeader, ArrowPopover, EndpointHandle, StorylineEmptyState, OnboardingTooltip } from "./pieces";

type NodesUpdater = StoryNode[] | ((prev: StoryNode[]) => StoryNode[]);
type EdgesUpdater = StoryEdge[] | ((prev: StoryEdge[]) => StoryEdge[]);

interface Pos {
  left: number;
  right: number;
  top: number;
  bottom: number;
  midY: number;
  width: number;
  height: number;
}
interface Layout {
  width: number;
  height: number;
  positions: Record<string, Pos>;
}
type CardDrag = {
  kind: "card";
  id: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  w: number;
  h: number;
  overPhase: string | null;
  overIndex: number;
  moved: boolean;
};
type EdgeDrag = {
  kind: "edge";
  mode: "new" | "rewire";
  x: number;
  y: number;
  anchorId: string;
  anchorIsSource: boolean;
  dragEdgeKey?: string;
  overId: string | null;
  invalid: boolean;
};
type PointerDrag = CardDrag | EdgeDrag | null;

interface Highlighted {
  nodes: Set<string>;
  edges: Set<string>;
}

export interface StorylineCanvasProps {
  data: StoryData;
  scenarioColor: string;
  selected: string | null;
  setSelected: React.Dispatch<React.SetStateAction<string | null>>;
  highlighted: Highlighted | null;
  columnLabels: string[];
  setColumnLabels: (v: string[]) => void;
  nodes: StoryNode[];
  setNodes: (u: NodesUpdater) => void;
  edges: StoryEdge[];
  setEdges: (u: EdgesUpdater) => void;
  onAutoSuggest: () => void;
  onBrowseLibrary: () => void;
  showToast: (msg: string, kind?: "success" | "error") => void;
}

export function StorylineCanvas({
  data,
  scenarioColor,
  selected,
  setSelected,
  highlighted,
  columnLabels,
  setColumnLabels,
  nodes,
  setNodes,
  edges,
  setEdges,
  onAutoSuggest,
  onBrowseLibrary,
  showToast,
}: StorylineCanvasProps) {
  const [onboardSeen, setOnboardSeen] = usePersistentState("fm.storyOnboardSeen", false);
  const [tooltipFor, setTooltipFor] = React.useState<string | null>(null);
  const prevCount = React.useRef(nodes.length);
  React.useEffect(() => {
    if (prevCount.current === 0 && nodes.length > 0 && !onboardSeen) {
      setTooltipFor(nodes[0].id);
    }
    if (nodes.length === 0) setTooltipFor(null);
    prevCount.current = nodes.length;
  }, [nodes, onboardSeen]);
  const dismissTooltip = () => {
    setTooltipFor(null);
    setOnboardSeen(true);
  };

  const cardRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const containerRef = React.useRef<HTMLDivElement>(null);
  const columnRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const [layout, setLayout] = React.useState<Layout>({ width: 0, height: 0, positions: {} });

  const [hoveredEdge, setHoveredEdge] = React.useState<string | null>(null);
  const [popover, setPopover] = React.useState<{ key: string; x: number; y: number } | null>(null);
  const [pointerDrag, setPointerDrag] = React.useState<PointerDrag>(null);

  React.useLayoutEffect(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const positions: Record<string, Pos> = {};
    for (const id in cardRefs.current) {
      const el = cardRefs.current[id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      positions[id] = {
        left: r.left - containerRect.left,
        right: r.right - containerRect.left,
        top: r.top - containerRect.top,
        bottom: r.bottom - containerRect.top,
        midY: r.top - containerRect.top + r.height / 2,
        width: r.width,
        height: r.height,
      };
    }
    setLayout({ width: containerRect.width, height: containerRect.height, positions });
  }, [data, nodes, edges.length, pointerDrag && pointerDrag.kind === "card" ? `${pointerDrag.overPhase}:${pointerDrag.overIndex}` : null]);

  // Group nodes by phase, preserving local order.
  const nodesByPhase: Record<string, StoryNode[]> = {};
  data.phases.forEach((p) => (nodesByPhase[p.id] = []));
  nodes.forEach((n) => {
    if (nodesByPhase[n.phase]) nodesByPhase[n.phase].push(n);
    else nodesByPhase[data.phases[data.phases.length - 1].id].push(n);
  });

  const phaseIdx = React.useCallback((phaseId: string) => data.phases.findIndex((p) => p.id === phaseId), [data]);
  const isBackward = React.useCallback(
    (fromId: string, toId: string) => {
      const a = nodes.find((n) => n.id === fromId);
      const b = nodes.find((n) => n.id === toId);
      if (!a || !b) return false;
      return phaseIdx(a.phase) > phaseIdx(b.phase);
    },
    [nodes, phaseIdx]
  );

  const wouldCreateCycle = React.useCallback(
    (fromId: string, toId: string, ignoreEdgeKey: string | null = null) => {
      if (fromId === toId) return true;
      const adj: Record<string, string[]> = {};
      edges.forEach((e) => {
        if (ignoreEdgeKey && edgeKey(e) === ignoreEdgeKey) return;
        (adj[e.from] = adj[e.from] || []).push(e.to);
      });
      const stack = [toId];
      const seen = new Set([toId]);
      while (stack.length) {
        const n = stack.pop()!;
        const outs = adj[n] || [];
        for (const o of outs) {
          if (o === fromId) return true;
          if (!seen.has(o)) {
            seen.add(o);
            stack.push(o);
          }
        }
      }
      return false;
    },
    [edges]
  );

  // ─── Pointer drag — cards ───────────────────────────────────────────
  const startCardDrag = (id: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    const containerRect = containerRef.current!.getBoundingClientRect();
    const cardEl = cardRefs.current[id];
    if (!cardEl) return;
    const r = cardEl.getBoundingClientRect();
    setPopover(null);
    setPointerDrag({
      kind: "card",
      id,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top,
      offsetX: e.clientX - r.left,
      offsetY: e.clientY - r.top,
      w: r.width,
      h: r.height,
      overPhase: null,
      overIndex: -1,
      moved: false,
    });
  };

  const startEdgeRewire = (edgeK: string, which: "from" | "to") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const containerRect = containerRef.current!.getBoundingClientRect();
    const edge = edges.find((ed) => edgeKey(ed) === edgeK);
    if (!edge) return;
    const anchorId = which === "from" ? edge.to : edge.from;
    const anchorIsSource = which === "to";
    setPointerDrag({
      kind: "edge",
      mode: "rewire",
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top,
      anchorId,
      anchorIsSource,
      dragEdgeKey: edgeK,
      overId: null,
      invalid: false,
    });
  };
  const startCreateArrow = (fromId: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const containerRect = containerRef.current!.getBoundingClientRect();
    setPointerDrag({
      kind: "edge",
      mode: "new",
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top,
      anchorId: fromId,
      anchorIsSource: true,
      overId: null,
      invalid: false,
    });
  };

  // ─── Global pointer listeners while a drag is active ────────────────
  React.useEffect(() => {
    if (!pointerDrag) return;
    const containerRect = containerRef.current!.getBoundingClientRect();

    const onMove = (e: PointerEvent) => {
      const x = e.clientX - containerRect.left;
      const y = e.clientY - containerRect.top;
      setPointerDrag((d) => {
        if (!d) return d;
        if (d.kind === "card") {
          const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
          const moved = d.moved || dist > 4;
          let overPhase: string | null = null;
          let overIndex = -1;
          if (moved) {
            for (const phase of data.phases) {
              const colEl = columnRefs.current[phase.id];
              if (!colEl) continue;
              const cr = colEl.getBoundingClientRect();
              if (e.clientX >= cr.left - COL_GAP / 2 && e.clientX <= cr.right + COL_GAP / 2) {
                overPhase = phase.id;
                const slots = colEl.querySelectorAll("[data-card-slot]");
                let idx = slots.length;
                for (let i = 0; i < slots.length; i++) {
                  const sr = slots[i].getBoundingClientRect();
                  const mid = sr.top + sr.height / 2;
                  if (e.clientY < mid) {
                    idx = i;
                    break;
                  }
                }
                overIndex = idx;
                break;
              }
            }
          }
          return { ...d, x, y, overPhase, overIndex, moved };
        }
        // edge
        let overId: string | null = null;
        for (const id in layout.positions) {
          const p = layout.positions[id];
          if (x >= p.left && x <= p.right && y >= p.top && y <= p.bottom) {
            overId = id;
            break;
          }
        }
        let invalid = false;
        if (overId) {
          if (overId === d.anchorId) invalid = true;
          else if (d.mode === "new") {
            if (wouldCreateCycle(d.anchorId, overId)) invalid = true;
            if (edges.some((ed) => ed.from === d.anchorId && ed.to === overId)) invalid = true;
          } else {
            const newFrom = d.anchorIsSource ? d.anchorId : overId;
            const newTo = d.anchorIsSource ? overId : d.anchorId;
            if (newFrom === newTo) invalid = true;
            else if (wouldCreateCycle(newFrom, newTo, d.dragEdgeKey)) invalid = true;
            else if (edges.some((ed) => edgeKey(ed) !== d.dragEdgeKey && ed.from === newFrom && ed.to === newTo)) invalid = true;
          }
        }
        return { ...d, x, y, overId, invalid };
      });
    };

    const onUp = () => {
      setPointerDrag((prev) => {
        if (!prev) return null;
        if (prev.kind === "card") {
          if (!prev.moved) {
            setSelected((cur) => (cur === prev.id ? null : prev.id));
          } else if (prev.overPhase) {
            const targetIdx = prev.overIndex < 0 ? 0 : prev.overIndex;
            setNodes((ns) => {
              const moving = ns.find((n) => n.id === prev.id);
              if (!moving) return ns;
              const without = ns.filter((n) => n.id !== prev.id);
              const phaseStart = without.findIndex((n) => n.phase === prev.overPhase);
              const insertAt = phaseStart === -1 ? without.length : phaseStart + targetIdx;
              return [...without.slice(0, insertAt), { ...moving, phase: prev.overPhase! }, ...without.slice(insertAt)];
            });
            showToast("Saved");
          }
        } else {
          if (prev.overId && !prev.invalid) {
            if (prev.mode === "new") {
              const newEdge: StoryEdge = { from: prev.anchorId, to: prev.overId, relationship: "Leads to", confidence: "Moderate" };
              setEdges((es) => [...es, newEdge]);
              setTimeout(() => {
                const from = layout.positions[newEdge.from];
                const to = layout.positions[newEdge.to];
                if (from && to) {
                  setPopover({ key: edgeKey(newEdge), x: (from.right + to.left) / 2, y: (from.midY + to.midY) / 2 });
                }
              }, 0);
              showToast("Connection created");
            } else {
              const newFrom = prev.anchorIsSource ? prev.anchorId : prev.overId;
              const newTo = prev.anchorIsSource ? prev.overId : prev.anchorId;
              setEdges((es) => es.map((ed) => (edgeKey(ed) === prev.dragEdgeKey ? { ...ed, from: newFrom, to: newTo } : ed)));
              showToast("Connection updated");
            }
          } else if (prev.overId && prev.invalid) {
            if (prev.overId === prev.anchorId) {
              // dropped on source — silent snap-back
            } else if (prev.mode === "new" && wouldCreateCycle(prev.anchorId, prev.overId)) {
              showToast("Circular connection not allowed", "error");
            } else if (prev.mode === "rewire") {
              const newFrom = prev.anchorIsSource ? prev.anchorId : prev.overId;
              const newTo = prev.anchorIsSource ? prev.overId : prev.anchorId;
              if (wouldCreateCycle(newFrom, newTo, prev.dragEdgeKey)) showToast("Circular connection not allowed", "error");
            }
          }
        }
        return null;
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointerDrag && pointerDrag.kind, data, layout, edges, wouldCreateCycle]);

  // ─── Insert / edge edits ────────────────────────────────────────────
  const insertBetween = (edge: StoryEdge) => {
    const fromNode = nodes.find((n) => n.id === edge.from);
    const toNode = nodes.find((n) => n.id === edge.to);
    if (!fromNode || !toNode) return;
    const fromIdx = data.phases.findIndex((p) => p.id === fromNode.phase);
    const toIdx = data.phases.findIndex((p) => p.id === toNode.phase);
    let midIdx = Math.round((fromIdx + toIdx) / 2);
    if (midIdx === fromIdx) midIdx = Math.min(data.phases.length - 1, fromIdx + 1);
    if (midIdx === toIdx) midIdx = Math.max(0, toIdx - 1);
    if (midIdx === fromIdx) midIdx = toIdx;
    const newPhase = data.phases[midIdx].id;
    const newId = "ins" + Date.now().toString(36);
    const newNode = enrichNode({
      id: newId,
      phase: newPhase,
      cat: fromNode.cat,
      title: "New signal",
      body: "Click Edit to describe how this links the chain.",
      year: "—",
      strength: 0.5,
      source: "Draft",
      uncertainty: "Medium",
      impact: 3,
    });
    setNodes((ns) => [...ns, newNode]);
    setEdges((es) => [
      ...es.filter((e) => !(e.from === edge.from && e.to === edge.to)),
      { from: edge.from, to: newId, relationship: edge.relationship || "Leads to", confidence: "Moderate" },
      { from: newId, to: edge.to, relationship: "Leads to", confidence: "Moderate" },
    ]);
    setHoveredEdge(null);
    setPopover(null);
    setSelected(newId);
    showToast("Signal inserted");
  };

  const updateEdge = (key: string, patch: Partial<StoryEdge>) => {
    setEdges((es) => es.map((e) => (edgeKey(e) === key ? { ...e, ...patch } : e)));
    showToast("Saved");
  };
  const removeEdge = (key: string) => {
    setEdges((es) => es.filter((e) => edgeKey(e) !== key));
    setPopover(null);
    showToast("Connection removed");
  };

  React.useEffect(() => {
    if (!popover) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopover(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popover]);

  // Empty state — after all hooks so hook count is stable.
  if (nodes.length === 0) {
    return <StorylineEmptyState onAutoSuggest={onAutoSuggest} onBrowseLibrary={onBrowseLibrary} />;
  }

  const TOTAL_W = 5 * CARD_W + 4 * COL_GAP;

  return (
    <div style={{ minWidth: TOTAL_W + 48, padding: "0 24px", position: "relative" }}>
      {/* Column headers */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(5, ${CARD_W}px)`, columnGap: COL_GAP, marginBottom: 18 }}>
        {data.phases.map((p, i) => (
          <ColumnHeader
            key={p.id}
            index={i}
            label={columnLabels[i] || DEFAULT_COLUMN_LABELS[i]}
            range={p.range}
            desc={p.desc}
            scenarioColor={scenarioColor}
            onChange={(v) => {
              const next = [...columnLabels];
              while (next.length < 5) next.push(DEFAULT_COLUMN_LABELS[next.length]);
              next[i] = v;
              setColumnLabels(next);
            }}
          />
        ))}
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(5, ${CARD_W}px)`, columnGap: COL_GAP, rowGap: ROW_GAP, paddingTop: 4 }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setPopover(null);
            setSelected(null);
          }
        }}
      >
        {/* Dotted column dividers */}
        {[1, 2, 3, 4].map((i) => (
          <div
            key={"div-" + i}
            aria-hidden
            style={{ position: "absolute", top: -28, bottom: -12, left: i * COL_PITCH - COL_GAP / 2, width: 0, borderLeft: "1px dashed #E5E7EB", pointerEvents: "none", zIndex: 0 }}
          />
        ))}

        {/* SVG arrows */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", zIndex: 3, pointerEvents: "none" }} width={layout.width} height={layout.height}>
          <defs>
            <marker id="fm-arrow-default" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#6B7280" />
            </marker>
            <marker id="fm-arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#F97316" />
            </marker>
            <marker id="fm-arrow-scenario" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={scenarioColor} />
            </marker>
            <marker id="fm-arrow-amber" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#F59E0B" />
            </marker>
          </defs>
          {edges.map((e) => {
            const from = layout.positions[e.from];
            const to = layout.positions[e.to];
            if (!from || !to) return null;
            const k = edgeKey(e);
            const beingDragged = pointerDrag && pointerDrag.kind === "edge" && pointerDrag.mode === "rewire" && pointerDrag.dragEdgeKey === k;
            if (beingDragged) return null;

            const backward = isBackward(e.from, e.to);
            const isHovered = hoveredEdge === k || (popover && popover.key === k);
            const onPath = highlighted && highlighted.edges.has(k);
            const dim = highlighted && !onPath && !isHovered;
            const x1 = from.right;
            const y1 = from.midY;
            const x2 = to.left - 4;
            const y2 = to.midY;
            const cx = (x1 + x2) / 2;
            const d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;

            let stroke: string, marker: string, strokeWidth: number, opacity: number;
            if (isHovered) {
              stroke = "#F97316";
              marker = "fm-arrow-active";
              strokeWidth = 3;
              opacity = 1;
            } else if (backward) {
              stroke = "#F59E0B";
              marker = "fm-arrow-amber";
              strokeWidth = 2.25;
              opacity = 1;
            } else if (onPath) {
              stroke = scenarioColor;
              marker = "fm-arrow-scenario";
              strokeWidth = 2.25;
              opacity = 1;
            } else {
              stroke = "#6B7280";
              marker = "fm-arrow-default";
              strokeWidth = 2;
              opacity = dim ? 0.18 : 0.65;
            }

            return (
              <g key={k}>
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                  style={{ cursor: "pointer", pointerEvents: pointerDrag ? "none" : "stroke" }}
                  onMouseEnter={() => setHoveredEdge(k)}
                  onMouseLeave={() => setHoveredEdge(null)}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    const rect = containerRef.current!.getBoundingClientRect();
                    setPopover({ key: k, x: ev.clientX - rect.left, y: ev.clientY - rect.top });
                  }}
                />
                <path
                  d={d}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeOpacity={opacity}
                  markerEnd={`url(#${marker})`}
                  pointerEvents="none"
                  style={{ transition: "stroke .2s ease, stroke-width .15s ease, stroke-opacity .15s ease" }}
                />
              </g>
            );
          })}

          {/* Live preview line during edge create / rewire */}
          {pointerDrag &&
            pointerDrag.kind === "edge" &&
            (() => {
              const anchor = layout.positions[pointerDrag.anchorId];
              if (!anchor) return null;
              const ax = pointerDrag.anchorIsSource ? anchor.right : anchor.left;
              const ay = anchor.midY;
              const bx = pointerDrag.x;
              const by = pointerDrag.y;
              const x1 = pointerDrag.anchorIsSource ? ax : bx;
              const y1 = pointerDrag.anchorIsSource ? ay : by;
              const x2 = pointerDrag.anchorIsSource ? bx : ax;
              const y2 = pointerDrag.anchorIsSource ? by : ay;
              const mx = (x1 + x2) / 2;
              const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
              const color = pointerDrag.invalid ? "#EF4444" : "#F97316";
              return (
                <g pointerEvents="none">
                  <path d={d} fill="none" stroke={color} strokeWidth={2.25} strokeDasharray="4 4" strokeLinecap="round" opacity="0.95" />
                  <circle cx={x2} cy={y2} r={4} fill={color} />
                </g>
              );
            })()}
        </svg>

        {/* Midpoint "+" insert buttons */}
        {!pointerDrag &&
          edges.map((e) => {
            const from = layout.positions[e.from];
            const to = layout.positions[e.to];
            if (!from || !to) return null;
            const k = edgeKey(e);
            const show = hoveredEdge === k || (popover && popover.key === k);
            if (!show) return null;
            const cx = (from.right + to.left) / 2;
            const cy = (from.midY + to.midY) / 2;
            return (
              <button
                key={k + "-ins"}
                title="Insert signal here"
                onClick={(ev) => {
                  ev.stopPropagation();
                  insertBetween(e);
                }}
                onMouseEnter={() => setHoveredEdge(k)}
                onMouseLeave={() => setHoveredEdge(null)}
                style={{
                  position: "absolute",
                  left: cx - 11,
                  top: cy - 11,
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  border: "1.5px solid #F97316",
                  background: "#fff",
                  color: "#F97316",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  boxShadow: "0 2px 8px rgba(249,115,22,0.28)",
                  zIndex: 12,
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            );
          })}

        {/* Arrow endpoint handles */}
        {!pointerDrag &&
          edges.map((e) => {
            const from = layout.positions[e.from];
            const to = layout.positions[e.to];
            if (!from || !to) return null;
            const k = edgeKey(e);
            const show = hoveredEdge === k || (popover && popover.key === k);
            if (!show) return null;
            return (
              <React.Fragment key={k + "-handles"}>
                <EndpointHandle cx={from.right} cy={from.midY} onPointerDown={startEdgeRewire(k, "from")} title="Drag to change source" />
                <EndpointHandle cx={to.left - 4} cy={to.midY} onPointerDown={startEdgeRewire(k, "to")} title="Drag to change target" />
              </React.Fragment>
            );
          })}

        {/* Phase columns */}
        {data.phases.map((phase) => {
          const items = nodesByPhase[phase.id] || [];
          const cardDragging = pointerDrag && pointerDrag.kind === "card";
          const showPlaceholderAt = cardDragging && pointerDrag.overPhase === phase.id ? pointerDrag.overIndex : -1;
          const isActiveColumn = cardDragging && pointerDrag.overPhase === phase.id;
          return (
            <div
              key={phase.id}
              ref={(el) => {
                columnRefs.current[phase.id] = el;
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: ROW_GAP,
                position: "relative",
                zIndex: 2,
                minHeight: 200,
                padding: isActiveColumn ? 6 : 0,
                margin: isActiveColumn ? -6 : 0,
                borderRadius: 12,
                background: isActiveColumn ? "#FFF7ED" : "transparent",
                border: isActiveColumn ? "2px dashed #F97316" : "2px dashed transparent",
                transition: "background .12s ease, border-color .12s ease",
              }}
            >
              {items.map((node, idx) => {
                const isSelected = selected === node.id;
                const inPath = highlighted ? highlighted.nodes.has(node.id) : false;
                const dim = highlighted && !inPath;
                const isDragging = cardDragging && pointerDrag.id === node.id && pointerDrag.moved;
                const isEdgeDropTarget = pointerDrag && pointerDrag.kind === "edge" && pointerDrag.overId === node.id && !pointerDrag.invalid;
                return (
                  <React.Fragment key={node.id}>
                    {showPlaceholderAt === idx && cardDragging && pointerDrag.id !== node.id && <SignalCardPlaceholder />}
                    <div
                      data-card-slot
                      ref={(el) => {
                        cardRefs.current[node.id] = el;
                      }}
                    >
                      <SignalCard
                        node={node}
                        selected={isSelected}
                        dim={!!dim}
                        dragging={!!isDragging}
                        isDropTarget={!!isEdgeDropTarget}
                        onEdit={() => setSelected(node.id)}
                        onCardPointerDown={startCardDrag(node.id)}
                        onConnectorPointerDown={startCreateArrow(node.id)}
                        accentColor={scenarioColor}
                      />
                    </div>
                  </React.Fragment>
                );
              })}
              {showPlaceholderAt >= items.length && cardDragging && pointerDrag.id && <SignalCardPlaceholder />}

              {/* Add slot */}
              <button
                style={{
                  border: "1.5px dashed #E5E7EB",
                  borderRadius: 10,
                  padding: 10,
                  background: "transparent",
                  color: "#9CA3AF",
                  cursor: "pointer",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  width: CARD_W,
                  transition: "border .12s ease, color .12s ease, background .12s ease",
                }}
                onMouseEnter={(ev) => {
                  ev.currentTarget.style.borderColor = "#FED7AA";
                  ev.currentTarget.style.color = "#C2410C";
                  ev.currentTarget.style.background = "#FFF7ED";
                }}
                onMouseLeave={(ev) => {
                  ev.currentTarget.style.borderColor = "#E5E7EB";
                  ev.currentTarget.style.color = "#9CA3AF";
                  ev.currentTarget.style.background = "transparent";
                }}
              >
                <Icons.Plus size={12} /> Add signal
              </button>
            </div>
          );
        })}

        {/* Dragging card ghost */}
        {pointerDrag &&
          pointerDrag.kind === "card" &&
          pointerDrag.moved &&
          (() => {
            const node = nodes.find((n) => n.id === pointerDrag.id);
            if (!node) return null;
            return (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: pointerDrag.x - pointerDrag.offsetX,
                  top: pointerDrag.y - pointerDrag.offsetY,
                  width: pointerDrag.w,
                  pointerEvents: "none",
                  transform: "rotate(2deg) scale(1.05)",
                  opacity: 0.95,
                  filter: "drop-shadow(0 18px 36px rgba(15,23,42,0.18)) drop-shadow(0 4px 10px rgba(15,23,42,0.12))",
                  zIndex: 60,
                }}
              >
                <SignalCard node={node} accentColor={scenarioColor} />
              </div>
            );
          })()}

        {/* Invalid-drop cursor cue */}
        {pointerDrag && pointerDrag.kind === "edge" && pointerDrag.invalid && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: pointerDrag.x - 11,
              top: pointerDrag.y - 11,
              width: 22,
              height: 22,
              borderRadius: 999,
              border: "2px solid #EF4444",
              background: "rgba(255,255,255,0.95)",
              pointerEvents: "none",
              zIndex: 61,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#EF4444",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <line x1="5.5" y1="5.5" x2="18.5" y2="18.5" />
            </svg>
          </div>
        )}

        {/* Onboarding tooltip */}
        {tooltipFor && layout.positions[tooltipFor] && <OnboardingTooltip anchor={layout.positions[tooltipFor]} onDismiss={dismissTooltip} />}

        {/* Popover */}
        {popover &&
          (() => {
            const edge = edges.find((e) => edgeKey(e) === popover.key);
            if (!edge) return null;
            return (
              <ArrowPopover
                edge={edge}
                x={popover.x}
                y={popover.y}
                containerWidth={layout.width}
                onChange={(patch) => updateEdge(popover.key, patch)}
                onRemove={() => removeEdge(popover.key)}
                onClose={() => setPopover(null)}
              />
            );
          })()}
      </div>

      {/* Footer legend */}
      <div style={{ marginTop: 24, padding: "14px 18px", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "var(--font-mono)", letterSpacing: ".06em" }}>LEGEND</span>
        {Object.entries(CAT_STYLE).map(([cat, c]) => (
          <div key={cat} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6B7280" }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, background: c.dot }} />
            {cat}
          </div>
        ))}
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#6B7280", display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <svg width="34" height="10" viewBox="0 0 34 10">
              <path d="M 1 5 C 12 5, 22 5, 30 5" stroke="#F59E0B" strokeWidth="2" fill="none" />
              <path d="M 28 2 L 32 5 L 28 8 z" fill="#F59E0B" />
            </svg>
            Backward in time
          </span>
          <span style={{ color: "#D1D5DB" }}>·</span>
          <span>Grab an arrow endpoint to rewire · Drag the &quot;+&quot; off a card to connect</span>
        </div>
      </div>

      {/* Drag cursor */}
      {pointerDrag && <style>{`body { cursor: ${pointerDrag.kind === "edge" && pointerDrag.invalid ? "not-allowed" : "grabbing"} !important; }`}</style>}
    </div>
  );
}
