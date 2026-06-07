// Temporary placeholder for app pages not yet implemented. Each will be replaced by
// a faithful port of its prototype components/page-*.jsx in a later step.
export function PagePlaceholder({ title, note }: { title: string; note?: string }) {
  return (
    <div className="scroll-y flex flex-1 flex-col items-center justify-center gap-2 overflow-y-auto p-5 text-center">
      <h1 className="text-[22px] font-semibold tracking-[-0.018em] text-brand-dark">{title}</h1>
      <p className="text-[13px] text-muted-foreground">{note || "This page is being built incrementally."}</p>
    </div>
  );
}
