"use client";

// Settings — tabbed (Project / Team / AI Analyst / Integrations / Billing).
// Faithful Tailwind/shadcn port of page-monitoring-settings.jsx.
// Project + AI Analyst tabs are real, server-backed (GET/PATCH /projects/:id/settings and
// /ai-settings) — previously both were 100% cosmetic (uncontrolled defaultValue inputs, local
// useState toggles, no save path or behavioral effect at all).
import * as React from "react";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { avatarFgFor } from "@/lib/user-display";
import type { TeamMember } from "@/lib/actions/team";
import type { ProjectSettings } from "@/lib/actions/project-settings";
import type { ProjectAiSettings } from "@/lib/actions/project-ai-settings";
import type { IntegrationCard } from "@/lib/actions/project-integrations";
import type { ProjectBilling } from "@/lib/actions/billing";

const TABS = ["Project", "Team", "AI Analyst", "Integrations", "Billing"];

// Same window-global toast convention page-monitoring.tsx already uses (GlobalToast in
// app-shell.tsx).
interface FmWindow extends Window {
  FM_toast?: (opts: { message: string; actionText?: string; action?: string; duration?: number }) => void;
}

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      {multiline ? (
        <Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-[80px]" />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => onChange(!on)}
      disabled={disabled}
      className={cn(
        "relative h-5 w-9 rounded-full border-0 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        on ? "bg-brand-orange" : "bg-border"
      )}
    >
      <span
        className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-[left] duration-150"
        style={{ left: on ? 18 : 2 }}
      />
    </button>
  );
}

const AI_TOGGLES: { key: keyof Omit<ProjectAiSettings, "project_id">; label: string }[] = [
  { key: "auto_extract_insights", label: "Auto-extract insights from new sources" },
  { key: "suggest_from_news_feeds", label: "Suggest signals from external news feeds" },
  { key: "weekly_digest", label: "Send weekly scenario digest" },
  { key: "strict_schwartz_mode", label: "Use Schwartz framework strictly (vs. exploratory)" },
];

// name → the connect route's :name param + a placeholder for the inline input.
const CONNECTABLE: Record<string, { routeName: string; placeholder: string }> = {
  Slack: { routeName: "slack", placeholder: "https://hooks.slack.com/services/…" },
  "RSS Feeds": { routeName: "rss", placeholder: "https://example.com/feed.xml" },
};

