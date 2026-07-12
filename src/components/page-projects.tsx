"use client";

// Projects dashboard — the landing screen after login/signup. Lists every scenario-planning
// project the user owns; each opens directly into the active project, no separate
// "select project" step needed elsewhere. Faithful Tailwind/shadcn port of the handoff
// page-projects.jsx.
//
// NOTE ON SCOPE: this screen introduces the projects[] collection and activeProjectId in
// the store (see src/lib/store.tsx). It syncs the legacy single store.project object on
// open/create so the existing methodology pages (Home, Settings, Knowledge Base, Signals,
// Matrix, Canvas, Storyline, Narrative, Strategy, Monitoring) keep working unchanged.
// Fully scoping each of those pages' data (signals/scenarios/etc.) by project id is a
// separate follow-up, not done here — same as the source design.
import * as React from "react";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useNavigate } from "@/lib/use-navigate";
import type { ProjectSummary } from "@/lib/types";

const STEP_LABELS = ["Focal question", "Driving forces", "Rank forces", "Scenarios", "Narrative", "Implications", "Indicators", "Strategy"];
const TOTAL_STEPS = STEP_LABELS.length;

function fmtRelative(iso: string) {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  const days = Math.floor(diffMs / day);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return days + "d ago";
  if (days < 30) return Math.floor(days / 7) + "w ago";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function PageProjects() {
  const store = useStore();
  const navigate = useNavigate();
  const allProjects = store.projects || [];
  const [showArchived, setShowArchived] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [menuFor, setMenuFor] = React.useState<string | null>(null);
  const [renaming, setRenaming] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);

  const active = allProjects.filter((p) => !p.archived);
  const archived = allProjects.filter((p) => p.archived);

  const userName = (store.user && store.user.name) || "there";
  const userFirst = userName.split(" ")[0];
  const userEmail = (store.user && store.user.email) || "";
  const userDomain = userEmail.includes("@") ? userEmail.split("@")[1] : "";
  const companyLabel = userDomain ? userDomain.split(".")[0].replace(/^\w/, (c) => c.toUpperCase()) : "Acme Co.";

  const openProject = (proj: ProjectSummary) => {
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
    navigate("/home");
  };

  const updateProject = (id: string, patch: Partial<ProjectSummary>) => {
    store.setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch, lastEdited: new Date().toISOString() } : p)));
  };

  const duplicateProject = (proj: ProjectSummary) => {
    const copy: ProjectSummary = {
      ...proj,
      id: "proj_" + Date.now().toString(36),
      name: proj.name + " (Copy)",
      lastEdited: new Date().toISOString(),
      archived: false,
    };
    store.setProjects((prev) => [copy, ...prev]);
    setMenuFor(null);
  };

  const archiveProject = (id: string) => {
    updateProject(id, { archived: true });
    setMenuFor(null);
  };
  const restoreProject = (id: string) => updateProject(id, { archived: false });
  const deleteProject = (id: string) => {
    store.setProjects((prev) => prev.filter((p) => p.id !== id));
    setConfirmDelete(null);
    setMenuFor(null);
  };

  const startRename = (proj: ProjectSummary) => {
    setRenaming(proj.id);
    setRenameValue(proj.name);
    setMenuFor(null);
  };
  const commitRename = () => {
    if (renaming && renameValue.trim()) updateProject(renaming, { name: renameValue.trim() });
    setRenaming(null);
  };

  const createProject = (name: string, focalQuestion: string) => {
    const proj: ProjectSummary = {
      id: "proj_" + Date.now().toString(36),
      name: name.trim(),
      focal_question: focalQuestion.trim(),
      horizon: "",
      industry: "",
      stepsComplete: 0,
      lastEdited: new Date().toISOString(),
      archived: false,
    };
    store.setProjects((prev) => [proj, ...prev]);
    setCreateOpen(false);
    openProject(proj);
  };

  return (
    <div className="scroll-y flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-[1080px]">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="mb-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-brand-orange">
              WELCOME BACK, {userFirst.toUpperCase()}
            </div>
            <h1 className="mb-1 text-[28px] font-semibold tracking-[-0.02em]">Your projects</h1>
            <div className="text-sm text-muted-foreground">
              {userName} · C-Suite Executive · {companyLabel}
            </div>
          </div>
          <Button variant="primary" size="sm" className="flex-shrink-0" onClick={() => setCreateOpen(true)}>
            <Icons.Plus size={13} /> New Project
          </Button>
        </div>

        {active.length === 0 ? (
          <ProjectsEmptyState onCreate={() => setCreateOpen(true)} />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5">
            {active.map((proj) => (
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
          <div className="mt-7">
            <button
              onClick={() => setShowArchived((s) => !s)}
              className="flex items-center gap-1.5 border-0 bg-transparent p-0 text-xs font-medium text-muted-foreground"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn("transition-transform duration-[120ms]", showArchived && "rotate-90")}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              Archived ({archived.length})
            </button>
            {showArchived && (
              <div className="mt-2.5 rounded-xl border border-border bg-card p-1.5 shadow-card">
                {archived.map((proj, i) => (
                  <div
                    key={proj.id}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2.5",
                      i < archived.length - 1 && "border-b border-[#F3F4F6]"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-muted-foreground">{proj.name}</div>
                      <div className="truncate text-[11px] text-text-3">{proj.focal_question}</div>
                    </div>
                    <button
                      onClick={() => restoreProject(proj.id)}
                      className="flex-shrink-0 border-0 bg-transparent text-xs font-medium text-brand-orange"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {createOpen && <NewProjectModal onClose={() => setCreateOpen(false)} onCreate={createProject} />}
    </div>
  );
}

/* ─────────────────────────── Project card ─────────────────────────── */

function ProjectCard({
  proj,
  onOpen,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onRename,
  onDuplicate,
  onArchive,
  onDelete,
  renaming,
  renameValue,
  setRenameValue,
  onCommitRename,
  onCancelRename,
  confirmingDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  proj: ProjectSummary;
  onOpen: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
  renaming: boolean;
  renameValue: string;
  setRenameValue: (v: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  confirmingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  const menuRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onCloseMenu();
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen, onCloseMenu]);

  const n = Math.max(0, Math.min(TOTAL_STEPS, proj.stepsComplete || 0));
  const pct = Math.round((n / TOTAL_STEPS) * 100);
  const isNew = n === 0;

  return (
    <div
      onClick={() => {
        if (!renaming && !confirmingDelete) onOpen();
      }}
      className={cn(
        "relative flex flex-col gap-2.5 rounded-xl border border-border bg-white p-4 shadow-card transition-[border-color,box-shadow] duration-[120ms] hover:border-border-strong hover:shadow-[0_4px_14px_rgba(15,23,42,0.06)]",
        renaming || confirmingDelete ? "cursor-default" : "cursor-pointer"
      )}
    >
      {/* Title row + kebab */}
      <div className="flex items-start justify-between gap-2">
        {renaming ? (
          <Input
            autoFocus
            value={renameValue}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommitRename();
              if (e.key === "Escape") onCancelRename();
            }}
            onBlur={onCommitRename}
            className="h-auto flex-1 border-brand-orange px-[7px] py-[3px] text-[15px] font-semibold text-brand-dark"
          />
        ) : (
          <div className="min-w-0 flex-1 text-[15px] font-semibold leading-[1.3] tracking-[-0.008em] text-brand-dark">{proj.name}</div>
        )}

        <div ref={menuRef} className="relative flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu();
            }}
            aria-label="Project options"
            className="flex h-[26px] w-[26px] items-center justify-center rounded-md border-0 bg-transparent text-text-3 hover:bg-[#F5F5F5] hover:text-brand-dark"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="12" cy="5" r="1.4" />
              <circle cx="12" cy="12" r="1.4" />
              <circle cx="12" cy="19" r="1.4" />
            </svg>
          </button>

          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="slide-up absolute right-0 top-[calc(100%+4px)] z-30 w-40 rounded-[9px] border border-border bg-white p-[5px] shadow-[0_10px_28px_rgba(15,23,42,0.12)]"
            >
              {[
                { label: "Rename", action: onRename },
                { label: "Duplicate", action: onDuplicate },
                { label: "Archive", action: onArchive },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="w-full rounded-md border-0 bg-transparent px-[9px] py-[7px] text-left text-[12.5px] text-brand-dark hover:bg-[#F5F5F5]"
                >
                  {item.label}
                </button>
              ))}
              <div className="my-1 h-px bg-[#F3F4F6]" />
              <button
                onClick={onDelete}
                className="w-full rounded-md border-0 bg-transparent px-[9px] py-[7px] text-left text-[12.5px] text-[#EF4444] hover:bg-[#FEF2F2]"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Focal question */}
      <div className="line-clamp-2 min-h-[36px] text-[12.5px] leading-[1.5] text-muted-foreground [text-wrap:pretty]">
        {proj.focal_question || "No focal question set yet."}
      </div>

      {/* Progress */}
      <div>
        <div className="mb-[5px] flex items-center justify-between">
          <span className={cn("text-[11.5px]", isNew ? "font-semibold text-brand-orange" : "font-medium text-muted-foreground")}>
            {isNew ? "Not started" : `${n} of ${TOTAL_STEPS} steps complete`}
          </span>
          {!isNew && <span className="font-mono text-[11px] text-text-3">{pct}%</span>}
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-border">
          <div className={cn("h-full rounded-full", isNew ? "bg-border" : "bg-brand-orange")} style={{ width: (isNew ? 4 : pct) + "%" }} />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-0.5 flex items-center justify-between text-[11px] text-text-3">
        <span>{proj.industry || "—"}</span>
        <span>Edited {fmtRelative(proj.lastEdited)}</span>
      </div>

      {confirmingDelete && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 rounded-[11px] bg-white/[0.97] p-4 text-center backdrop-blur-[1px]"
        >
          <div className="text-[12.5px] text-[#991B1B]">Delete &quot;{proj.name}&quot; permanently?</div>
          <div className="flex gap-2">
            <button onClick={onConfirmDelete} className="rounded-md border-0 bg-[#EF4444] px-3 py-1.5 text-[12.5px] font-semibold text-white">
              Delete
            </button>
            <button onClick={onCancelDelete} className="rounded-md border border-border bg-white px-3 py-1.5 text-[12.5px] text-brand-dark">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Empty state ─────────────────────────── */

function ProjectsEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3.5 rounded-xl border border-border bg-white p-14 text-center shadow-card">
      <div className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-brand-orangeLight">
        <Icons.Compass size={22} stroke="#F97316" />
      </div>
      <div>
        <h3 className="mb-1.5 text-lg font-semibold text-brand-dark">Start your first scenario project</h3>
        <p className="mx-auto max-w-[380px] text-sm leading-[1.55] text-muted-foreground">
          Give it a focal question — the strategic decision you&apos;re trying to make — and we&apos;ll guide you through Schwartz&apos;s
          methodology from there.
        </p>
      </div>
      <Button variant="primary" size="sm" onClick={onCreate}>
        <Icons.Plus size={12} /> New Project
      </Button>
    </div>
  );
}

/* ─────────────────────────── New project modal ─────────────────────────── */

function NewProjectModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, focal: string) => void }) {
  const [name, setName] = React.useState("");
  const [focal, setFocal] = React.useState("");

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const canSubmit = name.trim().length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="New project"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fade-in fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(30,27,46,0.40)] p-6 backdrop-blur-[4px]"
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="slide-up relative w-full max-w-[480px] rounded-[14px] bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.25),0_8px_24px_rgba(15,23,42,0.12)]"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-[30px] w-[30px] items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground hover:bg-[#F5F5F5]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="6" y1="18" x2="18" y2="6" />
          </svg>
        </button>

        <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-brand-dark">New project</h2>
        <div className="mb-[18px] mt-1 text-[13px] text-muted-foreground">
          Name it and (optionally) set a starting focal question — you can refine both later.
        </div>

        <label className="mb-3.5 block">
          <span className="mb-[5px] block text-xs font-medium text-brand-dark">
            Project name<span className="text-brand-orange"> *</span>
          </span>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. AI Regulation Outlook" className="w-full" />
        </label>
        <label className="mb-5 block">
          <span className="mb-[5px] block text-xs font-medium text-brand-dark">
            Focal question <span className="font-normal text-text-3">· optional</span>
          </span>
          <Textarea
            rows={3}
            value={focal}
            onChange={(e) => setFocal(e.target.value)}
            placeholder="The strategic decision you're trying to make..."
            className="min-h-[72px] w-full"
          />
        </label>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="border-0 bg-transparent px-1.5 py-2 text-[13.5px] font-medium text-muted-foreground">
            Cancel
          </button>
          <Button variant="primary" size="sm" disabled={!canSubmit} onClick={() => onCreate(name, focal)}>
            Create project
          </Button>
        </div>
      </div>
    </div>
  );
}
