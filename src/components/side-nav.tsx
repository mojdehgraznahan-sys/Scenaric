"use client";

// SideNav + NavItem — Tailwind/token-driven.
// Sections: (top) → INPUTS → Matrix bridge → SCENARIOS → DECISIONS → ACCOUNT.
import * as React from "react";
import { useStore } from "@/lib/store";
import { Icons } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { Navigate } from "@/lib/use-navigate";

const { useState, useEffect } = React;

interface NavItemData {
  id: string;
  label: string;
  icon: React.ReactNode;
  dot?: boolean;
  badge?: string;
  shortcut?: string;
}
interface NavGroup {
  label: string | null;
  bridge?: boolean;
  items: NavItemData[];
}

const SEC_LABEL = "px-[11px] mt-3.5 mb-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-text-3";

export function SideNav({ navigate, page }: { navigate: Navigate; page: string }) {
  const store = useStore();
  const collapsed = store.navCollapsed;

  const groups: NavGroup[] = [
    {
      label: null,
      items: [{ id: "home", label: "Home", icon: <Icons.Layers size={14} /> }],
    },
    {
      label: "INPUTS",
      items: [
        { id: "knowledge", label: "Knowledge Base", icon: <Icons.Database size={14} />, dot: true },
        { id: "signals", label: "Signals", icon: <Icons.Radio size={14} /> },
      ],
    },
    {
      // Matrix is the diagnostic step between inputs and scenarios.
      label: null,
      bridge: true,
      items: [{ id: "matrix", label: "Matrix", icon: <Icons.Grid size={14} /> }],
    },
    {
      label: "SCENARIOS",
      items: [
        { id: "canvas", label: "Canvas", icon: <Icons.Compass size={14} /> },
        { id: "storyline", label: "Storyline", icon: <Icons.Trending size={14} />, badge: "NEW", shortcut: "2" },
        { id: "narrative", label: "Narrative", icon: <Icons.Edit3 size={14} />, shortcut: "3" },
      ],
    },
    {
      label: "DECISIONS",
      items: [
        { id: "strategy", label: "Strategy", icon: <Icons.Target size={14} /> },
        { id: "monitoring", label: "Monitoring", icon: <Icons.Activity size={14} /> },
      ],
    },
  ];

  return (
    <aside
      className={cn(
        "relative flex flex-shrink-0 flex-col border-r border-border bg-white transition-[width] duration-200",
        collapsed ? "w-nav-collapsed" : "w-nav"
      )}
    >
      {/* Collapse / expand toggle — half-hangs off the right edge */}
      <button
        onClick={() => store.setNavCollapsed(!collapsed)}
        title={collapsed ? "Expand" : "Collapse"}
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        className="absolute -right-3 top-[60px] z-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-white p-0 text-muted-foreground shadow-[0_1px_3px_rgba(15,23,42,0.10)] transition-colors hover:text-brand-dark"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {collapsed ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
        </svg>
      </button>

      {/* Logo row */}
      <div className={cn("flex h-[52px] items-center gap-2 border-b border-border", collapsed ? "px-3" : "px-[11px]")}>
        <Icons.Logo size={28} />
        {!collapsed && <span className="text-[13px] font-semibold">Scenaric.ai</span>}
      </div>

      {/* Project picker */}
      {!collapsed && (
        <div className="px-[11px] pb-1 pt-[11px]">
          <button className="flex h-[34px] w-full items-center gap-2 rounded-[7px] border border-border bg-white px-[9px] text-left text-[13px] font-medium text-brand-dark">
            <span className="font-mono text-[11px] text-brand-orange">‹</span>
            All projects
          </button>
          <div className="mt-[7px] px-[9px] py-1.5">
            <div className="text-[13px] font-semibold tracking-[-0.01em] text-brand-dark">APAC Expansion 2030</div>
            <div className="mt-0.5 font-mono text-[10.5px] text-text-3">OWNED BY JOHN DOE</div>
          </div>
        </div>
      )}

      <nav className="scroll-y flex-1 overflow-y-auto pb-2">
        {groups.map((g, gi) => (
          <React.Fragment key={g.label || `group-${gi}`}>
            {!collapsed && g.label && (
              <div className={cn(SEC_LABEL, gi === 0 && "mt-0")}>{g.label}</div>
            )}
            {!collapsed && g.bridge && <div className="h-3" />}
            {g.items.map((item, ii) => (
              <NavItem
                key={item.id}
                item={item}
                active={page === item.id}
                collapsed={collapsed}
                onClick={() => navigate("/" + item.id)}
                groupStart={collapsed && !!g.bridge && ii === 0}
              />
            ))}
          </React.Fragment>
        ))}

        {!collapsed && <div className={SEC_LABEL}>ACCOUNT</div>}
        <NavItem
          item={{ id: "settings", label: "Settings", icon: <Icons.Settings size={14} /> }}
          active={page === "settings"}
          collapsed={collapsed}
          onClick={() => navigate("/settings")}
          groupStart={collapsed}
        />
      </nav>

      {/* User row */}
      <div className={cn("flex min-h-[52px] items-center gap-2 border-t border-border px-[11px]", collapsed && "justify-center")}>
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-border text-[11px] font-semibold text-muted-foreground">
          JD
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-semibold text-brand-dark">John Doe</div>
            <div className="font-mono text-[10.5px] text-text-3">OWNER</div>
          </div>
        )}
      </div>
    </aside>
  );
}

