// SignalCard — the timeline node component used on the Storyline page.
// States: default, hover, selected, dragging, placeholder, dimmed.
//
// Drag/arrow protocol (pointer-driven, owned by the canvas):
//   onGripPointerDown(e)       — start moving this card
//   onConnectorPointerDown(e)  — start creating a new outgoing arrow
//   dragging                   — visual ghost state (handled here)
//
// Props:
//   node         — the signal node ({ id, cat, title, body, year, source, impact, uncertainty })
//   selected     — bool: this card is the click-selected one
//   dim          — bool: this card is outside the highlighted causal path
//   dragging     — bool: this card is currently being dragged (renders ghost)
//   isDropTarget — bool: this card is the live drop target for an arrow drag
//   onClick      — () => void
//   onEdit       — () => void  (called from "Edit chain" link)
//   onGripPointerDown      — (e) => void
//   onConnectorPointerDown — (e) => void
//   accentColor  — used for selected ring; defaults to brand orange

const CARD_W = 260;
const CARD_MIN_H = 140;

const UNCERTAINTY_STYLE = {
  High:   { bg: "#FEF2F2", fg: "#EF4444" },
  Medium: { bg: "#FFFBEB", fg: "#F59E0B" },
  Low:    { bg: "#ECFDF5", fg: "#10B981" },
};

