import type { Config } from "tailwindcss";

/**
 * Scenaric.ai Tailwind theme — centralized design tokens.
 *
 * Two layers:
 *  - shadcn semantic colors (border / background / primary / muted / ring / …) resolve
 *    to `hsl(var(--…))` defined in src/app/globals.css, themed with our brand values so
 *    shadcn primitives inherit the orange accent.
 *  - brand.* and steep.* named utilities for app code (exact hex), e.g. `bg-brand-orange`,
 *    `text-steep-political`. Off-scale one-off values use arbitrary syntax (`h-[34px]`).
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // shadcn semantic (values in globals.css :root)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },

        // Brand (exact hex)
        brand: {
          dark: "#1E1B2E",
          orange: "#F97316",
          orangeLight: "#FFF7ED",
          orangeHover: "#EA6B0B",
          orange100: "#FED7AA",
          orange700: "#C2410C",
          ink2: "#29243D",
        },
        "border-strong": "#D1D5DB",
        "text-3": "#9CA3AF",

        // STEEP category colors
        steep: {
          social: "#8B5CF6",
          technology: "#3B82F6",
          economic: "#10B981",
          ecological: "#14B8A6",
          political: "#EF4444",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Geist", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "Geist Mono", "ui-monospace", "SF Mono", "Menlo", "monospace"],
      },
      width: {
        nav: "204px",
        "nav-collapsed": "52px",
      },
      height: {
        topbar: "52px",
        matrix: "460px",
        "nav-item": "34px",
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "10px",
        xl: "14px",
        "2xl": "20px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,.04), 0 1px 3px rgba(15,23,42,.04)",
        elev: "0 8px 24px rgba(15,23,42,.08), 0 2px 6px rgba(15,23,42,.04)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
