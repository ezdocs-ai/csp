# Shell parity — implementation log

Agent: Shared UI / Shell. Write set enforced.

## Task 1 — G1/G3 Rebuild WorkspaceSwitcher (DONE)
File: `csp/frontend-next/src/features/workspaces/components/workspace-switcher.tsx`
- Replaced native `<select>` with glass trigger pill (scope icon public/lock + name + unfold_more) wrapped in `<Menu>` + `<Tooltip>`.
- Tooltip: `You are on a {scope} workspace. Click to switch workspaces!` (position bottom).
- Menu order (Angular-exact): workspace list (check trailing icon when active + scope icon) → divider → Create New Private Workspace → Invite Users (disabled unless `canInvite`, native title tooltip) → Brand Guidelines (link `/settings/brand-guidelines`) → divider → Feedback (Google Form URL, new tab via `href`).
- `canInvite = scope === "private" && (ownerId === userId || isAdmin)`. Props added: `userId` (= `session.sub`), `isAdmin` (= `session.roles.includes("admin")`).
- Preserved `?workspaceId` router.replace sync effect + `selectWorkspace` verbatim.
- Mounted `WorkspaceCreateDialog` + `WorkspaceInviteDialog` from the menu (local state).
- Container floats: `fixed top-[3vh] left-[5vw] xl:left-[3vw]`; mobile `max-md:bottom-[10vh] max-md:left-[20vw] max-md:w-[80vw]`.
- Feedback URL: `https://docs.google.com/forms/d/e/1FAIpQLSceWvu7G354h-dTbOGvNGEraEjcUAgPE300WNY5qr-WJbh3Eg/viewform`.

NOTE: `WorkspaceSwitcher` now REQUIRES props `{ userId, isAdmin }`. Callers (`(studio)/layout.tsx`, `(admin)/admin/layout.tsx`) updated in tasks 2/7. The `Workspace` type already carried `scope`/`ownerId` (lead did G2). Did NOT touch `src/lib/workspace/api.ts`.

Diagnostics: 0 errors (only Tailwind "can be written as" noise).

## Task 2/3/8 — Studio layout rewrite (DONE)
File: `csp/frontend-next/app/(studio)/layout.tsx`
- G13: Removed `<Topbar>` import + usage. Content starts at viewport top (no 68px topbar). `topbar.tsx` LEFT ON DISK — still imported by `app/visual/page.tsx` and `src/components/ui/_smoke.tsx`, so could not delete it.
- G13: Dropped the `session.email` string from the shell (Angular shows email only in avatar tooltip).
- G3/G4: Workflows role-gated — dropped from nav unless `session.roles` includes `admin` OR `workflows`.
- G1: Mounted `<WorkspaceSwitcher isAdmin userId={session.sub} />` (now floats standalone).
- G8: Added `<Footer />` at bottom of the content column.
- G7: Added `<LoadingBar />` at top of shell.
- Reordered STUDIO_NAV + relabeled to Angular exact labels (Images/Video/Audio/Media Gallery/Workbench/Admin; tools: Virtual Try-On/Fun Templates/Imagen Upscale/Workflows).

## New primitives (DONE)
- `src/components/ui/footer.tsx`: "Powered by Vertex AI" (gradient), Privacy policy → `https://policies.google.com/privacy?hl=en-US` (new tab), Terms → `/terms-of-service`. NOTE: `/terms-of-service` route does NOT exist in Next — reported as missing route.
- `src/components/ui/loading-bar.tsx`: fixed-top indeterminate bar, pathname-driven, self-contained keyframe (no globals.css edit), no new deps.
- `src/components/ui/index.ts`: appended `export * from "./footer"` and `export * from "./loading-bar"`.

## Task 4 — G5/G6/G9/G14/G10 Sidebar rewrite (DONE)
File: `csp/frontend-next/src/components/ui/sidebar.tsx`
- G5: Tools submenu defined explicitly in Angular order via `TOOLS_ORDER = ["/vto","/fun-templates","/workflows","/imagen-upscale"]` (no longer filter-derived). Workflows only present when layout passes it (role-gated upstream).
- G6: Avatar is now a real `<button>` toggling `menuFixed`, persisted to `localStorage.menuFixed`. When true, pill stays at `max-h-[850px]`. Dynamic multiline tooltip via `<Tooltip multiline position="right">`: `Hey there {firstName}! Click to make the menu dynamic` / `Click to make the menu fixed`. Used `useSyncExternalStore` (stdlib) for the localStorage flag to avoid React-19 effect-setState error + hydration mismatch (server snapshot = false).
- G9: All three hand-rolled inline tooltip `<div>`s replaced with `<Tooltip position="right">` (nav items, tools n/a, logout).
- G10: Hand-rolled hover flyout replaced with `<Menu hover closeGraceMs={200} side="right">` (panelClassName restores Angular glass gradient).
- G14: Mobile hamburger-FAB + left drawer REMOVED. Replaced with horizontal scrollable bar fixed `bottom-[2.5vh] left-[2.5vw] w-[95vw]`, `flex-direction:row`, hidden scrollbars (`scrollbarWidth:none` + webkit `tri-nav-scroll` class via inline `<style>`).
- CSRF logout flow preserved verbatim. Added `userName` prop (passed from layout = `session.name`).
Diagnostics: 0 errors.

## Task 7 — G15 Admin shell (DONE)
File: `csp/frontend-next/app/(admin)/admin/layout.tsx`
- Replaced the 15rem traditional sidebar with the SAME shell as studio: `<LoadingBar/>`, floating `<WorkspaceSwitcher isAdmin userId={session.sub}/>`, `<Sidebar>` (workflows always on since admin), `<Footer/>`. Admin sub-nav (Dashboard/Users/Source Assets/Templates/Media Gallery/Tags/AI Providers/AI Models) rendered inside `<main>` as a horizontal wrap `<nav>`.

## Cleanup (DONE)
File: `csp/frontend-next/src/features/workspaces/components/workspace-list.tsx`
- Removed redundant `<WorkspaceSwitcher/>` embed (now floats globally in shell; its required props broke this propless call). Kept Create button + table + dialogs.

## Final state (STOPPED per user)
- ALL 8 touched files: 0 diagnostics errors (only Tailwind "can be written as" warnings = documented noise).
- Gaps closed: G1, G3, G4, G5, G6, G7, G8, G9, G10, G13, G14, G15.
- Gaps deferred (per task spec): G16 (atmosphere/goo bg), G17 (route transition animation).
- Brand Guidelines menu item links to `/settings/brand-guidelines` (page owned by another agent) — not edited.
- `/terms-of-service` route does NOT exist in Next (footer links to it; reports 404 until a route owner adds it).
