"use client";

// Settings — tabbed (Project / Team / AI Analyst / Integrations / Billing).
// Faithful Tailwind/shadcn port of page-monitoring-settings.jsx.
import * as React from "react";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";

const TABS = ["Project", "Team", "AI Analyst", "Integrations", "Billing"];

function Field({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      {multiline ? <Textarea rows={3} defaultValue={value} className="min-h-[80px]" /> : <Input defaultValue={value} />}
    </div>
  );
}

function Toggle({ on: initial }: { on: boolean }) {
  const [on, setOn] = React.useState(initial);
  return (
    <button
      onClick={() => setOn(!on)}
      className={cn("relative h-5 w-9 rounded-full border-0 transition-colors duration-150", on ? "bg-brand-orange" : "bg-border")}
    >
      <span
        className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-[left] duration-150"
        style={{ left: on ? 18 : 2 }}
      />
    </button>
  );
}

const TEAM = [
  { name: "John Doe", role: "Owner", initials: "JD", bg: "#E5E7EB", fg: "#6B7280" },
  { name: "Sarah Chen", role: "Contributor", initials: "SC", bg: "#DBEAFE", fg: "#1D4ED8" },
  { name: "Maya R.", role: "Consultant", initials: "MR", bg: "#EDE9FE", fg: "#6D28D9" },
];

const AI_SETTINGS = [
  { label: "Auto-extract insights from new sources", on: true },
  { label: "Suggest signals from external news feeds", on: true },
  { label: "Send weekly scenario digest", on: false },
  { label: "Use Schwartz framework strictly (vs. exploratory)", on: true },
];

const INTEGRATIONS = [
  { name: "Slack", desc: "Push signposts and alerts to channels", connected: true },
  { name: "Notion", desc: "Sync narratives to your team wiki", connected: false },
  { name: "Bloomberg", desc: "Auto-import macro data into Signals", connected: false },
  { name: "RSS Feeds", desc: "Watch sources for relevant signals", connected: true },
];

export function PageSettings() {
  const store = useStore();
  const [tab, setTab] = React.useState("Project");

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
              <Field label="Project name" value={store.project.name} />
              <Field label="Focal question" value={store.project.focal_question} multiline />
              <Field label="Time horizon" value={store.project.horizon} />
              <Field label="Industry" value={store.project.industry} />
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
              {TEAM.map((m) => (
                <div key={m.name} className="flex items-center gap-3 border-b border-[#F3F4F6] py-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold" style={{ background: m.bg, color: m.fg }}>
                    {m.initials}
                  </span>
                  <div className="flex-1">
                    <div className="text-[13.5px] font-medium">{m.name}</div>
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
              {AI_SETTINGS.map((s, i) => (
                <div key={i} className="flex items-center justify-between border-b border-[#F3F4F6] py-2">
                  <div className="text-[13.5px]">{s.label}</div>
                  <Toggle on={s.on} />
                </div>
              ))}
            </div>
          )}

          {tab === "Integrations" && (
            <div className="grid grid-cols-2 gap-3">
              {INTEGRATIONS.map((intg) => (
                <div key={intg.name} className="rounded-[10px] border border-border bg-white p-3.5">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="text-sm font-semibold">{intg.name}</div>
                    <span
                      className={cn(
                        "inline-flex items-center rounded px-[7px] py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]",
                        intg.connected ? "bg-[#ECFDF5] text-[#065F46]" : "bg-[#FFFBEB] text-[#B45309]"
                      )}
                    >
                      {intg.connected ? "Connected" : "Available"}
                    </span>
                  </div>
                  <div className="mb-3 text-[12.5px] leading-[1.5] text-muted-foreground">{intg.desc}</div>
                  <Button variant={intg.connected ? "ghost" : "soft"} size="sm">
                    {intg.connected ? "Manage" : "Connect"}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {tab === "Billing" && (
            <div>
              <div className="mb-[18px] rounded-[10px] border border-brand-orange100 bg-brand-orangeLight p-4">
                <div className="mb-1 font-mono text-[11px] tracking-[0.06em] text-brand-orange700">CURRENT PLAN</div>
                <div className="text-2xl font-semibold tracking-[-0.015em]">Pro · $49/seat/mo</div>
                <div className="mt-1 text-[13px] text-[#9A3412]">3 of 5 seats used · Renews March 14, 2026</div>
              </div>
              <Button variant="primary" size="sm">
                Manage subscription
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
