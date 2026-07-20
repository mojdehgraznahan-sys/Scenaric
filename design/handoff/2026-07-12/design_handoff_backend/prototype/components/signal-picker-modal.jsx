// Signal picker modal — surfaces from the Storyline "+ Add Signal to Chain"
// button. Two tabs: pick from library OR create new. Both routes converge on
// a "place in column" + "connect from" selector, then commit through callbacks
// supplied by the storyline canvas.

const { useState, useEffect, useMemo, useRef } = React;

const STEEP_CATS = ["Social", "Technology", "Economic", "Ecological", "Political"];
const UNCERTAINTY_BADGE = {
  High:   { bg: "#FEF2F2", fg: "#EF4444" },
  Medium: { bg: "#FFFBEB", fg: "#F59E0B" },
  Low:    { bg: "#ECFDF5", fg: "#10B981" },
};

function SignalPickerModal({
  open, onClose,
  scenarioId,
  nodes, edges, phases, columnLabels,
  setNodes, setEdges,
  showToast,
}) {
  const [tab, setTab] = useState("library"); // "library" | "create"
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [selected, setSelected] = useState(new Set());

  // Placement state
  const defaultColumn = useMemo(() => {
    const counts = phases.map(p => ({ id: p.id, count: nodes.filter(n => n.phase === p.id).length }));
    counts.sort((a, b) => a.count - b.count);
    return counts[0] ? counts[0].id : (phases[0] && phases[0].id);
  }, [nodes, phases]);
  const [placement, setPlacement] = useState(defaultColumn);
  const [connectFrom, setConnectFrom] = useState("");

  // Create-new form
  const [form, setForm] = useState({
    title: "", body: "", category: "Technology",
    source: "", impact: 3, uncertainty: "Medium",
  });
  const [formError, setFormError] = useState(null);

  // Reset transient state on every open
  useEffect(() => {
    if (open) {
      setTab("library");
      setSearch("");
      setFilterCat("All");
      setSelected(new Set());
      setPlacement(defaultColumn);
      setConnectFrom("");
      setForm({ title: "", body: "", category: "Technology", source: "", impact: 3, uncertainty: "Medium" });
      setFormError(null);
    }
  }, [open, defaultColumn]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const library = (window.FM_DATA && window.FM_DATA.signals) || [];
  const chainIds = new Set(nodes.map(n => n.id));
  // Already-in-chain detection by title (library signals get re-titled when chained)
  const chainTitles = new Set(nodes.map(n => (n.title || "").toLowerCase()));

  const filtered = library.filter(s => {
    if (filterCat !== "All" && s.category !== filterCat) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (s.title || "").toLowerCase().includes(q)
        || (s.source || "").toLowerCase().includes(q)
        || (s.body || "").toLowerCase().includes(q);
  });

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAddFromLibrary = () => {
    if (selected.size === 0) return;
    const picked = library.filter(s => selected.has(s.id));
    // Build chain-format nodes; skip exact-title duplicates by moving them.
    const newChainNodes = [];
    const moveTitles = new Set();
    for (const s of picked) {
      const isAlreadyChained = chainTitles.has((s.title || "").toLowerCase());
      if (isAlreadyChained) { moveTitles.add(s.title.toLowerCase()); continue; }
      newChainNodes.push({
        id: "lib_" + s.id + "_" + Date.now().toString(36),
        phase: placement,
        cat: s.category,
        title: s.title,
        body: s.body || "",
        year: s.year || "—",
        source: s.source || "Library",
        impact: s.impact || 3,
        uncertainty: s.uncertainty || "Medium",
        strength: 0.6,
      });
    }
    commitAdd(newChainNodes, moveTitles);
  };

  const handleCreateNew = () => {
    if (!form.title.trim()) { setFormError("Title is required."); return; }
    setFormError(null);
    const newSignal = {
      id: "sg_new_" + Date.now().toString(36),
      category: form.category,
      source: form.source.trim() || "Internal research",
      title: form.title.trim(),
      body: form.body.trim(),
      impact: form.impact,
      uncertainty: form.uncertainty,
    };
    // Mutate the global library so it appears in the picker afterwards.
    if (window.FM_DATA && Array.isArray(window.FM_DATA.signals)) {
      window.FM_DATA.signals.unshift(newSignal);
    }
    const newChainNode = {
      id: "new_" + Date.now().toString(36),
      phase: placement,
      cat: newSignal.category,
      title: newSignal.title,
      body: newSignal.body,
      year: "—",
      source: newSignal.source,
      impact: newSignal.impact,
      uncertainty: newSignal.uncertainty,
      strength: 0.6,
    };
    commitAdd([newChainNode], new Set());
  };

  const commitAdd = (newChainNodes, moveTitles) => {
    if (newChainNodes.length === 0 && moveTitles.size === 0) return;

    // 1. Move existing-by-title nodes to the chosen column.
    setNodes(prev => {
      const updated = prev.map(n => moveTitles.has((n.title || "").toLowerCase()) ? { ...n, phase: placement } : n);
      // 2. Append new nodes at the end of the chosen column.
      // We sort by phase order, preserving column-internal sequence.
      const phaseStart = updated.findIndex(n => n.phase === placement);
      const insertAt = phaseStart === -1 ? updated.length : (() => {
        let idx = phaseStart;
        while (idx < updated.length && updated[idx].phase === placement) idx++;
        return idx;
      })();
      return [...updated.slice(0, insertAt), ...newChainNodes, ...updated.slice(insertAt)];
    });

    // 3. Optional auto-connection from an existing signal.
    if (connectFrom && newChainNodes.length > 0) {
      setEdges(es => [
        ...es,
        ...newChainNodes.map(n => ({ from: connectFrom, to: n.id, relationship: "Leads to", confidence: "Moderate" })),
      ]);
    }

    // 4. Success toast.
    const colLabelIdx = phases.findIndex(p => p.id === placement);
    const colLabel = columnLabels[colLabelIdx] || (phases[colLabelIdx] && phases[colLabelIdx].id) || placement;
    const total = newChainNodes.length + moveTitles.size;
    const msg = total === 1 ? `Added 1 signal to ${colLabel}` : `Added ${total} signals to ${colLabel}`;
    if (typeof showToast === "function") showToast(msg);

    onClose();
  };

  const totalSelectedCount = selected.size;
  const primaryDisabled = tab === "library" ? totalSelectedCount === 0 : !form.title.trim();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add signal to storyline"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(30,27,46,0.40)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
        animation: "fadeIn .15s ease-out both",
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 720,
          background: "#fff",
          borderRadius: 14,
          boxShadow: "0 30px 80px rgba(15,23,42,0.25), 0 8px 24px rgba(15,23,42,0.12)",
          padding: 24,
          display: "flex", flexDirection: "column",
          maxHeight: "calc(100vh - 48px)",
          position: "relative",
          animation: "slideUp .2s ease-out both",
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute", top: 16, right: 16,
            width: 30, height: 30, borderRadius: 7,
            border: "none", background: "transparent", color: "#6B7280",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#F5F5F5"; e.currentTarget.style.color = "#1E1B2E"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#6B7280"; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/>
          </svg>
        </button>

        {/* Header */}
        <div style={{ paddingRight: 32 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#1E1B2E", letterSpacing: "-0.01em" }}>
            Add signal to storyline
          </h2>
          <div style={{ marginTop: 4, fontSize: 13.5, color: "#6B7280" }}>
            Pick from your Signals Library or create a new one.
          </div>
        </div>

        {/* Tabs */}
        <div style={{ marginTop: 18, display: "flex", gap: 4, borderBottom: "1px solid #E5E7EB" }}>
          {[
            { id: "library", label: "From Library" },
            { id: "create",  label: "Create new"   },
          ].map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  border: "none", background: "transparent",
                  padding: "10px 14px",
                  marginBottom: -1,
                  borderBottom: active ? "2px solid #F97316" : "2px solid transparent",
                  color: active ? "#1E1B2E" : "#6B7280",
                  fontWeight: active ? 600 : 500,
                  fontSize: 13.5,
                  cursor: "pointer",
                  transition: "color .12s ease, border-color .12s ease",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", marginTop: 16 }}>
          {tab === "library" ? (
            <LibraryTab
              search={search} setSearch={setSearch}
              filterCat={filterCat} setFilterCat={setFilterCat}
              filtered={filtered}
              selected={selected} toggleSelect={toggleSelect}
              chainTitles={chainTitles}
            />
          ) : (
            <CreateTab
              form={form} setForm={setForm}
              error={formError}
            />
          )}
        </div>

        {/* Placement selector — always visible */}
        <div style={{
          marginTop: 16, paddingTop: 14, borderTop: "1px solid #F3F4F6",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
        }}>
          <PickerField label="Add to column">
            <PickerSelect
              value={placement}
              onChange={setPlacement}
              options={phases.map((p, i) => ({ value: p.id, label: columnLabels[i] || p.id }))}
            />
          </PickerField>
          <PickerField label="Connect from existing signal (optional)">
            <PickerSelect
              value={connectFrom}
              onChange={setConnectFrom}
              placeholder="No connection"
              options={[
                { value: "", label: "— No connection —" },
                ...nodes.map(n => ({ value: n.id, label: pickerTruncate(n.title, 44) })),
              ]}
            />
          </PickerField>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 16, paddingTop: 14, borderTop: "1px solid #F3F4F6",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <span style={{ fontSize: 13, color: "#6B7280" }}>
            {tab === "library"
              ? (totalSelectedCount === 1 ? "1 signal selected" : `${totalSelectedCount} signals selected`)
              : (form.title.trim() ? "Ready to create" : "Fill the form to create")}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: "8px 14px",
                border: "none", background: "transparent",
                color: "#6B7280", fontSize: 13.5, fontWeight: 500,
                cursor: "pointer", borderRadius: 7,
                transition: "color .12s ease, background .12s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#1E1B2E"; e.currentTarget.style.background = "#F5F5F5"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#6B7280"; e.currentTarget.style.background = "transparent"; }}
            >
              Cancel
            </button>
            <button
              onClick={tab === "library" ? handleAddFromLibrary : handleCreateNew}
              disabled={primaryDisabled}
              style={{
                padding: "8px 16px",
                border: "none", borderRadius: 7,
                background: "#F97316", color: "#fff",
                fontSize: 13.5, fontWeight: 600,
                cursor: primaryDisabled ? "not-allowed" : "pointer",
                opacity: primaryDisabled ? 0.4 : 1,
                transition: "background .12s ease, opacity .12s ease",
              }}
              onMouseEnter={(e) => { if (!primaryDisabled) e.currentTarget.style.background = "#EA6B0B"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#F97316"; }}
            >
              {tab === "library" ? "Add to chain" : "Create & add"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Library tab ─────────────────────────── */

function LibraryTab({ search, setSearch, filterCat, setFilterCat, filtered, selected, toggleSelect, chainTitles }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 12 }}>
      {/* Search */}
      <div style={{ position: "relative" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search signals by name, source, or keyword..."
          autoFocus
          style={{
            width: "100%",
            padding: "9px 12px 9px 32px",
            border: "1px solid #E5E7EB", borderRadius: 8,
            fontSize: 13.5, fontFamily: "inherit",
            outline: "none",
            transition: "border-color .12s ease, box-shadow .12s ease",
          }}
          onFocus={(e) => { e.target.style.borderColor = "#F97316"; e.target.style.boxShadow = "0 0 0 3px rgba(249,115,22,0.12)"; }}
          onBlur={(e) => { e.target.style.borderColor = "#E5E7EB"; e.target.style.boxShadow = "none"; }}
        />
      </div>

      {/* STEEP filter pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {["All", ...STEEP_CATS].map(cat => {
          const active = filterCat === cat;
          return (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={cat === "All" ? "" : "chip chip-" + cat.toLowerCase()}
              style={cat === "All" ? {
                padding: "4px 11px",
                border: active ? "1px solid #F97316" : "1px solid #E5E7EB",
                background: active ? "#FFF7ED" : "#fff",
                color: active ? "#C2410C" : "#6B7280",
                fontSize: 11.5, fontWeight: 500,
                borderRadius: 999, cursor: "pointer",
                transition: "border-color .12s ease, color .12s ease, background .12s ease",
              } : {
                cursor: "pointer",
                outline: active ? "2px solid #F97316" : "none",
                outlineOffset: 1,
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Signal list */}
      <div
        className="scroll-y"
        style={{
          flex: 1,
          overflow: "auto",
          maxHeight: 400,
          border: "1px solid #F3F4F6", borderRadius: 10,
          background: "#FAFAFA",
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
            No signals match. Try adjusting filters.
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 6, display: "flex", flexDirection: "column", gap: 4 }}>
            {filtered.map(s => {
              const isSelected = selected.has(s.id);
              const isInChain = chainTitles.has((s.title || "").toLowerCase());
              const u = UNCERTAINTY_BADGE[s.uncertainty] || UNCERTAINTY_BADGE.Medium;
              return (
                <li
                  key={s.id}
                  onClick={() => toggleSelect(s.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px",
                    background: isSelected ? "#FFF7ED" : "#fff",
                    border: isSelected ? "1px solid #F97316" : "1px solid #E5E7EB",
                    borderRadius: 8,
                    cursor: "pointer",
                    opacity: isInChain && !isSelected ? 0.6 : 1,
                    transition: "background .12s ease, border-color .12s ease, opacity .12s ease",
                  }}
                >
                  {/* Checkbox */}
                  <PickerCheckbox checked={isSelected}/>
                  {/* STEEP pill */}
                  <span className={"chip chip-" + s.category.toLowerCase()} style={{ flexShrink: 0 }}>{s.category}</span>
                  {/* Title + source */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#1E1B2E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.title}
                    </div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "var(--font-mono)", letterSpacing: ".02em" }}>
                      {s.source}
                    </div>
                  </div>
                  {/* Impact stars */}
                  <ImpactStars value={s.impact || 3} size={10}/>
                  {/* Uncertainty */}
                  <span style={{
                    flexShrink: 0,
                    padding: "2px 7px", borderRadius: 999,
                    fontSize: 10, fontWeight: 600,
                    background: u.bg, color: u.fg,
                  }}>
                    {s.uncertainty || "Medium"}
                  </span>
                  {/* In-chain badge */}
                  {isInChain && (
                    <span style={{
                      flexShrink: 0,
                      padding: "2px 7px", borderRadius: 999,
                      fontSize: 10, fontWeight: 500,
                      background: "#F5F5F5", color: "#6B7280",
                      fontFamily: "var(--font-mono)", letterSpacing: ".02em", textTransform: "uppercase",
                    }}>
                      In chain
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── Create-new tab ─────────────────────────── */

function CreateTab({ form, setForm, error }) {
  const update = (patch) => setForm(f => ({ ...f, ...patch }));
  return (
    <div className="scroll-y" style={{ overflow: "auto", paddingRight: 4, display: "flex", flexDirection: "column", gap: 12, maxHeight: 460 }}>
      <PickerField label="Signal title" required>
        <input
          value={form.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="e.g. ASEAN ratifies the digital trade pact"
          autoFocus
          style={pickerInputStyle()}
        />
      </PickerField>
      <PickerField label="Description">
        <textarea
          value={form.body}
          onChange={(e) => update({ body: e.target.value })}
          placeholder="What happens. Why it matters. (1–2 sentences)"
          rows={3}
          style={{ ...pickerInputStyle(), resize: "vertical", minHeight: 70, fontFamily: "inherit" }}
        />
      </PickerField>
      <PickerField label="STEEP category" required>
        <PickerSegmented
          value={form.category}
          options={STEEP_CATS}
          onChange={(v) => update({ category: v })}
          accent="#F97316"
        />
      </PickerField>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PickerField label="Source">
          <input
            value={form.source}
            onChange={(e) => update({ source: e.target.value })}
            placeholder="Reuters, internal research, …"
            style={pickerInputStyle()}
          />
        </PickerField>
        <PickerField label="Impact (1–5)">
          <PickerStarPicker value={form.impact} onChange={(v) => update({ impact: v })}/>
        </PickerField>
      </div>
      <PickerField label="Uncertainty">
        <PickerSegmented
          value={form.uncertainty}
          options={["Low", "Medium", "High"]}
          onChange={(v) => update({ uncertainty: v })}
          accent="#F97316"
        />
      </PickerField>
      {error && (
        <div style={{
          padding: "8px 11px", borderRadius: 7,
          background: "#FEF2F2", color: "#EF4444",
          fontSize: 12.5, border: "1px solid #FECACA",
        }}>{error}</div>
      )}
    </div>
  );
}

/* ─────────────────────────── Helpers ─────────────────────────── */

function PickerField({ label, required, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#1E1B2E", marginBottom: 5 }}>
        {label}{required && <span style={{ color: "#F97316", marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function pickerInputStyle() {
  return {
    width: "100%",
    padding: "8px 11px",
    border: "1px solid #E5E7EB", borderRadius: 7,
    fontSize: 13, fontFamily: "inherit",
    outline: "none",
    background: "#fff",
  };
}

function PickerSelect({ value, onChange, options, placeholder }) {
  return (
    <div style={{ position: "relative" }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          appearance: "none", WebkitAppearance: "none",
          padding: "8px 30px 8px 11px",
          border: "1px solid #E5E7EB", borderRadius: 7,
          fontSize: 13, color: "#1E1B2E",
          background: "#fff", cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
        style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </div>
  );
}

function PickerSegmented({ value, options, onChange, accent = "#F97316" }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${options.length}, 1fr)`,
      padding: 2,
      background: "#F3F4F6", borderRadius: 8,
    }}>
      {options.map(o => {
        const active = value === o;
        return (
          <button
            key={o}
            onClick={() => onChange(o)}
            style={{
              padding: "6px 8px",
              border: "none", borderRadius: 6,
              background: active ? "#fff" : "transparent",
              color: active ? "#1E1B2E" : "#6B7280",
              fontWeight: active ? 600 : 500,
              fontSize: 12,
              cursor: "pointer",
              boxShadow: active ? "0 1px 2px rgba(15,23,42,0.08)" : "none",
              transition: "background .12s ease, color .12s ease",
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function PickerStarPicker({ value, onChange, max = 5 }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div
      onMouseLeave={() => setHover(0)}
      style={{
        display: "inline-flex", gap: 4, padding: "4px 0",
      }}
    >
      {Array.from({ length: max }).map((_, i) => {
        const n = i + 1;
        const filled = n <= display;
        return (
          <button
            key={i}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            style={{
              border: "none", background: "transparent",
              padding: 2, cursor: "pointer", display: "flex",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "#F97316" : "#E5E7EB"} stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </button>
        );
      })}
    </div>
  );
}

function PickerCheckbox({ checked }) {
  return (
    <span
      aria-hidden
      style={{
        flexShrink: 0,
        width: 16, height: 16, borderRadius: 4,
        border: `1.5px solid ${checked ? "#F97316" : "#D1D5DB"}`,
        background: checked ? "#F97316" : "#fff",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        transition: "border-color .12s ease, background .12s ease",
      }}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      )}
    </span>
  );
}

function pickerTruncate(s, n) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

window.SignalPickerModal = SignalPickerModal;
