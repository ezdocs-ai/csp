# Phase D — Interaction & A11y Review (read-only)

Reviewer: interaction/a11y reviewer. Date: 2026-07-29. Scope: 9 routes (`/`, `/video`, `/imagen-upscale`, `/vto`, `/audio`, `/gallery`, `/workbench`, `/admin`, `/admin/users`). Method: live `browser_*` on `localhost:3000` (Next, logged in as admin+workflows) + static source reads of `csp/frontend-next/src/components/studio/**`, `src/components/ui/{menu,dialog,toast,confirm-dialog,sidebar}.tsx`, and the touched feature files. Angular tab NOT touched (per rules). READ-ONLY — no files mutated. Build/lint were green before this review.

## Summary by severity
- Critical: 4
- High: 5
- Medium: 6
- Low: 3
Total: 18 findings.

## CRITICAL

### C1. Sidebar "Tools" flyout is unreachable by keyboard AND has no accessible name
- Route: every studio/admin route (sidebar is in both `(studio)/layout.tsx` and `(admin)/admin/layout.tsx`).
- File: `csp/frontend-next/src/components/ui/sidebar.tsx` L253-277 — `<Menu hover ...>` for the Tools group (VTO/Fun Templates/Workflows/Imagen Upscale).
- Problem 1: `hover` mode sets `onClick={undefined}` on the trigger button (`menu.tsx` L97), so clicking the Tools icon does nothing. Mouse hover opens the panel; keyboard focus on the trigger does NOT open it. Keyboard-only users have no way to reach `/vto`, `/fun-templates`, `/workflows`, `/imagen-upscale` from the sidebar.
- Problem 2: the `<Menu>` for Tools passes NO `label` prop, so the trigger button (`aria-label={label}` → `aria-label={null}`) is unnamed. Screen readers announce just "button, collapsed/expanded".
- Verified live: `document.querySelectorAll('button[aria-haspopup="menu"]')[1]` → `{label: null, expanded: 'true', hasOnclick: false}`.
- Note: the inner `MenuItem` hrefs are valid links, so the routes themselves are reachable by URL/typing — but the in-app affordance is keyboard-broken.
- Fix hint: add `open-on-focus` semantics (or convert to click + hover hybrid), and pass `label="Tools"` to the Menu.

### C2. `GenerationOverlay` uses `role="alertdialog"` without Escape, focus trap, or autofocus
- Routes: `/`, `/video`, `/imagen-upscale`, `/vto`, `/audio` (any state that shows the overlay).
- File: `csp/frontend-next/src/components/studio/generation-overlay.tsx` L28-50.
- Problems:
  - `role="alertdialog"` per WAI-ARIA APG MUST trap focus and support Escape to dismiss. This component does neither.
  - In the `failed` state, Escape does NOT close it (no keydown listener). Keyboard users must click the Close button — the only way to dismiss.
  - In the `processing` state there is no Close button and no Escape handler, but focus is not trapped, so Tab cycles to whatever is behind the `fixed inset-0 z-[100]` overlay. Modal-style dialog semantics broken.
  - The Close button is not autofocused; when the overlay appears focus stays on the previously-focused element behind the overlay.
- Fix hint: add a keydown `Escape` listener when `onDismiss` is defined, autofocus the Close button, add a focus trap (or downgrade `role` to `status`/`alert` if no dialog semantics are intended).

### C3. Workbench tool tabs have NO accessible name when inactive; disabled tabs are keyboard-unfocusable; tablist missing tabpanels
- Route: `/workbench`.
- File: `csp/frontend-next/src/features/workbench/components/workbench.tsx` L67-95.
- Problems:
  - L84: emoji glyph is `<span aria-hidden="true">{tool.glyph}</span>`. L85: `{selected && <span>{tool.label}</span>}` renders the label ONLY when the tab is active. Inactive tabs therefore have NO accessible name — a screen reader announces "tab" with no name. For disabled tabs (audio/stories) the label is permanently absent.
  - Disabled tabs (`disabled={Boolean(tool.hint)}`) are not keyboard-focusable, so the `Tooltip` wrapping them (with "Audio coming soon!" / "Stories coming soon!") is invisible to keyboard users.
  - `role="tablist"` + `role="tab"` (L67, L81) with `aria-selected` — but the conditional panel content (L53-58) is in an `<aside>` with NO `role="tabpanel"` / `aria-controls` / `aria-labelledby`. Tab-pattern contract is half-implemented.
  - No Left/Right arrow-key navigation between tabs (APG requirement for `role="tablist"`).
