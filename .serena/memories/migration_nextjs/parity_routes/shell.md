# Parity gap map — Application shell & workspace layer

Owner: Shell/Workspace Code Analyst (Phase A, read-only). Evidence: code only (no browser).
Scope convention: Angular `frontend/` is source of truth. Each row cites Angular file + behavior, Next file + behavior, delta, mismatch class, severity, minimal fix.

## Verified Angular source of truth

- `frontend/src/app/app.component.html` — shell: optional `<mat-progress-bar>` fixed top driven by `loadingService.isLoading$`; `<app-notification-container>`; `<app-header *ngIf="showHeader">` (hidden on `/login*`, reset-password, support-ticket); `<router-outlet>` with `routeAnimations` (opacity fade 200/300ms); mobile-only goo gradient background (`.gradient-bg.md:hidden`).
- `frontend/src/app/app.component.ts` — `showHeader` toggled on `NavigationEnd` for login routes only.
- `frontend/src/app/header/header.component.html` + `.ts` + `.scss` — this is the **navigation pill**, NOT a top toolbar. Vertical floating glass pill, fixed left `5vw` / `top:10vh` (xxl: `3vw`/`11vh`), 72px wide, rounded-[48px], backdrop-blur, max-height animates 72px→50rem on `:hover` or `.fixed-menu`. Items: profile avatar (top, click toggles `menuFixed` persisted to `localStorage.menuFixed`), Images `/`, Video `/video`, Audio `/audio`, **Tools group** (hover flyout @ `left:70px`, 200ms close grace period via `onToolsLeave` timeout) containing Virtual Try-On `/vto`, Fun Templates `/fun-templates`, Workflows `/workflows` (*gated* by `isUserAdmin()||isUserWorkflows()`), Imagen Upscale `/imagen-upscale`; then Media Gallery `/gallery`, Workbench `/workbench`, Admin `/admin` (*gated* by `isUserAdmin()`), Logout. Active state = blurred gradient pill behind icon (`from-blue-500 via-violet-500 to-red-400`). Tooltips via `matTooltip` positioned `right` for every item; profile uses `multiline-tooltip` class and dynamic text. `fadeSlideInOut` animation.
- `frontend/src/app/header/header.component.scss` — mobile (<768px): pill becomes horizontal bar fixed `bottom:2.5vh; left:2.5vw; width:95vw`, `flex-direction:row`, hidden scrollbars; workspace switcher repositioned fixed `bottom:10vh; left:20vw; width:80vw`. ≥768px: switcher `top:3vh; left:5vw`. ≥1400px: `left:3vw`.
- `frontend/src/app/common/components/workspace-switcher/workspace-switcher.component.html` + `.ts` — floating glass pill (top-left), `[matMenuTriggerFor]` opens `mat-menu` (xPosition "after"). Trigger shows `public`/`lock` icon + workspace name + `unfold_more`; tooltip `"You are on a {scope} workspace. Click to switch workspaces!"`. Menu items in order: list of workspaces (each: check icon when active + scope icon + name), `<mat-divider>`, **Create New Private Workspace** (`add`), **Invite Users** (`person_add`, `disabled=!canInvite`, tooltip "You can invite users in your Private Workspaces!"), **Brand Guidelines** (`style`, `disabled=!canAccessBrandGuidelines || job===PROCESSING`, inline `mat-progress-spinner` diameter 20 while processing), `<mat-divider>`, **Feedback** (`feedback`, opens Google Form in new tab). State: `WorkspaceScope.PUBLIC|PRIVATE`; precedence URL `?workspaceId` > `localStorage.activeWorkspaceId` > first PUBLIC workspace > first workspace; persisted to localStorage; `brandGuidelineService.activeBrandGuidelineJob$` drives spinner; snackbars via `handleSuccess/handleError`.
- `frontend/src/app/common/components/notification-container/*` — fixed `top:20px; right:20px; z-index:99999`; max-width 400px; min-width 300px; slide-in/out via `listAnimation` (`translateX(100%)`↔0, 300ms); two-tone `green-toast`/`red-toast`; manual close (cancel-toast.svg). Used by `NotificationService` (`success|error|info`, optional duration).
- `frontend/src/app/footer/footer.component.html` + `.ts` — `mat-toolbar` fixed bottom: "Powered by Vertex AI" (gradient text), Privacy policy (external `policies.google.com`), Terms and services (`/terms-of-service`).
- `frontend/src/styles.scss` — dark Material theme (`theme-type:dark`, azure palette); body `Google Sans`; **no** `MAT_TOOLTIP_DEFAULT_OPTIONS` provider ⇒ Material defaults (showDelay 0, hideDelay 0, touchendHideDelay 1500ms). Desktop html bg: `radial-gradient(ellipse 100% 100% at 50% 0%, #4D4D4D 0%, #161616 100%)`. Mobile: animated goo gradient. Custom scrollbar styling. Workspace switcher global overrides (`.workspace-container` 8/16 padding, radius 24, hover gradient pseudo-element `::before` from blue→violet→red).
- `frontend/src/app/app.module.ts` — confirms no global tooltip default options; uses MatMenu/MatDialog/MatSnackBar/MatTooltip/MatProgressBar.
- `Workspace` model (`workspace.model.ts`): `{ id:number; name; ownerId:string; scope:WorkspaceScope; members:WorkspaceMember[]; memberIds:string[] }`. `WorkspaceStateService` is a `BehaviorSubject<number|null>` — synchronous active id propagation app-wide.

