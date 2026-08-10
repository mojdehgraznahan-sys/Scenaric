"use client";

// App shell — sidenav + topbar + page content.
// Ported from the handoff app-shell.jsx; routing now comes from the App Router.
import * as React from "react";
import { usePathname } from "next/navigation";
import { SideNav } from "@/components/side-nav";
import { TopBar } from "@/components/top-bar";
import { GlobalToast } from "@/components/global-toast";
import { AskAI } from "@/components/ask-ai";
import { useNavigate } from "@/lib/use-navigate";
import { useScenarioShortcuts } from "@/components/storyline/scenario-context-header";

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const pathname = usePathname();
  // (app) route group is not in the URL, so the page id is the first path segment.
  const page = pathname.split("/").filter(Boolean)[0] || "projects";

  // Cmd/Ctrl + 1/2/3 → jump between Matrix / Storyline / Narrative.
  useScenarioShortcuts(navigate);

  return (
    <div
      data-screen-label={"App · " + page}
      style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#F5F5F5" }}
    >
      <SideNav navigate={navigate} page={page} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", marginLeft: 0 }}>
        <TopBar page={page} />
        <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>{children}</div>
      </div>
      <AskAI
        context={
          page === "signals"
            ? "signals"
            : page === "storyline"
              ? "storyline"
              : page === "narrative"
                ? "narrative"
                : page === "strategy"
                  ? "strategy"
                  : page === "monitoring"
                    ? "monitoring"
                    : page === "home"
                      ? "home"
                      : page === "settings"
                        ? "settings"
                        : undefined
        }
      />
      <GlobalToast navigate={navigate} />
    </div>
  );
}