- Fix hint: always render `<span class="sr-only">{tool.label}</span>` (or `aria-label={tool.label}` on the button); move the hint out of the disabled tooltip into an `aria-describedby`; either drop `role="tablist"` for `role="toolbar"` or add tabpanels.

### C4. No "skip to main content" link anywhere in the shell
- Routes: all (shell-level).
- Verified live: `document.querySelector('a[href="#main"], a.skip-link')` → null on every route tested.
- The sidebar has 11+ links + workspace switcher; keyboard users must Tab through all of them on every page load to reach main content.
- Compounded by the layout's `<main>` (`app/(studio)/layout.tsx` L68, `app/(admin)/admin/layout.tsx` L69) having no `id` attribute, so even if a skip link were added it couldn't target it via `#main`.
- Fix: add `<a href="#main-content" class="sr-only focus:not-sr-only ...">Skip to content</a>` as the first body child, give the layout main `id="main-content"`.

## HIGH

### H1. Multiple `<main>` landmarks on most studio + gallery routes
- Routes affected: `/` (Image), `/imagen-upscale`, `/vto`, `/gallery` (and `/workflows`, `/workflows/[id]`, `/workflows/new`, workflow-editor — outside the 9-route scope but same bug).
- Verified live:
  - Image: `document.querySelectorAll('main').length === 2` (outer layout main + `features/image-studio/components/image-studio.tsx` L436).
  - Upscale: 2 mains (`features/upscale/components/upscale-studio.tsx` L107).
  - VTO: 2 mains (`features/vto-studio/components/vto-studio.tsx` L304).
  - Gallery: 2 mains while loading (`app/(studio)/gallery/loading.tsx`) AND after hydration (`features/gallery/components/gallery-view.tsx` L143).
  - `/video`, `/audio`, `/workbench`, `/admin`, `/admin/users`: correctly single-`<main>`.
- WCAG 1.3.1 / 2.4.1: a page should have exactly one `main` landmark. Screen-reader "jump to main" commands become ambiguous.
- Fix: change the feature-level wrappers from `<main>` to `<section>` (or `<div>`). Grep target: `csp/frontend-next/src/features/**` for `<main` — 6 hits (image-studio, upscale-studio, vto-studio, gallery-view, workflow-editor, workflow-detail, workflow-list, run-panel) + the gallery loading/error pages.

### H2. `Menu` (`role="menu"`) does not implement arrow-key navigation or move focus into the menu on open
- Routes: all (`Menu` is used by OptionToolbar, FlowPromptBox mode selector, sidebar, workspace switcher).
- File: `csp/frontend-next/src/components/ui/menu.tsx`.
- Verified live: opened the Style menu on Image via click, pressed `ArrowDown` — focus stayed on "Modern" (no movement). Pressed `Tab` — focus moved into the menu (Modern). Pressed `Escape` — menu closed (good). On open, `document.activeElement` was still the trigger button (Style), not the first menuitem.
- WAI-ARIA APG for `role="menu"` requires: focus moves to first item on open; ArrowDown/ArrowUp cycle; Home/End jump; Tab closes the menu. None of that is implemented. Tab happens to work because items are real `<button>`s.
- Also: `role="menu"` is the WRONG role for "pick a value" dropdowns (Style/Color/Model/Mode/etc.); APG says menu is for application-like commands, listbox is for value-selection. Screen readers may announce "menu" and apply wrong heuristics.
- Severity is High (not Critical) because Tab fallback works and items are individually focusable; but it's a pervasive pattern across the whole app.