## Verified Next current state

- `frontend-next/app/layout.tsx` — root: SSR-prefetches workspaces, wraps in `<Providers>` (ToastProvider + WorkspaceProvider). `<html data-theme="light">` (light forced at root).
- `frontend-next/app/(studio)/layout.tsx` — studio shell: `<div data-theme="dark" bg-radial-mint-violet>`; `<Sidebar brand items userPicture userEmail>`; main column with `md:pl-[calc(5vw+5.5rem)] xl:pl-[calc(3vw+6rem)]`; `<Topbar>` (sticky) containing `<WorkspaceSwitcher/>` + `session.email` string; `<main>` with gutter padding. `STUDIO_NAV` order: Image, Video, VTO, Audio, Upscale, Gallery, Templates, Workbench, Workflows. Admin appended iff `session.roles.includes("admin")`.
- `frontend-next/app/(admin)/admin/layout.tsx` — **separate shell**: `md:grid-cols-[15rem_1fr]` traditional sidebar with plain text `<Link>`s (Dashboard, Users, Source Assets, Templates, Media Gallery, Tags, AI Providers, AI Models). Does NOT use `<Sidebar>`/`<Topbar>`/`<WorkspaceSwitcher>`.
- `frontend-next/src/components/ui/sidebar.tsx` — floating vertical pill (desktop) + hamburger drawer (mobile). Hand-rolls Tools submenu via `onMouseEnter/Leave` + `useState(toolsMenuHovered)`. Hand-rolls per-item tooltips inline (`absolute left-[76px] ... group-hover/item:scale-100`) instead of using `Tooltip`. `toolsHrefs=["/vto","/fun-templates","/workflows","/imagen-upscale"]` filtered from items preserving array order ⇒ submenu order **VTO, Upscale, Templates, Workflows**. Logout button inside the pill. Mobile drawer is a 264px left drawer triggered by `☰` FAB at `bottom-4 left-4`. No profile menu, no menu pinning.
- `frontend-next/src/components/ui/topbar.tsx` — sticky `header` (`sticky top-0 z-30`, height `--tri-nav-topbar-height:68px`, border-b, backdrop-blur). Pure layout wrapper.
- `frontend-next/src/features/workspaces/components/workspace-switcher.tsx` — **native `<select>`** (confirmed). On change: `setActiveWorkspace` + `router.replace` with `?workspaceId`. No scope icon, no tooltip, no menu, no Create/Invite/Brand/Feedback items. Has a "Select workspace" disabled placeholder option.
- `frontend-next/src/lib/workspace/api.ts` — `Workspace = { id:string; name:string }` only. **No scope, ownerId, members.**
- `frontend-next/src/lib/workspace/context.tsx` — `WorkspaceProvider` with refresh/create/invite; resolves active from URL > localStorage > first workspace (no PUBLIC preference). Persists to `localStorage[WORKSPACE_STORAGE_KEY]`.
- `frontend-next/src/components/ui/tooltip.tsx` — hover/focus tooltip; **top-positioned only** (`bottom-[calc(100%+space-2)]`); no delay prop (token `--tri-tooltip-delay:450ms` defined but **not wired**); no position variant; no multiline class.
- `frontend-next/src/components/ui/dialog.tsx` — `<dialog>` element, sizes sm/md/lg, title + children; no confirm variant, no panelClass, no `aria-describedby`, no maxWidth handling.
- `frontend-next/src/components/ui/toast-provider.tsx` + `toast.tsx` — top-right stack, auto-dismiss (`--tri-toast-duration:5s`), tones neutral/success/info/danger/warning, manual dismiss button. z-50. No bottom-center/snackbar variant.
- `frontend-next/src/components/ui/button.tsx` / `icon-button.tsx` — variants primary/secondary/ghost/danger/iconOnly; iconOnly is `size-[--tri-button-icon-size:44px]`. No tooltip integration.
- `frontend-next/src/components/ui/field.tsx` + `input.tsx` — form primitives (adequate).
- `frontend-next/app/globals.css` + `src/styles/tokens.css` — Tridorian tokens (mint/violet brand, light page `#F4F8F6`, dark page `#011A15`). Studio layout forces dark. `welcome-gradient-bg` goo animation ported but lives in pages, not the shell.
- Confirmed absent in Next (grep): confirm-dialog, brand-guideline, feedback, profile menu, footer, global progress-bar, Menu/Popover primitive.

