# UI/UX parity recovery plan

## Decision
Angular `frontend` is the source of truth for visible layout, interaction behavior, control hierarchy, responsive behavior, and user journeys. `frontend-next` currently implements a redesign rather than a migration. Freeze further page polishing and recover parity systematically. Tridorian tokens may implement Angular-equivalent visuals internally, but must not alter UX before parity sign-off.

## Preserve vs replace
Preserve validated Next auth/session, API clients/routes, polling, state logic, backend integration, and low-level tokens. Replace page composition and misleading generic form/sidebar patterns where they conflict with Angular. Do not rewrite working feature logic merely for visual parity.

## Discovery protocol (Playwright)
Use existing authenticated tabs. Angular auth is not reload-safe: navigate using visible Angular controls/router links, never `page.goto` after login. For every route, compare at identical viewport and workspace/data state:
1. Default desktop screenshot.
2. Hover every icon-only/action control; record tooltip text and delay.
3. Open every workspace/profile/navigation menu, dropdown, settings popover, dialog, and contextual menu.
4. Exercise toggles, tabs, filters, paging, selectors, and validation.
5. Capture empty/loading/error/success/populated states when safely reproducible.
6. Repeat critical path at mobile width, including sidebar/menu toggles and overflow.
7. Inspect Angular template/SCSS/component/service and corresponding Next route/component/hook code.
8. Record exact mismatch: missing, behavior mismatch, layout mismatch, state mismatch, responsive mismatch, or route/access mismatch.

A static URL screenshot is insufficient. A page is explored only when its interactive states and relevant code are checked.

## Discovery output
Maintain a parity matrix per route with: Angular route, Next route, screenshots, Angular behavior, Next behavior, missing/different behavior, Angular files, Next files, shared prerequisite, severity, owner, status. Store durable findings in Serena; screenshots stay Playwright artifacts. Do not claim full comparison while auth redirects or data-state differences invalidate a pair.

## Implementation order
### Wave 0 — evidence only
Inventory and compare every page and interaction. No feature UI edits except blockers preventing observation. Fix authentication/admin access and runtime crashes first.

### Wave 1 — shared shell and interaction primitives
Match app dimensions, header, workspace selector/menu, profile menu, navigation/sidebar and toggle behavior, tooltips, dropdowns/popovers/dialogs, toggles, focus/hover states, notifications, loading states, and responsive shell. Workspace menu must include active workspace, create private workspace, invite users, brand guidelines, and feedback where Angular does.

### Wave 2 — generation workspace primitives
Build Angular-faithful hero/canvas, option toolbar, prompt composer, settings popover, model/aspect/output controls, reference media strip, result/loading overlay, and action controls. Do not expose all settings as a generic permanent form when Angular uses contextual controls.

### Wave 3 — feature families
1. Image + Video as reference implementations.
2. Audio + VTO + Upscale using corrected generation primitives.
3. Gallery + templates + media detail: filters, cards, selection, bulk actions, overlays/lightbox.
4. Workbench + workflows: all editor/player/history states.
5. Admin after role/session access: shell, dashboard, tables, dialogs, filters, mutations.

## Acceptance per route
- Same overall composition, hierarchy, dimensions, control order/grouping, labels/icons, defaults, and meaningful visual emphasis.
- Equivalent hover tooltips, keyboard focus, menus, popovers, dialogs, toggles, and navigation state carry.
- Equivalent empty/loading/error/success/populated states.
- Desktop and mobile behavior match without horizontal overflow; accessible controls remain >=44px where applicable.
- API behavior remains functional and backend authorization remains authoritative.
- Paired Playwright screenshots at equal viewport/data state reviewed; intentional differences explicitly recorded.
- Focused tests, typecheck/lint/build pass. Do not accept a page merely because fields/endpoints exist.

## Immediate priorities
1. Ensure local user has `user,admin`; re-login both apps because Angular localStorage and Next signed cookie cache roles.
2. Complete evidence matrix without direct Angular reloads.
3. Fix shared shell/workspace/tooltips before page-specific CSS.
4. Rebuild Image and Video presentation while retaining valid API/state logic.

## Known evidence
Home and Video are materially different: Next added generic page headings/forms/sidebar, changed canvas and prompt hierarchy, omitted Angular contextual toolbars/reference composer, lacks equivalent hover tooltips, and reduced workspace menu to a select. This is a parity rebuild, not minor CSS polishing.