### H3. Workbench tablist controls are not keyboard-operable per tab pattern
- Already covered in C3 — listed again here only because the missing arrow keys + missing tabpanel pairing are independently High even if the labels were fixed.

### H4. Gallery server fetch hangs / page stuck on `aria-busy` skeleton forever (functional, not pure a11y, but blocks any review of the gallery content)
- Route: `/gallery`.
- Verified live: navigated to `/gallery?workspaceId=1`, waited 2 s, the inner `<main aria-busy="true">` was still rendering 6 `animate-pulse` skeletons, `document.querySelectorAll('main')[1].getAttribute('aria-busy') === 'true'`. No client-side `/api/gallery/*` requests fired (server fetch path). Could not get the gallery to render any items, so could not review MediaCard selection / shift-range / bulk-actions live.
- Note: this may be a backend/data issue rather than a UI bug, but it makes gallery a11y non-reviewable live.
- Static review of `features/gallery/components/gallery-view.tsx`: `useEffect` Esc-clears selection (good); `aria-live` is NOT set on the bulk-actions bar when it appears; the gallery has the dual-`<main>` problem (H1).

### H5. `vto-studio` preset/garment cards use `aria-pressed` for single-select semantics
- Route: `/vto`.
- File: `csp/frontend-next/src/features/vto-studio/components/vto-studio.tsx` L141-153 (`PresetCard`).
- Problem: `aria-pressed={selected}` conveys "toggle button" semantics to AT. But choosing one model from a preset grid is a single-select gesture (radiogroup or listbox), not a toggle. Each card announces "pressed/not pressed" independently with no group semantics, so a screen-reader user can't tell that selecting one card deselects another.
- Fix: wrap each preset grid in `role="radiogroup"` (or `role="listbox"`) and use `role="radio"`/`role="option"` + `aria-checked` on cards. Same applies to upscale Factor buttons (`features/upscale/components/upscale-studio.tsx` L207) and the audio model segmented control (which DOES use a real fieldset+radios — better pattern).

## MEDIUM

### M1. `aria-label` on `<span>` spinners (no role) is ignored by AT
- Route: `/vto`.
- File: `csp/frontend-next/src/features/vto-studio/components/vto-studio.tsx` L357, L407, L466.
- `<span aria-label="Loading models" class="... animate-spin ...">` — `aria-label` on a `<span>` without an explicit role is not exposed to AT (per ARIA spec). Should be `role="status"` (with `aria-live="polite"`) or `<span class="sr-only" role="status">Loading models</span>` + a separate visual spinner. Three occurrences.
- Same anti-pattern likely affects `aria-label="Generating"` (L407) and `aria-label="Loading garments"` (L466).

### M2. Audio "Press Ctrl/Cmd + Enter to generate" hint is not associated with the textarea
- Route: `/audio` (and the same hint pattern is in FlowPromptBox but FlowPromptBox uses no visible hint text).
- File: `csp/frontend-studio/components/audio-studio.tsx` L146-148 — hint is a plain `<span>` sibling to the textarea inside the same `<label>`. Because it's inside `<label>`, the hint text is ALSO part of the textarea's accessible name (so SR announces "Prompt Press Ctrl/Cmd + Enter to generate"). Should be moved outside the `<label>` and wired via `aria-describedby`.
- Minor audible-noise issue, not blocking.

### M3. Admin Users table has no accessible name (no caption / aria-label)
- Route: `/admin/users`.
- File: `csp/frontend-next/src/features/admin/components/users-table.tsx` L68-84 — `<Table>` is rendered without `aria-label` or `<caption>`. The H1 "Users" precedes it but is not programmatically associated.
- Verified live: `document.querySelector('table').getAttribute('aria-label') === null`, no `<caption>`.
- Fix: `<Table aria-label="Users" aria-labelledby="users-h1">` or add `<caption class="sr-only">Users</caption>`.

### M4. Admin subnav links lack `aria-current="page"`
- Routes: `/admin`, `/admin/users`, `/admin/source-assets`, `/admin/templates`, `/admin/media-gallery`, `/admin/tags`, `/admin/ai-providers`, `/admin/ai-models`.
- File: `csp/frontend-next/app/(admin)/admin/layout.tsx` L74-82 — plain `<Link>` elements with no `aria-current`. Visual active state also missing.
- A user browsing via AT can't tell which admin section is currently shown.

