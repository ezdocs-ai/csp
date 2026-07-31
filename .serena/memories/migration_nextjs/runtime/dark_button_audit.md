# Dark-mode button contrast audit (READ-ONLY)

Scope: shared `frontend-next/src/components/ui` Button/Menu/Dialog/Sidebar/Toast + representative pages vs Angular source. No edits made.

## Theme facts
- Dark mode is the PRIMARY app mode: `app/(studio)/layout.tsx` and `app/(admin)/admin/layout.tsx` hardcode `data-theme="dark"`; only marketing root is light.
- Theming = CSS-variable rebinding in `src/styles/tokens.css` under `[data-theme="dark"]`. No `dark:` Tailwind utilities used anywhere.
- Tailwind v4 supports data-attr dark via `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *))` (confirmed via Context7 /tailwindlabs/tailwindcss.com) — NOT needed for the fix; token layer suffices.

## ROOT CAUSE (the real dark-mode button defect)
`tokens.css` `[data-theme="dark"]` block restates brand/bg/text/border/state tokens but NOT the `--tri-button-*` component tokens. Most are safe (transitive refs flip), EXCEPT one literal:
- L138 (light): `--tri-button-danger-fg: #FFFFFF;`  ← literal, never overridden.

Effect in dark mode:
- Danger Button bg = `--tri-button-danger-bg` → `--tri-state-error` dark = `#FF7B70` (coral).
- Danger Button fg = `#FFFFFF` (literal, stays white).
- Contrast = ~2.52:1. WCAG AA needs 4.5 (14px semibold = normal text). FAIL.

Hit on dark routes:
- `src/features/gallery/components/selection-bar.tsx` → `<Button variant="danger">Delete</Button>` (Studio/gallery dark).
- `src/components/ui/confirm-dialog.tsx` `tone="danger"` (used app-wide on dark routes).
- `src/components/ui/_smoke.tsx` fixture.

This is the only shared component producing near-white text on a light-ish surface in dark mode. No literal `text-white`-on-white exists in dark mode (verified via grep: all `text-white`/`bg-white` occurrences are on dark scrims/media overlays or paired with `text-neutral-900`).

## MINIMAL FIX (1 line, token layer, no component edits, no redesign)
Add to `[data-theme="dark"]` in `src/styles/tokens.css`:
```css
--tri-button-danger-fg: var(--tri-brand-on-primary); /* #02231C on coral #FF7B70 ≈ 6.6:1, passes AA */
```
Rationale: matches the dark-mode primary pattern (`--tri-button-primary-fg` already resolves to `--tri-brand-on-primary` = dark text on luminous bg). Consistent with Angular dark-only app where destructive `warn` buttons use white only because surfaces are dark; here the dark theme makes the danger surface bright, so fg must flip.

## SECONDARY shared defects (NOT dark-mode white-on-white; flag only)
1. `menu.tsx` panel `border-white/10` + MenuItem `hover:bg-white/10` / `selected bg-white/10`. Assumes dark panel. In LIGHT mode panel = `--tri-bg-surface-raised` = #FFFFFF → hover/selected invisible (white-on-white). Dark mode OK. Token fix: `border-[var(--tri-border-default)]`, `hover:bg-[var(--tri-bg-surface-alt)]`.
2. `sidebar.tsx` `navClass` hardcodes `bg-white/30`, `text-neutral-200`, `border-white/10` + inline dark gradient. Bypasses token system entirely; works only because sidebar is forced-dark chrome. Latent fragility, out of minimal scope.
3. `card.tsx` featured variant: `--tri-card-featured-fg: var(--tri-text-inverse)` not restated in dark → dark text (#08251E) on dark forest-gradient in dark mode. Latent (only used in `_smoke.tsx`).

## Check / test plan (no code edit by me)
- Existing: `tests/visual/design-system.spec.ts` already screenshots `/_visual?theme=dark` — catches pixel regressions only, NOT contrast.
- Recommended add (when implementing): axe-playwright `color-contrast` rule against `/_visual?theme=dark` and a dark studio route, scoped to `button`, `[role="menuitem"]`, `.toast`. Assert 0 violations.
- Quick manual verify: `cd frontend-next && bun run dev`, open `/_visual?theme=dark`, inspect Danger button computed `color`/`background-color`; confirm fg resolves to #02231C after fix.
- Re-run: `bun test src` + `bun playwright test`.

## Sources consulted
- `frontend-next/src/styles/tokens.css` (light L17-150, dark L152-170).
- `frontend-next/src/components/ui/{button,menu,dialog,topbar,icon-button,sidebar,tooltip,toast,confirm-dialog,badge,card}.tsx`.
- `frontend/src/styles.scss` (Angular dark-only: `.mat-mdc-button-base{color:white!important}`, dark bg gradient).
- `frontend/src/app/common/components/studio-button|studio-toolbar-button|confirmation-dialog/*.scss`.
- Context7 /tailwindlabs/tailwindcss.com → `@custom-variant dark` data-attr syntax.
