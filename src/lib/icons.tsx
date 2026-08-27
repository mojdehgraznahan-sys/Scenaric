// Shared icons (Feather-style) — ported verbatim from the handoff icons.jsx.
// These are pure SVG components (no hooks) so they work in server or client trees.
import * as React from "react";

export interface IconProps {
  d?: React.ReactNode;
  size?: number;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const Icon = ({
  d,
  size = 16,
  stroke = "currentColor",
  fill = "none",
  strokeWidth = 2,
  className = "",
  style,
}: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke={stroke}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    {d}
  </svg>
);

type IP = Omit<IconProps, "d">;

export const Icons = {
  ArrowRight: (p: IP) => (
    <Icon {...p} d={<><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>} />
  ),
  ArrowLeft: (p: IP) => (
    <Icon {...p} d={<><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></>} />
  ),
  Check: (p: IP) => <Icon {...p} d={<polyline points="20 6 9 17 4 12" />} />,
  X: (p: IP) => (
    <Icon {...p} d={<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>} />
  ),
  Plus: (p: IP) => (
    <Icon {...p} d={<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>} />
  ),
  Search: (p: IP) => (
    <Icon {...p} d={<><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>} />
  ),
  Bell: (p: IP) => (
    <Icon {...p} d={<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>} />
  ),
  Compass: (p: IP) => (
    <Icon {...p} d={<><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></>} />
  ),
  Sparkle: (p: IP) => (
    <Icon {...p} d={<><path d="M12 3l1.8 5.5L19 10l-5.2 1.5L12 17l-1.8-5.5L5 10l5.2-1.5L12 3z" /></>} />
  ),
  // Spinner — a low-opacity full-ring track plus a short solid arc; pair with the `animate-spin`
  // Tailwind utility (default, unmodified in tailwind.config.ts) so only the asymmetric arc's
  // rotation reads visually as spinning.
  Loader: (p: IP) => (
    <Icon {...p} d={<><circle cx="12" cy="12" r="10" opacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" /></>} />
  ),
  Mic: (p: IP) => (
    <Icon {...p} d={<><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></>} />
  ),
  Link: (p: IP) => (
    <Icon {...p} d={<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>} />
  ),
  File: (p: IP) => (
    <Icon {...p} d={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>} />
  ),
  Upload: (p: IP) => (
    <Icon {...p} d={<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>} />
  ),
  Survey: (p: IP) => (
    <Icon {...p} d={<><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="9" x2="15" y2="9" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="13" y2="17" /></>} />
  ),
  Rocket: (p: IP) => (
    <Icon {...p} d={<><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></>} />
  ),
  Star: (p: IP) => (
    <Icon {...p} d={<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />} />
  ),
  Layers: (p: IP) => (
    <Icon {...p} d={<><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>} />
  ),
  Grid: (p: IP) => (
    <Icon {...p} d={<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>} />
  ),
  Brain: (p: IP) => (
    <Icon {...p} d={<><path d="M12 5a3 3 0 0 0-6 0 3 3 0 0 0-3 3 3 3 0 0 0 1.5 2.6A3 3 0 0 0 6 16a3 3 0 0 0 6 0V5z" /><path d="M12 5a3 3 0 0 1 6 0 3 3 0 0 1 3 3 3 3 0 0 1-1.5 2.6A3 3 0 0 1 18 16a3 3 0 0 1-6 0V5z" /></>} />
  ),
  Eye: (p: IP) => (
    <Icon {...p} d={<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>} />
  ),
  Map: (p: IP) => (
    <Icon {...p} d={<><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></>} />
  ),
  Target: (p: IP) => (
    <Icon {...p} d={<><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>} />
  ),
  Activity: (p: IP) => <Icon {...p} d={<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />} />,
  Settings: (p: IP) => (
    <Icon {...p} d={<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></>} />
  ),
  Database: (p: IP) => (
    <Icon {...p} d={<><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></>} />
  ),
  Radio: (p: IP) => (
    <Icon {...p} d={<><circle cx="12" cy="12" r="2" /><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" /></>} />
  ),
  Edit3: (p: IP) => (
    <Icon {...p} d={<><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></>} />
  ),
  Compass2: (p: IP) => (
    <Icon {...p} d={<><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></>} />
  ),
  Trending: (p: IP) => (
    <Icon {...p} d={<><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>} />
  ),
  MoreH: (p: IP) => (
    <Icon {...p} d={<><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></>} />
  ),
  Filter: (p: IP) => <Icon {...p} d={<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />} />,
  ChevronDown: (p: IP) => <Icon {...p} d={<polyline points="6 9 12 15 18 9" />} />,
  ChevronRight: (p: IP) => <Icon {...p} d={<polyline points="9 18 15 12 9 6" />} />,
  Send: (p: IP) => (
    <Icon {...p} d={<><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>} />
  ),
  Refresh: (p: IP) => (
    <Icon {...p} d={<><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></>} />
  ),
  Trash: (p: IP) => (
    <Icon {...p} d={<><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>} />
  ),
  Logo: ({ size = 28, reverse = false }: { size?: number; reverse?: boolean }) => {
    const base = reverse ? "#fff" : "#1E1B2E";
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        style={{ display: "block", flexShrink: 0 }}
        aria-label="Scenaric"
      >
        <rect x="3" y="3" width="18" height="18" rx="5" fill={base} />
        <rect x="27" y="3" width="18" height="18" rx="5" fill="#F97316" />
        <rect x="3" y="27" width="18" height="18" rx="5" fill={base} />
        <rect x="27" y="27" width="18" height="18" rx="5" fill={base} />
      </svg>
    );
  },
};

// Star rating
export function Stars({
  count = 5,
  value = 0,
  onChange,
  size = 12,
}: {
  count?: number;
  value?: number;
  onChange?: (v: number) => void;
  size?: number;
}) {
  return (
    <span className="inline-flex items-center" style={{ gap: 2 }}>
      {Array.from({ length: count }).map((_, i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={i < value ? "#F97316" : "transparent"}
          stroke={i < value ? "#F97316" : "#D1D5DB"}
          strokeWidth="2"
          style={{ cursor: onChange ? "pointer" : "default" }}
          onClick={() => onChange && onChange(i + 1)}
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  );
}