### M5. Image preservation factor slider cannot return to "Auto" once moved
- Route: `/imagen-upscale`.
- File: `csp/frontend-next/src/features/upscale/components/upscale-studio.tsx` L244-263.
- Initial state `imagePreservationFactor === null` shows "Auto" (with `aria-valuetext="Auto"`). Moving the slider `setImagePreservationFactor(Number(value))` makes it a number; there is no affordance to clear back to null. UX gap, not strictly a11y — but worth noting because the visible "Auto" affordance is misleading.
- Fix: double-click or a small "Reset to Auto" button.

### M6. Workspace switcher menuitems wrap multi-action content (icon + check + name) inside one button — fine — but the "selected" check is conveyed only visually via `trailing={<IconCheck />}`, not via `aria-checked`
- Route: every route (workspace switcher).
- File: `csp/frontend-next/src/features/workspaces/components/workspace-switcher.tsx` L138-152 + `components/ui/menu.tsx` MenuItem — `MenuItem` accepts `selected` but renders it as a CSS class, NOT as `aria-current`/`aria-checked`. A screen-reader user can't tell which workspace is currently active.
- Fix: render `aria-current="true"` (or set `aria-checked` if switching to `role="menuitemradio"`) on the selected MenuItem.

## LOW

### L1. `Dialog` doesn't explicitly return focus to the trigger — but native `<dialog>` happens to do it
- Verified live: opened Workspace Create dialog (focus moved to first input via `showModal`), pressed Escape, focus returned to the Switch workspace trigger. So in practice this works because the browser remembers `previouslyFocused` before `showModal`. No bug observed, but the `Dialog` component itself does no focus-restore management — if a caller opens a dialog from a non-focusable element, focus would land on `<body>` after close. Note for future.

### L2. `OptionToolbar` toggle button's caption is wrapped in a `Tooltip` that duplicates the visible text
- File: `csp/frontend-next/src/components/studio/option-toolbar.tsx` L107-111 — `<Tooltip content={item.tooltip}>{caption}</Tooltip>` where `tooltip` is the long-hover description and `caption` is the visible short label. In several items `tooltip === label` (e.g. "Style"). Minor noise, not wrong.

### L3. `FlowPromptBox` chips use `aria-expanded={settingsOpen}` regardless of which chip was clicked
- File: `csp/frontend-next/src/components/studio/flow-prompt-box.tsx` L257-276 — every chip passes `ariaExpanded={settingsOpen}`. If the settings panel is open because the user clicked Aspect Ratio, the Model chip also reports `aria-expanded=true`, which is misleading (clicking Model would toggle to model field, not collapse the panel). Minor SR noise.

## Things deliberately NOT flagged
- Missing preset VTO assets / background video files / `upload-photo-*.png` — known deliberate gaps per task rules.
- The Tools flyout currently rendered as `expanded="true"` in the live snapshot — that's a Playwright/hover state artifact, not the real keyboard behaviour (mouse hover opened it and the snapshot caught it before mouseleave). The underlying bug (C1) is real regardless.
- Build/lint green status — confirmed in `wave3_status`.
- Ctrl/Cmd+Enter to generate — verified implemented in both FlowPromptBox (`flow-prompt-box.tsx` L135-140) and Audio studio (`audio-studio.tsx` L77-82). Matches Angular.
- Mode selector + chips + settings popover structure — Angular-faithful per `parity_routes/generation`.
- MediaLightbox action button order — matches Angular (`media-lightbox.tsx` L236-261).
- Upscale comparison slider has `aria-label="Before and after comparison slider"` and the Before/After visual labels — accessible.

## Top 3 to fix first
1. C1 + C4 — keyboard users literally cannot navigate the app (Tools flyout dead, no skip link).
2. C2 — alertdialog behaviour on every generation overlay.
3. C3 + H2 — pervasive menu/tab pattern bugs that affect every dropdown in the app.
