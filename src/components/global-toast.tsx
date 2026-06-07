"use client";

// App-wide toast (survives page navigation). Triggered via window.FM_toast(opts).
// Domain-specific (undo re-axis / open-canvas); coexists with the shadcn Toaster.
import * as React from "react";
import { useStore } from "@/lib/store";
import type { Navigate } from "@/lib/use-navigate";

const { useState, useEffect } = React;

export interface ToastOpts {
  message: string;
  actionText?: string;
  action?: "open-canvas" | "undo-reax";
  duration?: number;
}

interface FmWindow extends Window {
  FM_toast?: (opts: ToastOpts) => void;
  __fmUndo?: { scenarios: unknown; critical: unknown } | null;
}

export function GlobalToast({ navigate }: { navigate: Navigate }) {
  const store = useStore();
  const [toast, setToast] = useState<(ToastOpts & { ts: number }) | null>(null);

  useEffect(() => {
    const w = window as FmWindow;
    w.FM_toast = (opts: ToastOpts) => setToast({ ...opts, ts: Date.now() });
    return () => {
      if (w.FM_toast) delete w.FM_toast;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.duration || 4000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;

  const doAction = () => {
    const w = window as FmWindow;
    if (toast.action === "open-canvas") navigate("/canvas");
    else if (toast.action === "undo-reax" && w.__fmUndo) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      store.setScenarios(w.__fmUndo.scenarios as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      store.setCriticalUncertainties(w.__fmUndo.critical as any);
      try {
        localStorage.removeItem("fm.reaxReview");
      } catch {}
      w.__fmUndo = null;
    }
    setToast(null);
  };

  return (
    <div className="fm-toast-in fixed bottom-6 right-6 z-[2000] flex items-center gap-3.5 rounded-[9px] bg-brand-dark px-3.5 py-2.5 text-[13px] text-white shadow-[0_12px_30px_rgba(15,23,42,0.22)]">
      <span>{toast.message}</span>
      {toast.actionText && (
        <button onClick={doAction} className="border-0 bg-transparent p-0 text-[13px] font-semibold text-[#FDBA74]">
          {toast.actionText}
        </button>
      )}
    </div>
  );
}