## Gap rows (severity order)

### S1 — CRITICAL

**G1. Workspace switcher reduced to native `<select>`**
- Angular: `workspace-switcher.component.html` — `mat-menu` with workspaces list + Create Private Workspace + Invite Users (gated) + Brand Guidelines (gated, spinner) + Feedback, scope icons, tooltips, dividers.
- Next: `workspace-switcher.tsx` — bare `<select>`; only workspace list.
- Delta: missing menu items, missing affordances, missing actions entirely from the shell.
- Class: **missing** (behavior + feature). Severity: **S1** (blocks Wave 1 shared shell; affects every route).
- Fix: introduce a `Menu`/`Popover` primitive (see P1 below); rebuild `WorkspaceSwitcher` as trigger pill (glass, hover gradient, scope icon, name, `unfold_more`) + menu with all items; wire to `WorkspaceProvider` + new `BrandGuidelineProvider` + new confirm dialog; expose `canInvite`/`canAccessBrandGuidelines` from extended `Workspace` type.

**G2. `Workspace` type lacks scope/ownerId/members**
- Angular: `workspace.model.ts` `{scope, ownerId, members, memberIds}`.
- Next: `api.ts` `Workspace = {id, name}`.
- Delta: cannot render public/lock icon, cannot compute `canInvite` (owner/admin of private), cannot compute `canAccessBrandGuidelines`, cannot show member counts.
- Class: **state mismatch** (data model). Severity: **S1** (hard blocker for G1, G3).
- Fix: extend `Workspace` type and `listWorkspaces` mapping to include `scope: 'public'|'private'`, `ownerId`, `members`; thread through `WorkspaceProvider` value. Backend already returns these (Angular consumes them).

**G3. Invite / Brand Guidelines / Feedback not reachable from shell**
- Angular: all three live inside the workspace menu (`workspace-switcher.component.ts` `openInviteDialog`/`openBrandGuidelinesDialog`/`openFeedbackForm`).
- Next: `WorkspaceInviteDialog` + `WorkspaceCreateDialog` exist but are only mounted inside `WorkspaceList` (admin/workspace table), **not** in the shell. Brand Guidelines and Feedback are entirely absent.
- Delta: shell cannot trigger invite/create; brand guidelines feature missing; feedback link missing.
- Class: **missing**. Severity: **S1**.
- Fix: mount dialogs from within the rebuilt `WorkspaceSwitcher` menu; add Brand Guidelines dialog (port `brand-guideline-dialog.component` + `BrandGuidelineService` job-tracking); add Feedback menu item opening the same Google Form URL.

### S2 — HIGH

**G4. Workflows nav item not role-gated**
- Angular: `header.component.html:178` `*ngIf="authService.isUserAdmin() || authService.isUserWorkflows()"` on Workflows submenu item.
- Next: `studio/layout.tsx:33` Workflows always in `STUDIO_NAV`; sidebar always renders it.
- Delta: non-authorized users see Workflows nav in Next but not Angular.
- Class: **state mismatch**. Severity: **S2**.
- Fix: in `studio/layout.tsx`, filter `STUDIO_NAV` to drop `/workflows` unless `session.roles` includes `admin` or `workflows` (verify Next session exposes `workflows` role — see Open questions).