function NavItem({
  item,
  active,
  collapsed,
  onClick,
  groupStart,
}: {
  item: NavItemData;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
  groupStart?: boolean;
}) {
  const [hover, setHover] = useState(false);
  // Compute the modifier key after mount to avoid SSR/client hydration mismatch.
  const [modKey, setModKey] = useState("Ctrl+");
  useEffect(() => {
    const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
    setModKey(isMac ? "⌘" : "Ctrl+");
  }, []);

  const shortcutHint = item.shortcut ? `${modKey}${item.shortcut}` : null;
  const titleAttr = !collapsed && shortcutHint ? `${item.label} · ${shortcutHint}` : undefined;

  return (
    <div
      className={cn("relative", collapsed && groupStart && "mt-3")}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        onClick={onClick}
        title={titleAttr}
        className={cn(
          "my-0.5 flex h-nav-item items-center gap-2.5 rounded-[7px] border-0 text-left text-[13px] font-medium transition-[background,color] [transition-duration:120ms]",
          collapsed ? "mx-[7px] w-[38px] justify-center px-0" : "mx-[7px] w-[calc(100%-14px)] px-[9px]",
          active
            ? "bg-brand-orange text-white"
            : "bg-transparent text-muted-foreground hover:bg-[#F3F4F6] hover:text-foreground"
        )}
      >
        {item.icon}
        {!collapsed && <span>{item.label}</span>}
        {!collapsed && item.badge && (
          <span className="ml-auto rounded border border-brand-orange100 bg-brand-orangeLight px-1.5 py-px font-mono text-[9px] font-semibold tracking-[0.06em] text-brand-orange700">
            {item.badge}
          </span>
        )}
        {!collapsed && item.dot && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#F59E0B]" />}
      </button>

      {/* Tooltip — collapsed state only, appears to the right */}
      {collapsed && hover && (
        <div className="pointer-events-none absolute left-[calc(100%+4px)] top-1/2 z-50 flex -translate-y-1/2 items-center gap-1.5 rounded-md bg-brand-dark px-2 py-1 text-xs font-medium text-white shadow-[0_4px_12px_rgba(15,23,42,0.18)] whitespace-nowrap">
          {item.label}
          {shortcutHint && <span className="font-mono text-[10.5px] text-text-3">{shortcutHint}</span>}
          {item.badge && (
            <span className="rounded-[3px] bg-brand-orange/[0.22] px-[5px] font-mono text-[8.5px] font-semibold tracking-[0.06em] text-[#FDBA74]">
              {item.badge}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
