# Tridorian design mapping
Sources: specimen `frontend-next/tridorian-design-system.html`; canonical tokens `frontend-next/tridorian-agent-theme-v3.json`; rules `frontend-next/tridorian-agent-instructions.md`.
## Foundation
- Generate semantic variables from JSON for light/dark colors, typography, spacing, radii, borders, shadows, motion, layout, and component tokens. Tailwind aliases point to variables; component code never uses raw hex/palette values.
- Build primitives matching declared contracts: Button variants, IconButton, Card variants, Input/Field, Badge/status+text/icon, Table, Dialog, Toast, Tooltip, Sidebar, Topbar, EmptyState.
- Theme switch uses `data-theme`; initialize before paint to prevent flash. Load declared fonts via `next/font` where supported.
- Visual regression fixtures reproduce specimen shell, hero/bento, dashboard, palette/type, and components in both themes and mobile.
## Feature patterns
- App shell/admin: deep-forest sidebar + translucent topbar; mobile becomes topbar + drawer/bottom pattern from theme. Active workspace/navigation uses tonal selection, not green flood.
- Image/video/audio/VTO/upscale/workflows/workbench: `patterns.aiWorkspace`; focused editing canvas may use dark scheme. Prompt/action area gets single luminous-green primary action. AI model/beta/status uses violet. Error/destructive uses coral plus icon/text.
- Gallery/templates/source assets: wide 12-column responsive media grid; asymmetric featured spans only where content priority warrants. Media cards use interactive card token and minimal elevation; filters use surface/tonal groups rather than nested cards.
- Detail views: media-dominant split layout; metadata uses compact measure and JetBrains Mono only for IDs/model/technical fields. One primary remix/use action; secondary actions grouped.
- Dashboard: `patterns.dashboard`; bento metric hierarchy, tokenized data-viz palette, status labels/icons, date filters in header. One strong elevated surface maximum.
- Admin tables: theme table contract, sticky/clear headers where needed, 44px row actions, responsive card/list fallback without horizontal page scroll.
- Auth: `patterns.auth`; calm light default, focused branded panel, one Google sign-in primary action, direct error copy.
- Workbench: dark focused canvas, forest rails, violet AI tools, green reserved render/export primary action; timeline state never color-only.
- Workflow editor: dark or mixed AI workspace; steps use hierarchy/borders before shadows; linked/fixed/mixed modes have text/icon labels; dependency errors coral + message.
## Acceptance checklist
- Semantic tokens only; both themes pass contrast.
- 12-column desktop and one-column mobile; no horizontal page scroll.
- >=44px controls, complete keyboard path, visible focus ring.
- Status has label/icon; no color-only meaning.
- Motion 140–320ms, no decorative loops, reduced-motion honored.
- <=1 ambient gradient per section, <=1 strong elevation per viewport.
- Cards not generic wrappers; one dominant primary action per section; sentence-case copy.