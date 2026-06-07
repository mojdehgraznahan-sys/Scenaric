// Methodology tooltip — Peter Schwartz wording preserved verbatim.
export function MethodologyInfo() {
  return (
    <span className="group relative inline-flex items-center">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#6B7280"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="cursor-help"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <span className="invisible absolute bottom-[calc(100%+8px)] left-1/2 z-50 w-60 max-w-[240px] -translate-x-1/2 rounded-md bg-brand-dark px-[9px] py-1.5 text-xs font-normal leading-[1.45] text-white opacity-0 shadow-[0_8px_20px_rgba(15,23,42,0.2)] transition-opacity duration-150 [text-wrap:pretty] group-hover:visible group-hover:opacity-100">
        Schwartz&apos;s method uses exactly 2 axes to form a 2×2 matrix of 4 scenarios. More
        axes create too many futures to reason about clearly.
      </span>
    </span>
  );
}
