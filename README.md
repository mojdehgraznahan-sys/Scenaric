# Scenaric.ai

AI-powered scenario-planning platform built on Peter Schwartz's 9-step methodology
(_The Art of the Long View_). This app implements the Claude Design handoff bundle
(`design/handoff/.../scenaric/`) as a production Next.js application.

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** with centralized design tokens
- **shadcn/ui** primitives (Radix-based) themed to the Scenaric brand
- **lucide-react** (+ a ported custom Feather-style icon set)
- Bespoke pointer-driven canvases for the Matrix and Storyline (no external graph lib)

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npx tsc --noEmit # typecheck
```

State is simulated client-side and persisted to `localStorage` (no backend). Reset
everything from **Settings → Project → Reset prototype**.

## Project structure

```
src/
  app/
    layout.tsx            # root: fonts, metadata, StoreProvider
    page.tsx              # Landing (marketing)
    login/ signup/        # Auth (shared AuthForm)
    onboarding/           # 3-step wizard
    (app)/                # logged-in route group (SideNav + TopBar shell)
      layout.tsx          # AppShell + Toaster
      home/ knowledge/ signals/ matrix/ canvas/
      storyline/ narrative/ strategy/ monitoring/ settings/
  components/
    ui/                   # shadcn primitives (button, dialog, select, toast, …)
    side-nav, top-bar, app-shell, global-toast, ask-ai, chip, page-*  # shell + pages
    matrix/               # Matrix page + build-scenarios / reaxis modals
    storyline/            # Storyline editor, signal card, context header, picker modal
  lib/
    data.ts               # APAC Expansion 2030 demo content (typed)
    types.ts              # data model
    store.tsx             # StoreProvider/useStore + SSR-safe usePersistentState
    icons.tsx             # ported icon set + Stars
    use-navigate.ts       # router helper
    utils.ts              # cn()
  app/globals.css         # @tailwind + shadcn CSS-var theme + keyframes
tailwind.config.ts        # design tokens (brand.*, steep.*, semantic shadcn colors)
```

## Design tokens

Defined in `tailwind.config.ts` (mirrored as CSS variables in `globals.css`):

- **Brand**: `brand.dark` `#1E1B2E`, `brand.orange` `#F97316`, `brand.orangeLight`
  `#FFF7ED` (+ hover/700/100), background `#F5F5F5`, `border` `#E5E7EB`,
  `muted` `#6B7280`.
- **STEEP categories**: `steep.social` `#8B5CF6`, `steep.technology` `#3B82F6`,
  `steep.economic` `#10B981`, `steep.ecological` `#14B8A6`, `steep.political`
  `#EF4444`.
- shadcn semantic colors (`primary`, `border`, `ring`, …) resolve to brand values so
  primitives inherit the orange accent.

## Routing

The prototype's hash routes (`#/app/*`) are real App Router routes. Logged-in pages
live in the `(app)` route group (un-prefixed URLs like `/matrix`). The shell hides the
TopBar on the full-bleed pages (`matrix`, `storyline`, `narrative`).

## Notes

- All **Peter Schwartz** references and scenario/narrative copy are preserved verbatim
  from the design.
- The **Matrix** and **Storyline** canvases use raw pointer events (free-positioning
  drag, edge create/rewire, cycle detection) rather than a drag/graph library, to match
  the prototype's exact behavior. Dynamic positions/colors stay inline; all other
  styling is Tailwind/tokens.
- Data is demo-only and resettable; there is no server or auth backend.
```
