# Frontend Style Profile
_Last updated: 2026-06-17_

## Project
Google Ads agency dashboard (apps/web — Next.js 14 App Router + Tailwind + TS strict).

## Authoritative source
The complete design system is at `.claude/DesignSystem.md` (KodoAI Editorial Brutalism v1.0).
Do NOT duplicate it here. This file records key decisions and deviations only.

## Aesthetic
**KodoAI Editorial Brutalism.** Typography-driven, sharp-cornered, dark-primary. Feels like a
well-crafted engineering document translated into interactive space. Every pixel earns its place.

## Color — dark theme (primary, no light toggle)
All colors are CSS custom properties on `:root` (not HSL Tailwind vars).

| Token        | Value     |
|---|---|
| `--bg`       | `#0c0c0b` |
| `--surface`  | `#141412` |
| `--surface-2`| `#1a1a18` |
| `--surface-3`| `#202019` |
| `--border`   | `#2a2a26` |
| `--border-2` | `#3a3a34` |
| `--ink`      | `#f4f3ee` |
| `--ink-2`    | `#c4c2b8` |
| `--ink-3`    | `#8a887e` |
| `--muted`    | `#5e5c52` |
| `--accent`   | `#c8f060` |
| `--accent-dim`| `#6a802e` |
| `--green`    | `#6cd86c` |
| `--green-bg` | `#1a2a1a` |
| `--amber`    | `#e8a838` |
| `--amber-bg` | `#2a2010` |
| `--red`      | `#e85858` |
| `--red-bg`   | `#2a1414` |
| `--blue`     | `#78b4e8` |
| `--blue-bg`  | `#142028` |

Accent (#c8f060) is used SPARINGLY — only for interactive elements, CTAs, and emphasis.
Semantic colors always paired with their -bg variant as backgrounds.

## Typography
- `--display`: `"Barlow Condensed"` — headlines, section titles, UPPERCASE, tight tracking
- `--sans`: `"IBM Plex Sans"` — body copy, component text
- `--mono`: `"IBM Plex Mono"` — labels, meta, data; always prefixed `// ` in UI copy

Loaded via `next/font/google` in `app/layout.tsx`; exposed as CSS vars.

## Density
- Spacing base: 4px unit (4/8/12/16/20/24/28/32/40/48/56/64)
- Container padding: 48px desktop, 24px tablet, 16px mobile
- Card padding: 24px 28px
- Default gap in stacks: 16px
- Section margin between major sections: 64px

## Component approach
Tailwind + custom primitives in `src/components/ui/primitives.tsx`.
No external component library (shadcn not used).
All borderRadius: 0 everywhere — no exceptions.

## Key decisions log
- 2026-06-17 — Replaced HSL-based CSS vars with hex CSS vars (KodoAI palette). Maintained all
  existing Tailwind color names (bg, surface, border, fg, muted, primary, etc.) as aliases to the
  new vars so no existing component imports break.
- 2026-06-17 — Added new tokens: ink, ink-2, ink-3, accent, accent-dim, surface-2, surface-3,
  border-2, amber, blue, and all -bg semantic variants.
- 2026-06-17 — `src/lib/render/**` intentionally NOT touched (Satori ad rendering engine).
- 2026-06-17 — App shell uses route-group `(app)` layout for sidebar + topbar; auth/public pages
  outside the group.
- 2026-06-17 — Motion: only on high-impact moments. Sidebar mobile overlay uses CSS transition.
  No gratuitous animations in data-heavy views.
