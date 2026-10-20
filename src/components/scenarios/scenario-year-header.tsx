"use client";

// Futures + Event chains (design/futures_chains_handoff/) — shared header for both pages:
// eyebrow/title/sub, target-year select, back/next footer. Ported from the standalone's App()
// shell (its top "Scenaric · {project} | Futures | Event chains | Reset demo" strip is NOT
// ported — this app's own SideNav/TopBar already handle page switching and the project
// context; only the parts Prompt 4 actually asked for are here).
import { Button } from "@/components/ui/button";

export interface ScenarioYearHeaderProps {
  eyebrow: string;
  title: string;
  sub?: string | null;
  year: number;
  yearOptions: number[];
  onYearChange: (year: number) => void;
  horizon: string;
  back?: { label: string; onClick: () => void } | null;
  next?: { label: string; onClick: () => void } | null;
}

export function ScenarioYearHeader({ eyebrow, title, sub, year, yearOptions, onYearChange, horizon, back, next }: ScenarioYearHeaderProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-border bg-white px-5 py-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1 basis-[480px]">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.07em] text-brand-orange700">{eyebrow}</div>
          <h1 className="m-0 text-2xl font-semibold tracking-[-0.02em] text-brand-dark">{title}</h1>
          {sub && <div className="mt-0.5 text-[13px] leading-[1.5] text-muted-foreground">{sub}</div>}
        </div>
        <div className="flex flex-col gap-[3px]">
          <span className="text-[11px] text-muted-foreground">
            Target year <span className="text-text-3">· horizon {horizon}</span>
          </span>
          <select
            className="h-[34px] rounded-md border border-border bg-white px-2.5 text-[13px] font-semibold"
            value={year}
            onChange={(e) => onYearChange(+e.target.value)}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>
      {(back || next) && (
        <div className="flex items-center justify-between gap-2.5 border-t border-border pt-2.5">
          {back ? (
            <Button variant="ghost" size="sm" onClick={back.onClick}>
              ← {back.label}
            </Button>
          ) : (
            <span />
          )}
          {next && (
            <Button variant="primary" onClick={next.onClick}>
              {next.label} →
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
