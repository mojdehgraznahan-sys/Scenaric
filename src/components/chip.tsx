// STEEP category chip — reproduces the prototype .chip-* classes. Reused across
// Knowledge Base, Signals, and signal cards.
import { cn } from "@/lib/utils";
import type { SteepCategory } from "@/lib/types";

const CHIP_CLASS: Record<SteepCategory, string> = {
  Social: "bg-[#F5F3FF] text-steep-social border-[rgba(139,92,246,0.25)]",
  Technology: "bg-[#EFF6FF] text-steep-technology border-[rgba(59,130,246,0.25)]",
  Economic: "bg-[#ECFDF5] text-steep-economic border-[rgba(16,185,129,0.25)]",
  Ecological: "bg-[#F0FDFA] text-steep-ecological border-[rgba(20,184,166,0.25)]",
  Political: "bg-[#FEF2F2] text-steep-political border-[rgba(239,68,68,0.25)]",
};

export function Chip({
  category,
  className,
  children,
}: {
  category: SteepCategory;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-[9px] py-[3px] text-[11px] font-medium",
        CHIP_CLASS[category],
        className
      )}
    >
      {children ?? category}
    </span>
  );
}
