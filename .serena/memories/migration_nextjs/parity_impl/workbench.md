# Parity impl log: Workbench agent

Owner: Workbench agent. Written 2026-07-28. Angular (`frontend/src/app/workbench/`) = source of truth. Write set: `frontend-next/src/features/workbench/**` only.

## Task 3 — `/workbench` ✅ DONE (finished from partial handoff)

### Changed files
- `src/features/workbench/components/workbench.tsx` — REWROTE composition only (timeline/trim/preview/render logic untouched). New structure: BETA label (Tooltip, multiline) → top workspace grid (conditional side panel + preview/transport/filter column) → tool rail (`role="tablist"`) → `TimelineEditor` + errors + `RenderPanel`.
- `src/features/workbench/components/properties-panel.tsx` (NEW) — `PropertiesPanel`: Aspect Ratio buttons (16:9/9:16/1:1/4:3, `aria-pressed`) + 4 native `<details>` disclosure groups (Lighting/Colors/Effects/Detail) each with labeled native `<input type="range">` (min10/max100/step5, default 50, live `%` readout via one `Record<string,number>` state).

### Intentional decisions vs Angular
- Tool rail has 4 tools (gallery/audio/stories/edit) in Angular's order — per task spec. Angular's 5th `agent` (always disabled "coming soon") OMITTED; trivial to add later.
- `gallery` + `edit` are FUNCTIONAL (toggle side panel). Angular has audio/stories/edit/agent all disabled; I enabled `edit` so the required Properties panel is reachable. audio/stories kept disabled with "coming soon" Tooltip (parity).
- `activeTool` defaults to `null` (matches Angular's signal init) → side panel hidden until a tool is picked; top grid collapses to single column when null (no empty 20rem gutter).
- Disabled tools wrapped in `Tooltip` (parent `<span>` receives hover since the button itself suppresses mouse events when disabled) — same trick Angular uses (disabled button inside a `matTooltip` div).
- Properties sliders are state-backed with a live readout (Angular's `studio-slider`s are decorative: hardcoded 50, broken `valueText` literal bindings). Marked with a `ponytail:` comment naming the upgrade path (real color-grading pipeline).

### Gaps closed
Assets panel wired live (`onAddToTimeline={addClip}` from `useTimelineState` — type matches `(clip: Clip) => void`); Properties panel (aspect ratio + Lighting/Colors/Effects/Detail sliders); tool-selector state machine; BETA label + tooltip.

### Untouched (per hard rules)
`timeline.ts`, `trim.ts`, `time.ts`, `__tests__/*`, `use-timeline-state.ts`, `use-playback.ts`, `preview-canvas.tsx`, `timeline-editor.tsx`, `transport-controls.tsx`, `render-panel.tsx`, `filter-controls.tsx`, `clip-block.tsx`, `track.tsx`, `assets-panel.tsx`, `index.ts`. Timeline/trim tests remain green by construction.

### No new deps
Native `<input type="range">`, native `<details>`/`<summary>` (free `aria-expanded`), `<button>`, `role="tablist"`/`role="tab"` + `aria-selected`. Reused `Tooltip` from `@/src/components/ui`. No `next/image` (assets-panel already carries the eslint-disable on its `<img>`).

### Shared-primitive API gaps hit
None. `Tooltip` (content/position/delay/multiline) covered both BETA and "coming soon" needs. Did NOT edit `src/components/ui/`.

### Verification
- `diagnostics` on both files: 0 errors. Only Tailwind v4 shorthand warnings (`gap-[var(--tri-space-4)]` → `gap-(--tri-space-4)`); deliberately NOT converted — the in-scope reference `assets-panel.tsx` uses the same bracket syntax, so converting would diverge from established style.
- `"use client"` is a literal directive at top of both files (no `import "use client"`). Import alias `@/src/...` (no `@/lib/...`). Checked by eye.
- No shell available → `bun test` not run; existing timeline/trim/time tests untouched. No new non-trivial pure logic added (slider/ratio state is trivial), so no new test file per the "only test genuinely non-trivial pure logic" rule.

### Deferred / notes for lead
- Angular `agent` tool button not ported (task listed 4 tools). Add to `TOOLS` array when desired.
- Properties sliders are presentational only (no effect on render) — true to Angular. Wire to render pipeline when backend supports per-clip grading.
- `FilterControls` (brightness/contrast/saturation, a Next-specific extra not in Angular) left in place in the preview column — removing it is out of scope and would drop working behavior.