**G5. Tools submenu item order differs**
- Angular order: VTO, Fun Templates, Workflows (gated), Imagen Upscale.
- Next order (derived from `items` filter): VTO, Upscale, Templates, Workflows.
- Delta: misordered plus Workflows not gated (see G4).
- Class: **layout mismatch** (control hierarchy). Severity: **S2**.
- Fix: in `sidebar.tsx`, define `subItems` explicitly in Angular order rather than filtering `items`.

**G6. Profile/user menu missing; avatar non-interactive**
- Angular: avatar is the menu pin toggle (`toggleMenu()` → `menuFixed` in localStorage) with dynamic tooltip `getTooltipText()`.
- Next: avatar in `sidebar.tsx` is a static `div` with `title={userEmail}` only; no pin behavior, no profile menu, no settings entry.
- Delta: pin/hover toggle gone; no profile affordance; Next has a `/settings` route with no shell entry (verified: `(studio)/settings` exists).
- Class: **missing** + **behavior mismatch**. Severity: **S2**.
- Fix: add `menuFixed` state to `Sidebar` persisted to localStorage; clicking avatar toggles it; consider a small profile menu (Settings, Logout) — but minimum is restoring the pin toggle to match Angular desktop behavior.

**G7. No global loading indicator**
- Angular: `app.component.html:17-21` fixed-top `mat-progress-bar` indeterminate bound to `loadingService.isLoading$`.
- Next: no equivalent at the shell level (grep found none).
- Delta: long-running navigations/requests give no global feedback.
- Class: **missing**. Severity: **S2**.
- Fix: add a `LoadingBar` primitive (top fixed, indeterminate, token-driven) mounted in `providers.tsx` or `(studio)/layout.tsx`, driven by a `useLoading` store or router `usePathname` transitions (Next 15 `useTransition`/`nprogress`-style).

**G8. No footer**
- Angular: `footer.component.html` fixed-bottom toolbar: Powered by Vertex AI + Privacy policy + Terms and services.
- Next: absent (verified by grep).
- Delta: legal/branding footer missing.
- Class: **missing**. Severity: **S2** (legal/branding).
- Fix: add `<Footer>` to `(studio)/layout.tsx` (and admin) with the three items; Privacy → external URL, Terms → `/terms-of-service` (verify route exists in Next — see Open questions).

### S3 — MEDIUM

**G9. Tooltip primitive insufficient**
- Angular: Material tooltip, position `right` for nav items, `multiline-tooltip` class for profile; default delays (0/0/1500ms touch).
- Next: `tooltip.tsx` — top-only, no delay wiring (token `--tri-tooltip-delay:450ms` unused), no position variant, no multiline.
- Delta: sidebar hand-rolls tooltips inline (`sidebar.tsx` lines 218, 274, 289) instead of using primitive; primitive cannot match Angular right-positioned nav tooltips.
- Class: **behavior mismatch** + **layout mismatch**. Severity: **S3**.
- Fix: extend `Tooltip` API: `position?: 'top'|'right'|'bottom'|'left'`, `delay?: number` (default consume `--tri-tooltip-delay`), `multiline?: boolean`. Refactor sidebar inline tooltips to use it.