export function PageSettings() {
  const store = useStore();
  const [tab, setTab] = React.useState("Project");
  const projectId = store.activeProjectId;
  const [team, setTeam] = React.useState<TeamMember[]>([]);

  const toast = React.useCallback((message: string) => {
    const w = window as FmWindow;
    if (w.FM_toast) w.FM_toast({ message });
  }, []);

  // ---- Project tab ----
  const [projectSettings, setProjectSettings] = React.useState<ProjectSettings | null>(null);
  const [draft, setDraft] = React.useState({ name: "", focal_question: "", horizon: "", industry: "" });
  const [savingProject, setSavingProject] = React.useState(false);

  const loadProjectSettings = React.useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}/settings`);
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      const data: ProjectSettings = await res.json();
      setProjectSettings(data);
      setDraft({ name: data.name, focal_question: data.focal_question, horizon: data.horizon, industry: data.industry });
    } catch (err) {
      console.error("[settings] failed to load project settings", err);
    }
  }, []);

  React.useEffect(() => {
    if (!projectId) return;
    loadProjectSettings(projectId);
  }, [projectId, loadProjectSettings]);

  // Resync when the Settings Ask AI accepts a drafted/sharpened focal question elsewhere in
  // the panel — same lightweight cross-component sync store.tsx's usePersistentState already
  // uses (fm:persist), so this tab and the Ask AI drawer never need to be prop-wired together.
  React.useEffect(() => {
    if (!projectId) return;
    const onUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.projectId === projectId) loadProjectSettings(projectId);
    };
    window.addEventListener("fm:project-settings-updated", onUpdated);
    return () => window.removeEventListener("fm:project-settings-updated", onUpdated);
  }, [projectId, loadProjectSettings]);

  const projectDirty =
    !!projectSettings &&
    (draft.name !== projectSettings.name ||
      draft.focal_question !== projectSettings.focal_question ||
      draft.horizon !== projectSettings.horizon ||
      draft.industry !== projectSettings.industry);

  const saveProjectSettings = async () => {
    if (!projectId) return;
    setSavingProject(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
      setProjectSettings(data);
      toast("Project settings saved.");
    } catch (err) {
      console.error("[settings] failed to save project settings", err);
      toast(err instanceof Error ? err.message : "Couldn't save — try again.");
    } finally {
      setSavingProject(false);
    }
  };

  // ---- Team tab ----
  React.useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/team`);
        if (!res.ok) throw new Error(`Request failed (${res.status}).`);
        const data = await res.json();
        if (!cancelled) setTeam(data);
      } catch (err) {
        console.error("[settings] failed to load team", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // ---- AI Analyst tab ----
  const [aiSettings, setAiSettings] = React.useState<ProjectAiSettings | null>(null);

  React.useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/ai-settings`);
        if (!res.ok) throw new Error(`Request failed (${res.status}).`);
        const data = await res.json();
        if (!cancelled) setAiSettings(data);
      } catch (err) {
        console.error("[settings] failed to load AI settings", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const toggleAiSetting = async (key: keyof Omit<ProjectAiSettings, "project_id">, next: boolean) => {
    if (!projectId || !aiSettings) return;
    const previous = aiSettings;
    setAiSettings({ ...aiSettings, [key]: next }); // optimistic
    try {
      const res = await fetch(`/api/projects/${projectId}/ai-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
    } catch (err) {
      console.error("[settings] failed to save AI setting", err);
      setAiSettings(previous); // revert
      toast("Couldn't save that setting — try again.");
    }
  };

  // ---- Integrations tab ----
  const [integrations, setIntegrations] = React.useState<IntegrationCard[]>([]);
  const [connectingName, setConnectingName] = React.useState<string | null>(null);
  const [connectInput, setConnectInput] = React.useState("");
  const [savingIntegration, setSavingIntegration] = React.useState(false);

  const loadIntegrations = React.useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}/integrations`);
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      setIntegrations(await res.json());
    } catch (err) {
      console.error("[settings] failed to load integrations", err);
    }
  }, []);

  React.useEffect(() => {
    if (!projectId) return;
    loadIntegrations(projectId);
  }, [projectId, loadIntegrations]);

  const submitConnect = async (name: string) => {
    const routeName = CONNECTABLE[name]?.routeName;
    if (!projectId || !routeName || !connectInput.trim()) return;
    setSavingIntegration(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/integrations/${routeName}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: connectInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
      setConnectingName(null);
      setConnectInput("");
      await loadIntegrations(projectId);
      toast(`${name} connected.`);
    } catch (err) {
      console.error("[settings] failed to connect integration", err);
      toast(err instanceof Error ? err.message : "Couldn't connect — try again.");
    } finally {
      setSavingIntegration(false);
    }
  };

  const disconnectIntegration = async (name: string) => {
    const routeName = CONNECTABLE[name]?.routeName;
    if (!projectId || !routeName) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/integrations/${routeName}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      await loadIntegrations(projectId);
      toast(`${name} disconnected.`);
    } catch (err) {
      console.error("[settings] failed to disconnect integration", err);
      toast("Couldn't disconnect — try again.");
    }
  };

  // ---- Billing tab ----
  const [billing, setBilling] = React.useState<ProjectBilling | null>(null);

  React.useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/billing`);
        if (!res.ok) throw new Error(`Request failed (${res.status}).`);
        const data = await res.json();
        if (!cancelled) setBilling(data);
      } catch (err) {
        console.error("[settings] failed to load billing", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <div className="scroll-y flex-1 overflow-y-auto p-5">
      <div className="grid grid-cols-[200px_1fr] gap-4">
        <div className="self-start rounded-xl border border-border bg-card p-2 shadow-card">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "mb-0.5 w-full rounded-[7px] border-0 px-3 py-[9px] text-left text-[13px] font-medium",
                tab === t ? "bg-brand-orangeLight text-brand-orange700" : "bg-transparent text-[#374151]"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h2 className="mb-3.5 text-lg font-semibold">{tab}</h2>

          {tab === "Project" && (
            <div className="flex flex-col gap-[18px]">
              <Field label="Project name" value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
              <Field
                label="Focal question"
                value={draft.focal_question}
                onChange={(v) => setDraft((d) => ({ ...d, focal_question: v }))}
                multiline
              />
              <Field label="Time horizon" value={draft.horizon} onChange={(v) => setDraft((d) => ({ ...d, horizon: v }))} />
              <Field label="Industry" value={draft.industry} onChange={(v) => setDraft((d) => ({ ...d, industry: v }))} />
              <div className="flex justify-end border-t border-[#F3F4F6] pt-4">
                <Button variant="primary" size="sm" disabled={!projectDirty || savingProject} onClick={saveProjectSettings}>
                  {savingProject ? "Saving…" : "Save changes"}
                </Button>
              </div>
              <div className="flex justify-between border-t border-[#F3F4F6] py-4">
                <div>
                  <div className="text-[13px] font-medium text-[#EF4444]">Reset prototype</div>
                  <div className="text-xs text-muted-foreground">Clear all localStorage and return to landing.</div>
                </div>
                <button onClick={store.reset} className="rounded-md border border-[#FECACA] bg-transparent px-[11px] py-[7px] text-[13px] font-medium text-[#EF4444]">
                  Reset
                </button>
              </div>
            </div>
          )}

          {tab === "Team" && (
            <div>
              {team.map((m) => (
                <div key={m.id} className="flex items-center gap-3 border-b border-[#F3F4F6] py-3">
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
                    style={{ background: m.avatar_color, color: avatarFgFor(m.avatar_color) }}
                  >
                    {m.initials}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <div className="text-[13.5px] font-medium">{m.name || m.email}</div>
                      {m.isCurrentUser && (
                        <span className="inline-flex items-center rounded bg-brand-orangeLight px-[6px] py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-brand-orange700">
                          You
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[11.5px] text-text-3">{m.role.toUpperCase()}</div>
                  </div>
                  <Button variant="ghost" size="sm">
                    Manage
                  </Button>
                </div>
              ))}
              <Button variant="soft" size="sm" className="mt-3.5">
                <Icons.Plus size={12} /> Invite member
              </Button>
            </div>
          )}

          {tab === "AI Analyst" && (
            <div className="flex flex-col gap-4">
              <div className="text-[13px] leading-[1.55] text-muted-foreground">
                Configure how the AI Analyst reads your knowledge base and proposes signals.
              </div>
              {AI_TOGGLES.map((t) => (
                <div key={t.key} className="flex items-center justify-between border-b border-[#F3F4F6] py-2">
                  <div className="text-[13.5px]">{t.label}</div>
                  <Toggle
                    on={aiSettings ? aiSettings[t.key] : false}
                    disabled={!aiSettings}
                    onChange={(next) => toggleAiSetting(t.key, next)}
                  />
                </div>
              ))}
            </div>
          )}

          {tab === "Integrations" && (
            <div className="grid grid-cols-2 gap-3">
              {integrations.map((intg) => {
                const connectable = !!CONNECTABLE[intg.name];
                const isConnecting = connectingName === intg.name;
                return (
                  <div key={intg.name} className="rounded-[10px] border border-border bg-white p-3.5">
                    <div className="mb-1 flex items-center justify-between">
                      <div className="text-sm font-semibold">{intg.name}</div>
                      <span
                        className={cn(
                          "inline-flex items-center rounded px-[7px] py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]",
                          intg.connected ? "bg-[#ECFDF5] text-[#065F46]" : "bg-[#FFFBEB] text-[#B45309]"
                        )}
                      >
                        {intg.connected ? "Connected" : connectable ? "Available" : "Coming soon"}
                      </span>
                    </div>
                    <div className="mb-3 text-[12.5px] leading-[1.5] text-muted-foreground">{intg.desc}</div>

                    {intg.connected && intg.detail && <div className="mb-2.5 truncate font-mono text-[11px] text-text-3">{intg.detail}</div>}

                    {isConnecting ? (
                      <div className="flex flex-col gap-1.5">
                        <Input
                          value={connectInput}
                          onChange={(e) => setConnectInput(e.target.value)}
                          placeholder={CONNECTABLE[intg.name].placeholder}
                          autoFocus
                        />
                        <div className="flex gap-1.5">
                          <Button variant="primary" size="sm" disabled={!connectInput.trim() || savingIntegration} onClick={() => submitConnect(intg.name)}>
                            {savingIntegration ? "Connecting…" : "Save"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setConnectingName(null);
                              setConnectInput("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant={intg.connected ? "ghost" : "soft"}
                        size="sm"
                        disabled={!connectable}
                        title={connectable ? undefined : "Not yet available"}
                        onClick={() => (intg.connected ? disconnectIntegration(intg.name) : setConnectingName(intg.name))}
                      >
                        {intg.connected ? "Disconnect" : "Connect"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === "Billing" && (
            <div>
              <div className="mb-[18px] rounded-[10px] border border-brand-orange100 bg-brand-orangeLight p-4">
                <div className="mb-1 font-mono text-[11px] tracking-[0.06em] text-brand-orange700">CURRENT PLAN</div>
                <div className="text-2xl font-semibold capitalize tracking-[-0.015em]">{billing ? billing.plan : "…"}</div>
                <div className="mt-1 text-[13px] text-[#9A3412]">
                  {billing ? `${billing.seats} seat${billing.seats === 1 ? "" : "s"} in use` : ""}
                  {billing?.renewalDate ? ` · Renews ${billing.renewalDate}` : ""}
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => toast("Billing portal isn't connected yet — contact support to change your plan.")}
              >
                Manage subscription
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