function ImpactStars({ value = 0, max = 5, size = 11 }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }} aria-label={`Impact ${value} of ${max}`}>
      {Array.from({ length: max }).map((_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24"
          fill={i < value ? "#F97316" : "#E5E7EB"} stroke="none">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
    </span>
  );
}

const SignalCard = React.forwardRef(function SignalCard(props, ref) {
  const {
    node, selected = false, dim = false, dragging = false, isDropTarget = false,
    onClick, onEdit,
    onCardPointerDown, onConnectorPointerDown,
    accentColor = "#F97316",
  } = props;

  const [hover, setHover] = React.useState(false);
  const u = UNCERTAINTY_STYLE[node.uncertainty] || UNCERTAINTY_STYLE.Medium;

  // Resolve border + shadow per state.
  let borderColor = "#E5E7EB";
  let borderWidth = 1;
  let boxShadow = "none";
  if (selected) {
    borderColor = accentColor;
    borderWidth = 2;
    boxShadow = `0 0 0 2px ${accentColor}33, 0 4px 12px rgba(15,23,42,0.06)`;
  } else if (isDropTarget) {
    borderColor = accentColor;
    borderWidth = 2;
    boxShadow = `0 0 0 4px ${accentColor}26, 0 4px 14px rgba(15,23,42,0.10)`;
  } else if (hover && !dragging) {
    borderColor = accentColor;
    borderWidth = 1;
    boxShadow = "0 4px 14px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.04)";
  }

  // Dragging styles: the original card stays in place as a hollow placeholder.
  // The canvas renders the moving "ghost" using a separate copy at the cursor.
  const opacity = dragging ? 0.0 : (dim ? 0.4 : 1);

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onPointerDown={(e) => { if (e.button !== 0) return; onCardPointerDown && onCardPointerDown(e); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick && onClick(); } }}
      data-signal-card={node.id}
      style={{
        position: "relative",
        width: CARD_W,
        minHeight: CARD_MIN_H,
        background: "#fff",
        border: `${borderWidth}px solid ${borderColor}`,
        // Compensate the 1px border-width delta so neighbors don't shift.
        padding: (borderWidth === 2) ? 15 : 16,
        borderRadius: 10,
        boxShadow,
        opacity,
        transition: "border-color .15s ease, box-shadow .15s ease, opacity .15s ease, transform .3s cubic-bezier(.4,0,.2,1)",
        cursor: dragging ? "grabbing" : (hover ? "grab" : "pointer"),
        display: "flex", flexDirection: "column", gap: 8,
        userSelect: "none",
        touchAction: "none",
        animation: isDropTarget ? "fmDropPulse 1s ease-in-out infinite" : "none",
      }}
    >
      {/* Drag handle (GripVertical, visible on hover) — purely visual; the whole card is the drag handle */}
      <div
        aria-hidden
        style={{
          position: "absolute", top: 6, right: 6,
          opacity: hover && !dragging ? 1 : 0,
          transition: "opacity .12s ease",
          padding: 4, borderRadius: 4,
          color: "#6B7280",
          pointerEvents: "none",
        }}
      >
        {/* lucide GripVertical (size-4) */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9"  cy="5"  r="1"/>
          <circle cx="9"  cy="12" r="1"/>
          <circle cx="9"  cy="19" r="1"/>
          <circle cx="15" cy="5"  r="1"/>
          <circle cx="15" cy="12" r="1"/>
          <circle cx="15" cy="19" r="1"/>
        </svg>
      </div>

      {/* Right-edge connector "+" — start a new outgoing arrow */}
      <button
        title="Drag to connect to another signal"
        aria-label="Create connection"
        onPointerDown={(e) => { e.stopPropagation(); onConnectorPointerDown && onConnectorPointerDown(e); }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          right: -10, top: "50%", transform: "translateY(-50%)",
          width: 20, height: 20, padding: 0,
          borderRadius: 999, border: "none",
          background: "#F97316", color: "#fff",
          cursor: "crosshair",
          opacity: hover && !dragging ? 1 : 0,
          transition: "opacity .15s ease, transform .15s ease",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 8px rgba(249,115,22,0.45)",
          pointerEvents: hover && !dragging ? "auto" : "none",
          zIndex: 6,
          touchAction: "none",
        }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5"  y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      {/* Row 1 — STEEP pill + source */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingRight: hover ? 14 : 0 }}>
        <span className={"chip chip-" + node.cat.toLowerCase()}>{node.cat}</span>
        <span style={{ fontSize: 10, color: "#6B7280", fontFamily: "var(--font-mono)", letterSpacing: ".02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 100 }}>
          {node.source || node.year}
        </span>
      </div>

      {/* Row 2 — title (2 lines) */}
      <div style={{
        fontSize: 14, fontWeight: 600, color: "#1E1B2E", letterSpacing: "-0.005em", lineHeight: 1.3,
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
      }}>{node.title}</div>

      {/* Row 3 — body (2 lines) */}
      <div style={{
        fontSize: 12, color: "#6B7280", lineHeight: 1.5, flex: 1,
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
      }}>{node.body}</div>

      {/* Row 4 — impact stars + uncertainty */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, minHeight: 22 }}>
        <ImpactStars value={node.impact || 3}/>
        <span style={{
          marginLeft: "auto",
          fontSize: 10, fontWeight: 600,
          padding: "2px 7px", borderRadius: 999,
          background: u.bg, color: u.fg, letterSpacing: ".02em",
        }}>{node.uncertainty || "Medium"}</span>
      </div>

      {/* Hover-revealed action row */}
      <div style={{
        marginTop: -2,
        height: hover && !dragging ? 16 : 0,
        opacity: hover && !dragging ? 1 : 0,
        overflow: "hidden",
        transition: "height .12s ease, opacity .12s ease",
      }}>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onEdit && onEdit(); }}
          style={{
            border: "none", background: "transparent", padding: 0,
            color: "#F97316", fontSize: 11.5, fontWeight: 500, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 4,
          }}
        >
          Edit chain
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>
      </div>
    </div>
  );
});

// Placeholder card shown at the drop target during a card drag
function SignalCardPlaceholder({ label = "Drop signal here" }) {
  return (
    <div style={{
      width: CARD_W, minHeight: CARD_MIN_H,
      border: "1.5px dashed #FED7AA",
      background: "rgba(255,247,237,0.4)",
      borderRadius: 10,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#C2410C", fontSize: 12, fontWeight: 500,
      letterSpacing: ".02em",
    }}>
      {label}
    </div>
  );
}

Object.assign(window, { SignalCard, SignalCardPlaceholder, ImpactStars });