**G10. No Menu/Popover primitive; submenu hand-rolled**
- Angular: `mat-menu` for workspace switcher + `*ngIf` hover flyout for Tools.
- Next: no Menu/Popover in `components/ui`; `sidebar.tsx` hand-rolls flyout with `onMouseEnter/Leave` + invisible 20px bridge + 200ms close grace (this *does* mirror Angular's `onToolsLeave` 200ms timeout — good).
- Delta: pattern not reusable; workspace rebuild (G1) needs it.
- Class: **missing** (primitive). Severity: **S3** (blocks G1).
- Fix: add `Menu` (click trigger) and `Popover` (hover/trigger) primitives with `align`/`side` props, focus handling, close-on-outside-click, optional hover bridge + close grace. Reuse for workspace menu, future contextual menus.

**G11. Dialog primitive insufficient; no ConfirmDialog**
- Angular: `ConfirmationDialogComponent` (used for "Delete Brand Guideline?"), `BrandGuidelineDialogComponent` with `panelClass:'brand-guideline-dialog'`, `maxWidth:90vw`, width 800px; MatDialog opens by component with config.
- Next: `dialog.tsx` has title+children only; no confirm variant, no panelClass, no maxWidth, no `aria-describedby`.
- Delta: cannot build confirm flows or styled dialog variants.
- Class: **missing** (variant). Severity: **S3** (blocks G3 brand guideline delete).
- Fix: add `ConfirmDialog` primitive (`title`, `message`, `confirmLabel`, `cancelLabel`, `tone`); extend `Dialog` with `panelClass?`, `maxWidth?`, `description?` (rendered to `aria-describedby`).

**G12. Toast system: missing snackbar variant + tone semantics**
- Angular: dual system — `MatSnackBar` (auto-dismiss, green/red `panelClass`, bottom-center default) AND custom `notification-container` (top-right, manual close, slide animation, `--z-index-notification:99999`).
- Next: `toast-provider.tsx` — top-right only, auto-dismiss 5s, z-50, no bottom variant, no error/success color fill (border-only).
- Delta: no bottom-center snackbar; tone is border-color only vs Angular's filled green/red; z-index lower than Angular's 99999.
- Class: **behavior mismatch** + **layout mismatch** + **state mismatch** (z-index). Severity: **S3**.
- Fix: extend `ToastProvider` with `placement?: 'top-right'|'bottom-center'` per-toast; add filled background tones (success/danger) via tokens; raise toast z-index token to ≥99999 (or new `--tri-z-notification`).

**G13. Topbar is a redesign element not present in Angular**
- Angular: NO top toolbar. Workspace switcher floats standalone top-left; content begins at viewport top.
- Next: `(studio)/layout.tsx` mounts a sticky `<Topbar>` (68px) holding the switcher + email, pushing content down.
- Delta: extra chrome; layout/top-padding differs; email shown in shell (Angular shows it only in the avatar tooltip).
- Class: **layout mismatch**. Severity: **S3** (decision needed — see Blockers).
- Fix: **decision required** — either (a) drop the Topbar and float the WorkspaceSwitcher top-left to match Angular, or (b) keep Topbar but document as intentional deviation. Recommendation: (a) for parity.

### S4 — LOW

**G14. Mobile shell IA differs fundamentally**
- Angular mobile (<768px): horizontal scrollable pill fixed at bottom (`width:95vw`), workspace switcher floats above it (`bottom:10vh; width:80vw`), animated goo background visible.
- Next mobile: hamburger FAB bottom-left opens 264px left drawer; sticky Topbar at top with switcher inside.
- Delta: different mobile navigation pattern + different switcher placement + different background.
- Class: **responsive mismatch** + **layout mismatch**. Severity: **S4** (depends on G13 decision).
- Fix: align after G13 decision — if dropping Topbar, port Angular's bottom horizontal pill + floating switcher for `<768px`.

**G15. Admin route uses a different shell**
- Angular: `/admin` uses the SAME global header/pill nav; admin is just another route in the pill.
- Next: `(admin)/admin/layout.tsx` uses a 15rem traditional sidebar with plain links — does not use `<Sidebar>`/`<Topbar>`/`<WorkspaceSwitcher>`.
- Delta: admin loses workspace context and pill nav; visually inconsistent with rest of app.
- Class: **layout mismatch** + **state mismatch** (no workspace). Severity: **S4** (admin is Wave 3 but architecture decision needed now).
- Fix: route `/admin/*` under `(studio)` layout (or reuse `<Sidebar>`+`<Topbar>`+`<WorkspaceSwitcher>` with admin sub-nav rendered inside `<main>`).

**G16. Atmosphere/background differs**
- Angular desktop body: radial `#4D4D4D→#161616`; mobile: animated goo gradient (5 colored blobs + interactive cursor blob).
- Next studio: `data-theme="dark"` with mint+violet radial-gradient ambient glow; goo animation exists as `welcome-gradient-bg` class but not in the shell.
- Delta: different mood; cursor-interactive blob absent.
- Class: **layout mismatch** (visual). Severity: **S4**.
- Fix: port `.gradient-bg` + interactive bubble into `(studio)/layout.tsx` for mobile; align desktop radial stops. Defer if Tridorian tokens intentionally replace — record as intentional deviation.

**G17. Route transition animation**
- Angular: `routeAnimations` opacity fade 200ms out / 300ms in on `<router-outlet>`.
- Next: none at shell level.
- Delta: no route transition.
- Class: **behavior mismatch**. Severity: **S4**.
- Fix: add a `ViewTransitions`/framer-motion fade wrapper in `(studio)/layout.tsx` `<main>`. Low priority.

## Shared primitives in `frontend-next/src/components/ui/**` that are insufficient

| Primitive | File | Gap | Minimal API addition |
|---|---|---|---|
| **Menu** (new) | — | does not exist | `Menu({trigger, children, align?, side?, hoverBridge?, closeGraceMs?})` + `MenuItem({icon?, disabled?, onClick, children, tooltip?})` + `MenuDivider`. Drives G1. |
| **Popover** (new, optional) | — | does not exist (Tools flyout could use Menu with `hoverBridge`) | Optional; defer unless non-menu hover surfaces appear. |
| **ConfirmDialog** (new) | — | does not exist | `ConfirmDialog({open, title, message, confirmLabel?, cancelLabel?, tone?, onConfirm, onClose})`. Drives G3, G11. |
| **Tooltip** | `tooltip.tsx` | top-only, no delay, no multiline | add `position?: 'top'\|'right'\|'bottom'\|'left'` (default top), `delay?: number` (default reads `--tri-tooltip-delay`), `multiline?: boolean`. Drives G9. |
| **Dialog** | `dialog.tsx` | no panelClass/maxWidth/description | add `panelClass?: string`, `maxWidth?: string`, `description?: string` (→ `aria-describedby`). Drives G3, G11. |
| **ToastProvider/Toast** | `toast-provider.tsx`, `toast.tsx` | top-right only, border-only tone, z-50 | add per-toast `placement?: 'top-right'\|'bottom-center'`; filled-bg tones for success/danger/warning; raise z-index token. Drives G12. |
| **LoadingBar** (new) | — | does not exist | `LoadingBar()` mounted once at shell; consumes a `useLoading()` store. Drives G7. |
| **Sidebar** | `sidebar.tsx` | hand-rolled tooltips + submenu; no pin toggle; no role gating | consume `Tooltip`+`Menu`; add `menuFixed` state persisted to localStorage; accept role-gated items (or filter in layout). Drives G4, G5, G6, G9. |
| **Topbar** | `topbar.tsx` | exists but Angular has no topbar | pending G13 decision — likely remove from studio layout. |
| **Footer** (new) | — | does not exist | `Footer()` with Vertex AI / Privacy / Terms. Drives G8. |

`Button`, `IconButton`, `Field`, `Input`, `Card`, `Badge`, `Table`, `EmptyState` are adequate for shell parity (no API changes required for Wave 1).

## Blockers for feature-level parity work

1. **G13 Topbar decision** — feature agents need to know whether content sits under a 68px topbar or starts at viewport top. Decide before Wave 2.
2. **G1+G2+G10 workspace menu rebuild** — every generation/gallery/workbench feature reads `activeWorkspace` from `WorkspaceProvider`; until `Workspace` carries `scope`/`ownerId` and the shell exposes Invite/Brand Guidelines, feature pages cannot replicate Angular's workspace-aware affordances.
3. **G4 Workflows role gating** — needs confirmation that Next `session.roles` exposes the `workflows` role (not just `admin`). If not, server session serialization must be extended first (lead-only change).
4. **Tooltip primitive extension (G9)** — feature agents will need right-positioned tooltips on icon-only controls; without the API addition they will hand-roll inline (as `sidebar.tsx` already does), creating divergence.

## Open questions (not verified by this agent)

- Whether Next `session.roles` includes `workflows` (only `admin` referenced in `(studio)/layout.tsx`). Needs `src/lib/auth/server.ts` inspection (outside this agent's scope).
- Whether `/terms-of-service` route exists in Next (Angular footer links to it). Grep not run in `(public)` for this.
- Whether `(studio)/settings` is an intentional Next addition or parity target (Angular has no `/settings` in the pill nav).

## Confidence

- **High** on all Angular behaviors cited (read templates, SCSS, TS, app module, global styles).
- **High** on all Next current-state citations (read layouts, sidebar, topbar, switcher, primitives, tokens, globals).
- **Medium** on the recommended fix for G13 (drop Topbar) — that is a design call, not a code fact.
- No browser verification was performed (per constraints); all evidence is code-level.
