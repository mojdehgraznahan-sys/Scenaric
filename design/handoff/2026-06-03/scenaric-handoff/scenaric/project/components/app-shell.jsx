// App shell — sidenav + topbar + page router
function AppShell({ navigate, path }) {
  const store = window.FM.useStore();
  // path: /app, /app/dashboard, /app/knowledge, /app/signals, /app/matrix, etc.
  const parts = path.split("/").filter(Boolean);
  const page = parts[1] || "home";

  // Cmd/Ctrl + 1/2/3 → jump between Matrix / Storyline / Narrative.
  if (window.useScenarioShortcuts) window.useScenarioShortcuts(navigate);

  const collapsed = store.navCollapsed;
  const navW = collapsed ? 52 : 204;

  return (
    <div data-screen-label={"App · " + page} style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#F5F5F5" }}>
      <SideNav navigate={navigate} page={page}/>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", marginLeft: 0 }}>
        {!["storyline", "matrix", "narrative"].includes(page) && <TopBar page={page} navigate={navigate}/>}
        <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
          <PageContainer page={page} navigate={navigate}/>
        </div>
      </div>
      <window.AskAI/>
      <GlobalToast navigate={navigate}/>
    </div>
  );
}

// App-wide toast (survives page navigation). Triggered via window.FM_toast(opts).
function GlobalToast({ navigate }) {
  const store = window.FM.useStore();
  const [toast, setToast] = React.useState(null);
  React.useEffect(() => {
    window.FM_toast = (opts) => setToast({ ...opts, ts: Date.now() });
    return () => { if (window.FM_toast) delete window.FM_toast; };
  }, []);
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.duration || 4000);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  const doAction = () => {
    if (toast.action === "open-canvas") navigate("/app/canvas");
    else if (toast.action === "undo-reax" && window.__fmUndo) {
      store.setScenarios(window.__fmUndo.scenarios);
      store.setCriticalUncertainties(window.__fmUndo.critical);
      try { localStorage.removeItem("fm.reaxReview"); } catch {}
      window.__fmUndo = null;
    }
    setToast(null);
  };
  return (
    <div style={{
      position: "fixed", right: 24, bottom: 24, zIndex: 2000,
      background: "#1E1B2E", color: "#fff",
      padding: "10px 14px", borderRadius: 9,
      boxShadow: "0 12px 30px rgba(15,23,42,0.22)",
      display: "flex", alignItems: "center", gap: 14, fontSize: 13,
      animation: "fmToastIn .18s ease-out both",
    }}>
      <span>{toast.message}</span>
      {toast.actionText && (
        <button onClick={doAction} style={{ border: "none", background: "transparent", color: "#FDBA74", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}>{toast.actionText}</button>
      )}
    </div>
  );
}

function PageContainer({ page, navigate }) {
  switch (page) {
    case "home":       return <window.PageDashboard navigate={navigate}/>;
    case "dashboard":  return <window.PageDashboard navigate={navigate}/>;
    case "knowledge":  return <window.PageKnowledge navigate={navigate}/>;
    case "signals":    return <window.PageSignals navigate={navigate}/>;
    case "matrix":     return <window.PageMatrix navigate={navigate}/>;
    case "storyline":  return <window.PageStoryline navigate={navigate}/>;
    case "canvas":     return <window.PageCanvas navigate={navigate}/>;
    case "narrative":  return <window.PageNarrative navigate={navigate}/>;
    case "strategy":   return <window.PageStrategy navigate={navigate}/>;
    case "monitoring": return <window.PageMonitoring navigate={navigate}/>;
    case "settings":   return <window.PageSettings navigate={navigate}/>;
    default:           return <window.PageDashboard navigate={navigate}/>;
  }
}

