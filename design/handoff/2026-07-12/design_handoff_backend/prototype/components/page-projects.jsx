// Projects dashboard — the landing screen after login/signup. Lists every
// scenario-planning project the user owns; each opens directly into the
// active project, no separate "select project" step needed elsewhere.
//
// NOTE ON SCOPE: this screen introduces the projects[] collection and
// activeProjectId in the store (see app.jsx). It syncs the legacy single
// `store.project` object on open/create so the existing methodology pages
// (Home, Settings, Knowledge Base, Signals, Matrix, Canvas, Storyline,
// Narrative, Strategy, Monitoring) keep working unchanged. Fully scoping
// each of those pages' data (signals/scenarios/etc.) by project id is a
// separate follow-up — flagged in the walkthrough, not done here.

const STEP_LABELS = [
  "Focal question", "Driving forces", "Rank forces", "Scenarios",
  "Narrative", "Implications", "Indicators", "Strategy",
];
const STEP_ROUTES = [
  "/app/settings", "/app/signals", "/app/matrix", "/app/canvas",
  "/app/narrative", "/app/narrative", "/app/monitoring", "/app/strategy",
];
const TOTAL_STEPS = STEP_LABELS.length;

function fmtRelative(iso) {
  const d = new Date(iso);
  const now = new Date("2026-07-07T12:00:00Z"); // matches the prototype's fixed "today"
  const diffMs = now - d;
  const day = 24 * 60 * 60 * 1000;
  const days = Math.floor(diffMs / day);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return days + "d ago";
  if (days < 30) return Math.floor(days / 7) + "w ago";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function openRouteFor(proj) {
  const n = Math.max(0, Math.min(TOTAL_STEPS, proj.stepsComplete || 0));
  if (n >= TOTAL_STEPS) return "/app/home";
  return STEP_ROUTES[n];
}

function PageProjects({ navigate }) {
  const store = window.FM.useStore();
  const allProjects = store.projects || [];
  const [showArchived, setShowArchived] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [menuFor, setMenuFor] = React.useState(null);   // project id with kebab menu open
  const [renaming, setRenaming] = React.useState(null); // project id being renamed
  const [renameValue, setRenameValue] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(null);

  const active = allProjects.filter(p => !p.archived);
  const archived = allProjects.filter(p => p.archived);

  const userName = (store.user && store.user.name) || "there";
  const userFirst = userName.split(" ")[0];
  const userEmail = (store.user && store.user.email) || "";
  const userDomain = userEmail.includes("@") ? userEmail.split("@")[1] : "";
  const companyLabel = userDomain ? userDomain.split(".")[0].replace(/^\w/, c => c.toUpperCase()) : "Acme Co.";

  const openProject = (proj) => {
    store.setActiveProjectId(proj.id);
    // Sync legacy single-project state so existing methodology pages show this project's data.
    store.setProject({
      name: proj.name,
      role: "Owner",
      focal_question: proj.focal_question,
      horizon: proj.horizon,
      industry: proj.industry,
      summary: proj.summary || "",
      created: proj.created || proj.lastEdited,
    });
    navigate("/app/home");
  };

  const updateProject = (id, patch) => {
    store.setProjects(prev => prev.map(p => p.id === id ? { ...p, ...patch, lastEdited: new Date().toISOString() } : p));
  };

  const duplicateProject = (proj) => {
    const copy = {
      ...proj,
      id: "proj_" + Date.now().toString(36),
      name: proj.name + " (Copy)",
      lastEdited: new Date().toISOString(),
      archived: false,
    };
    store.setProjects(prev => [copy, ...prev]);
    setMenuFor(null);
  };

  const archiveProject = (id) => {
    updateProject(id, { archived: true });
    setMenuFor(null);
  };
  const restoreProject = (id) => updateProject(id, { archived: false });
  const deleteProject = (id) => {
    store.setProjects(prev => prev.filter(p => p.id !== id));
    setConfirmDelete(null);
    setMenuFor(null);
  };

  const startRename = (proj) => {
    setRenaming(proj.id);
    setRenameValue(proj.name);
    setMenuFor(null);
  };
  const commitRename = () => {
    if (renaming && renameValue.trim()) updateProject(renaming, { name: renameValue.trim() });
    setRenaming(null);
  };

  const createProject = (name, focalQuestion) => {
    const proj = {
      id: "proj_" + Date.now().toString(36),
      name: name.trim(),
      focal_question: focalQuestion.trim(),
      horizon: "",
      industry: "",
      stepsComplete: 0,
      lastEdited: new Date().toISOString(),
      archived: false,
    };
    store.setProjects(prev => [proj, ...prev]);
    setCreateOpen(false);
    openProject(proj);
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }} className="scroll-y">
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 16 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>WELCOME BACK, {userFirst.toUpperCase()}</div>
            <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 4px" }}>Your projects</h1>
            <div style={{ color: "#6B7280", fontSize: 14 }}>{userName} · C-Suite Executive · {companyLabel}</div>
          </div>
          <button className="btn btn-primary" onClick={() => setCreateOpen(true)} style={{ flexShrink: 0 }}>
            <Icons.Plus size={13}/> New Project
          </button>
        </div>

        {active.length === 0 ? (
          <ProjectsEmptyState onCreate={() => setCreateOpen(true)}/>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
            {active.map(proj => (
              <ProjectCard
                key={proj.id}
                proj={proj}
                onOpen={() => openProject(proj)}
                menuOpen={menuFor === proj.id}
                onToggleMenu={() => setMenuFor(menuFor === proj.id ? null : proj.id)}
                onCloseMenu={() => setMenuFor(null)}
                onRename={() => startRename(proj)}
                onDuplicate={() => duplicateProject(proj)}
                onArchive={() => archiveProject(proj.id)}
                onDelete={() => setConfirmDelete(proj.id)}
                renaming={renaming === proj.id}
                renameValue={renameValue}
                setRenameValue={setRenameValue}
                onCommitRename={commitRename}
                onCancelRename={() => setRenaming(null)}
                confirmingDelete={confirmDelete === proj.id}
                onConfirmDelete={() => deleteProject(proj.id)}
                onCancelDelete={() => setConfirmDelete(null)}
              />
            ))}
          </div>
        )}

        {/* Archived section */}
        {archived.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <button
              onClick={() => setShowArchived(s => !s)}
              style={{
                border: "none", background: "transparent", padding: 0, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 12, fontWeight: 500, color: "#6B7280",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: showArchived ? "rotate(90deg)" : "none", transition: "transform .12s ease" }}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
              Archived ({archived.length})
            </button>
            {showArchived && (
              <div className="card" style={{ marginTop: 10, padding: 6 }}>
                {archived.map((proj, i) => (
                  <div key={proj.id} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 10px",
                    borderBottom: i < archived.length - 1 ? "1px solid #F3F4F6" : "none",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proj.name}</div>
                      <div style={{ fontSize: 11, color: "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proj.focal_question}</div>
                    </div>
                    <button onClick={() => restoreProject(proj.id)} style={{ border: "none", background: "transparent", color: "#F97316", fontSize: 12, fontWeight: 500, cursor: "pointer", flexShrink: 0 }}>Restore</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {createOpen && (
        <NewProjectModal onClose={() => setCreateOpen(false)} onCreate={createProject}/>
      )}
    </div>
  );
}

/* ─────────────────────────── Project card ─────────────────────────── */

function ProjectCard({
  proj, onOpen, menuOpen, onToggleMenu, onCloseMenu,
  onRename, onDuplicate, onArchive, onDelete,
  renaming, renameValue, setRenameValue, onCommitRename, onCancelRename,
  confirmingDelete, onConfirmDelete, onCancelDelete,
}) {
  const menuRef = React.useRef(null);
  React.useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) onCloseMenu(); };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen, onCloseMenu]);

  const n = Math.max(0, Math.min(TOTAL_STEPS, proj.stepsComplete || 0));
  const pct = Math.round((n / TOTAL_STEPS) * 100);
  const isNew = n === 0;

  return (
    <div
      className="card"
      onClick={(e) => { if (!renaming && !confirmingDelete) onOpen(); }}
      style={{
        padding: 16, cursor: renaming || confirmingDelete ? "default" : "pointer",
        position: "relative", display: "flex", flexDirection: "column", gap: 10,
        transition: "border-color .12s ease, box-shadow .12s ease, transform .12s ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#D1D5DB"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(15,23,42,0.06)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = "none"; }}
    >
      {/* Title row + kebab */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        {renaming ? (
          <input
            autoFocus
            value={renameValue}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onCommitRename(); if (e.key === "Escape") onCancelRename(); }}
            onBlur={onCommitRename}
            style={{
              flex: 1, fontSize: 15, fontWeight: 600, color: "#1E1B2E",
              border: "1px solid #F97316", borderRadius: 6, padding: "3px 7px",
              outline: "none", fontFamily: "inherit",
            }}
          />
        ) : (
          <div style={{ fontSize: 15, fontWeight: 600, color: "#1E1B2E", letterSpacing: "-0.008em", lineHeight: 1.3, flex: 1, minWidth: 0 }}>
            {proj.name}
          </div>
        )}

        <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleMenu(); }}
            aria-label="Project options"
            style={{
              width: 26, height: 26, border: "none", background: "transparent",
              borderRadius: 6, cursor: "pointer", color: "#9CA3AF",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#F5F5F5"; e.currentTarget.style.color = "#1E1B2E"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9CA3AF"; }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>
            </svg>
          </button>

          {menuOpen && (
            <div
              className="slide-up"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute", top: "calc(100% + 4px)", right: 0, width: 160, zIndex: 30,
                background: "#fff", border: "1px solid #E5E7EB", borderRadius: 9,
                boxShadow: "0 10px 28px rgba(15,23,42,0.12)", padding: 5,
              }}
            >
              {[
                { label: "Rename",   action: onRename },
                { label: "Duplicate", action: onDuplicate },
                { label: "Archive",  action: onArchive },
              ].map(item => (
                <button key={item.label} onClick={item.action}
                  style={{ width: "100%", textAlign: "left", padding: "7px 9px", border: "none", background: "transparent", borderRadius: 6, cursor: "pointer", fontSize: 12.5, color: "#1E1B2E" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#F5F5F5"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >{item.label}</button>
              ))}
              <div style={{ height: 1, background: "#F3F4F6", margin: "4px 0" }}/>
              <button onClick={onDelete}
                style={{ width: "100%", textAlign: "left", padding: "7px 9px", border: "none", background: "transparent", borderRadius: 6, cursor: "pointer", fontSize: 12.5, color: "#EF4444" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#FEF2F2"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >Delete</button>
            </div>
          )}
        </div>
      </div>

      {/* Focal question */}
      <div style={{
        fontSize: 12.5, color: "#6B7280", lineHeight: 1.5, minHeight: 36,
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        textWrap: "pretty",
      }}>
        {proj.focal_question || "No focal question set yet."}
      </div>

      {/* Progress */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontSize: 11.5, color: isNew ? "#F97316" : "#6B7280", fontWeight: isNew ? 600 : 500 }}>
            {isNew ? "Not started" : `${n} of ${TOTAL_STEPS} steps complete`}
          </span>
          {!isNew && <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#9CA3AF" }}>{pct}%</span>}
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: (isNew ? 4 : pct) + "%", background: isNew ? "#E5E7EB" : undefined }}/>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
        <span>{proj.industry || "—"}</span>
        <span>Edited {fmtRelative(proj.lastEdited)}</span>
      </div>

      {confirmingDelete && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute", inset: 0, borderRadius: 11,
            background: "rgba(255,255,255,0.97)", backdropFilter: "blur(1px)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
            padding: 16, textAlign: "center",
          }}
        >
          <div style={{ fontSize: 12.5, color: "#991B1B" }}>Delete "{proj.name}" permanently?</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onConfirmDelete} style={{ border: "none", background: "#EF4444", color: "#fff", borderRadius: 7, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Delete</button>
            <button onClick={onCancelDelete} style={{ border: "1px solid #E5E7EB", background: "#fff", color: "#1E1B2E", borderRadius: 7, padding: "6px 12px", fontSize: 12.5, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Empty state ─────────────────────────── */

function ProjectsEmptyState({ onCreate }) {
  return (
    <div className="card" style={{
      padding: "56px 24px", display: "flex", flexDirection: "column",
      alignItems: "center", textAlign: "center", gap: 14,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14, background: "#FFF7ED",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icons.Compass size={22} stroke="#F97316"/>
      </div>
      <div>
        <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 600, color: "#1E1B2E" }}>Start your first scenario project</h3>
        <p style={{ margin: 0, fontSize: 14, color: "#6B7280", maxWidth: 380, lineHeight: 1.55 }}>
          Give it a focal question — the strategic decision you're trying to make — and we'll guide you through Schwartz's methodology from there.
        </p>
      </div>
      <button className="btn btn-primary btn-sm" onClick={onCreate}>
        <Icons.Plus size={12}/> New Project
      </button>
    </div>
  );
}

/* ─────────────────────────── New project modal ─────────────────────────── */

function NewProjectModal({ onClose, onCreate }) {
  const [name, setName] = React.useState("");
  const [focal, setFocal] = React.useState("");

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const canSubmit = name.trim().length > 0;

  return (
    <div
      role="dialog" aria-modal="true" aria-label="New project"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(30,27,46,0.40)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        animation: "fadeIn .15s ease-out both",
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480, background: "#fff", borderRadius: 14,
          boxShadow: "0 30px 80px rgba(15,23,42,0.25), 0 8px 24px rgba(15,23,42,0.12)",
          padding: 24, position: "relative", animation: "slideUp .2s ease-out both",
        }}
      >
        <button onClick={onClose} aria-label="Close" style={{
          position: "absolute", top: 16, right: 16, width: 30, height: 30, borderRadius: 7,
          border: "none", background: "transparent", color: "#6B7280", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
          onMouseEnter={(e) => e.currentTarget.style.background = "#F5F5F5"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
        </button>

        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, color: "#1E1B2E", letterSpacing: "-0.01em" }}>New project</h2>
        <div style={{ marginTop: 4, marginBottom: 18, fontSize: 13, color: "#6B7280" }}>
          Name it and (optionally) set a starting focal question — you can refine both later.
        </div>

        <label style={{ display: "block", marginBottom: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: "#1E1B2E", display: "block", marginBottom: 5 }}>Project name<span style={{ color: "#F97316" }}> *</span></span>
          <input
            className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. AI Regulation Outlook"
            style={{ width: "100%" }}
          />
        </label>
        <label style={{ display: "block", marginBottom: 20 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: "#1E1B2E", display: "block", marginBottom: 5 }}>Focal question <span style={{ color: "#9CA3AF", fontWeight: 400 }}>· optional</span></span>
          <textarea
            className="input textarea" rows={3} value={focal} onChange={(e) => setFocal(e.target.value)}
            placeholder="The strategic decision you're trying to make..."
            style={{ width: "100%", minHeight: 72 }}
          />
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ border: "none", background: "transparent", color: "#6B7280", fontSize: 13.5, fontWeight: 500, cursor: "pointer", padding: "8px 6px" }}>Cancel</button>
          <button
            disabled={!canSubmit}
            onClick={() => onCreate(name, focal)}
            className="btn btn-primary btn-sm"
            style={{ opacity: canSubmit ? 1 : 0.4, cursor: canSubmit ? "pointer" : "not-allowed" }}
          >
            Create project
          </button>
        </div>
      </div>
    </div>
  );
}

window.PageProjects = PageProjects;