function SideNav({ navigate, page }) {
  const store = window.FM.useStore();
  const collapsed = store.navCollapsed;
  const w = collapsed ? 52 : 204;

  const groups = [
    {
      // Unlabeled top section
      label: null,
      items: [
        { id: "home",       label: "Home",           icon: <Icons.Layers size={14}/> },
      ],
    },
    {
      label: "INPUTS",
      items: [
        { id: "knowledge",  label: "Knowledge Base", icon: <Icons.Database size={14}/>, dot: true },
        { id: "signals",    label: "Signals",        icon: <Icons.Radio size={14}/> },
      ],
    },
    {
      // Ungrouped bridge — Matrix is the diagnostic step between inputs and scenarios.
      label: null,
      bridge: true,
      items: [
        { id: "matrix",     label: "Matrix",         icon: <Icons.Grid size={14}/> },
      ],
    },
    {
      label: "SCENARIOS",
      items: [
        { id: "canvas",     label: "Canvas",         icon: <Icons.Compass size={14}/> },
        { id: "storyline",  label: "Storyline",      icon: <Icons.Trending size={14}/>, badge: "NEW", shortcut: "2" },
        { id: "narrative",  label: "Narrative",      icon: <Icons.Edit3 size={14}/>, shortcut: "3" },
      ],
    },
    {
      label: "DECISIONS",
      items: [
        { id: "strategy",   label: "Strategy",       icon: <Icons.Target size={14}/> },
        { id: "monitoring", label: "Monitoring",     icon: <Icons.Activity size={14}/> },
      ],
    },
  ];

  return (
    <aside style={{
      width: w, flexShrink: 0, background: "#fff", borderRight: "1px solid #E5E7EB",
      display: "flex", flexDirection: "column",
      transition: "width .2s ease",
      position: "relative",
    }}>
      {/* Collapse / expand toggle — half-hangs off the right edge */}
      <button
        onClick={() => store.setNavCollapsed(!collapsed)}
        title={collapsed ? "Expand" : "Collapse"}
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        style={{
          position: "absolute", top: 60, right: -12, zIndex: 20,
          width: 24, height: 24, borderRadius: 999,
          background: "#fff", border: "1px solid #E5E7EB",
          boxShadow: "0 1px 3px rgba(15,23,42,0.10)",
          color: "#6B7280", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
          transition: "color .12s ease",
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = "#1E1B2E"}
        onMouseLeave={(e) => e.currentTarget.style.color = "#6B7280"}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {collapsed
            ? <polyline points="9 18 15 12 9 6"/>
            : <polyline points="15 18 9 12 15 6"/>}
        </svg>
      </button>

      {/* Logo row */}
      <div style={{ height: 52, borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", padding: collapsed ? "0 12px" : "0 11px", gap: 8 }}>
        <Icons.Logo size={28}/>
        {!collapsed && (
          <span style={{ fontWeight: 600, fontSize: 13 }}>Scenaric.ai</span>
        )}
      </div>

      {/* Project picker */}
      {!collapsed && (
        <div style={{ padding: "11px 11px 4px" }}>
          <button style={{
            width: "100%", height: 34, padding: "0 9px",
            border: "1px solid #E5E7EB", background: "#fff", borderRadius: 7,
            display: "flex", alignItems: "center", gap: 8,
            fontSize: 13, color: "#1E1B2E", fontWeight: 500, cursor: "pointer",
            textAlign: "left",
          }}>
            <span style={{ color: "#F97316", fontFamily: "var(--font-mono)", fontSize: 11 }}>‹</span>
            All projects
          </button>
          <div style={{ marginTop: 7, padding: "6px 9px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1E1B2E", letterSpacing: "-0.01em" }}>APAC Expansion 2030</div>
            <div style={{ fontSize: 10.5, color: "#9CA3AF", fontFamily: "var(--font-mono)", marginTop: 2 }}>OWNED BY JOHN DOE</div>
          </div>
        </div>
      )}

      <nav style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }} className="scroll-y">
        {groups.map((g, gi) => (
          <React.Fragment key={g.label || `group-${gi}`}>
            {!collapsed && g.label && (
              <div className="sec-label" style={gi === 0 ? undefined : { marginTop: 12 }}>{g.label}</div>
            )}
            {!collapsed && g.bridge && <div style={{ height: 12 }}/>}
            {g.items.map((item, ii) => (
              <NavItem
                key={item.id}
                item={item}
                active={page === item.id}
                collapsed={collapsed}
                onClick={() => navigate("/app/" + item.id)}
                groupStart={collapsed && g.bridge && ii === 0}
              />
            ))}
          </React.Fragment>
        ))}

        {!collapsed && <div className="sec-label" style={{ marginTop: 12 }}>ACCOUNT</div>}
        <NavItem
          item={{ id: "settings", label: "Settings", icon: <Icons.Settings size={14}/> }}
          active={page === "settings"}
          collapsed={collapsed}
          onClick={() => navigate("/app/settings")}
          groupStart={collapsed}
        />
      </nav>

      {/* User row */}
      <div style={{
        minHeight: 52, borderTop: "1px solid #E5E7EB", padding: "0 11px",
        display: "flex", alignItems: "center", gap: 8,
        justifyContent: collapsed ? "center" : "flex-start",
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 999,
          background: "#E5E7EB", color: "#6B7280",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 600,
        }}>JD</div>
        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1E1B2E" }}>John Doe</div>
            <div style={{ fontSize: 10.5, color: "#9CA3AF", fontFamily: "var(--font-mono)" }}>OWNER</div>
          </div>
        )}
      </div>
    </aside>
  );
}

function NavItem({ item, active, collapsed, onClick, groupStart }) {
  const [hover, setHover] = React.useState(false);
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? "⌘" : "Ctrl+";
  const shortcutHint = item.shortcut ? `${modKey}${item.shortcut}` : null;
  // When expanded, the browser title tooltip carries the shortcut hint.
  const titleAttr = !collapsed && shortcutHint ? `${item.label} · ${shortcutHint}` : undefined;
  return (
    <div
      style={{ position: "relative", marginTop: collapsed && groupStart ? 12 : 0 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        className={"nav-item" + (active ? " active" : "")}
        onClick={onClick}
        title={titleAttr}
        style={collapsed
          ? { justifyContent: "center", padding: 0, width: 38, margin: "2px 7px" }
          : {}
        }
      >
        {item.icon}
        {!collapsed && <span>{item.label}</span>}
        {!collapsed && item.badge && (
          <span style={{
            marginLeft: "auto",
            padding: "1px 6px", borderRadius: 4,
            background: "#FFF7ED", color: "#C2410C",
            border: "1px solid #FED7AA",
            fontSize: 9, fontWeight: 600, fontFamily: "var(--font-mono)", letterSpacing: ".06em",
          }}>{item.badge}</span>
        )}
        {!collapsed && item.dot && <span className="nav-dot"/>}
      </button>

      {/* Tooltip — collapsed state only, appears to the right */}
      {collapsed && hover && (
        <div style={{
          position: "absolute", left: "calc(100% + 4px)", top: "50%", transform: "translateY(-50%)",
          background: "#1E1B2E", color: "#fff",
          fontSize: 12, fontWeight: 500,
          padding: "4px 8px", borderRadius: 6,
          whiteSpace: "nowrap", zIndex: 50,
          boxShadow: "0 4px 12px rgba(15,23,42,0.18)",
          pointerEvents: "none",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          {item.label}
          {shortcutHint && (
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 10.5,
              color: "#9CA3AF",
            }}>{shortcutHint}</span>
          )}
          {item.badge && (
            <span style={{
              padding: "0px 5px", borderRadius: 3,
              background: "rgba(249,115,22,0.22)", color: "#FDBA74",
              fontSize: 8.5, fontWeight: 600, fontFamily: "var(--font-mono)", letterSpacing: ".06em",
            }}>{item.badge}</span>
          )}
        </div>
      )}
    </div>
  );
}

function TopBar({ page, navigate }) {
  const store = window.FM.useStore();
  const titles = {
    home:       "Home",
    dashboard:  "Home",
    knowledge:  "Knowledge Base",
    signals:    "Signals Library",
    matrix:     "Impact × Uncertainty Matrix",
    storyline:  "Storyline",
    canvas:     "Scenario Canvas",
    narrative:  "Scenario Narratives",
    strategy:   "Strategic Options",
    monitoring: "Monitoring",
    settings:   "Settings",
  };
  return (
    <div style={{
      height: 52, flexShrink: 0,
      background: "#fff", borderBottom: "1px solid #E5E7EB",
      display: "flex", alignItems: "center", padding: "0 20px", gap: 12,
    }}>
      <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: "-0.01em" }}>{titles[page] || "Scenaric"}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 8, fontSize: 12, color: "#9CA3AF", fontFamily: "var(--font-mono)" }}>
        <span>/</span>
        <span>APAC Expansion 2030</span>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ position: "relative" }}>
          <Icons.Search size={14} stroke="#9CA3AF" style={{ position: "absolute", left: 10, top: 9 }}/>
          <input className="input" placeholder="Search…" style={{ width: 220, paddingLeft: 30, height: 32 }}/>
        </div>
        <button className="btn btn-ghost btn-sm" style={{ position: "relative", padding: 7, width: 32, height: 32 }}>
          <Icons.Bell size={14}/>
          <span style={{ position: "absolute", top: 6, right: 6, width: 6, height: 6, background: "#F97316", borderRadius: 999 }}/>
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => navigate("/app/signals")}>
          <Icons.Plus size={13}/> Add Signal
        </button>
      </div>
    </div>
  );
}

window.AppShell = AppShell;
window.SideNav = SideNav;
window.TopBar = TopBar;
