# Phase E — WS-D workbench timeline parity fix

Date: 2026-07-29. Scope: `csp/frontend-next/src/features/workbench/**` only. Closes audit gaps H11 + H12 from `mem:migration_nextjs/phase_e/workflow_workbench_audit`. No shared UI / routes / admin / workflow files touched. Timeline math, playback (`usePlayback`), and render contract (`toRenderRequest`) APIs preserved — pure additions only.

## Verification
- `cd frontend-next && bun test src/features/workbench` → **13 pass / 0 fail** (4 new pure-transform tests). Full `bun test src` → **140 pass / 0 fail**.
- `bunx tsc --noEmit`: zero errors in any workbench file (project-wide `bun:test` runner-type warnings + unrelated pre-existing workflow/auth/gallery errors unchanged).
- Diagnostics tool: only Tailwind `var(--…)` shorthand style suggestions — matched existing codebase convention, intentionally left as-is.

## Changes by file

### Pure transforms (new, fully unit-tested)
- `timeline.ts`:
  - `trackKey(type, trackIndex)` → `"${type}:${trackIndex}"` stable identity (video 0 ≠ audio 0).
  - `toggleTrack(set, key)` → immutable Set toggle (add/remove), returns new Set, leaves input untouched.
  - `visibleClips(clips, hidden)` → drops clips whose `trackKey` ∈ hidden set. Used by preview path.
- `trim.ts`:
  - `canSplitAt(clips, clipId, atTime)` → ports Angular `canSplit()`. Strict inside check with 0.1s epsilon on each edge to prevent zero-length splits. Returns false for unknown id / empty list.

### Type widening (backward-compatible)
- `types.ts`: `Clip` gains optional `thumbnail?: string` and `waveform?: number[]`. NOT fabricated by workbench — only rendered when upstream `WorkbenchAsset` provides them.

### Component wiring
- `components/clip-block.tsx`:
  - New `locked?: boolean` prop. Locked → `cursor-not-allowed`, dimmed, `aria-disabled`, `tabIndex={-1}`, pointer handlers early-return, trim handles hidden.
  - Video thumbnail strip (5 repeats, matching Angular) renders only when `clip.thumbnail` present.
  - Audio waveform bars render only when `clip.waveform?.length > 0`. Heights from data, never random/fabricated.
  - Existing selection ring + trim handles + drag preserved when unlocked.
- `components/track.tsx`:
  - Track header gains eye (◉/⦻) + lock (🔓/🔒) toggle buttons. `aria-pressed`, `aria-label`, `title` all wired.
  - Hidden track → clips row dimmed (`opacity-40`). Locked state passed down to each `ClipBlock`.
  - New props: `hidden`, `locked`, `onToggleHidden`, `onToggleLocked`.
- `components/timeline-editor.tsx`:
  - **Zoom slider**: `pixelsPerSecond` lifted from hardcoded `72` to local state. Range 10–100 step 5 (verbatim Angular `studio-slider` config). Default 72 (no first-paint layout shift).
  - **Split button** (✂): disabled unless `canSplitAt(clips, selectedId, currentTime)`. Calls `onSplit(selectedId, currentTime)`.
  - **Delete button** (⌫): disabled unless `selectedId`. Calls `onDelete(selectedId)` then clears selection.
  - Toolbar lives above the scrollable ruler/track area. `selectedId` stays local.
  - Forwards `hiddenTracks`/`lockedTracks`/toggles per track key to each `Track`.
- `components/workbench.tsx`:
  - New top-level state `hiddenTracks` + `lockedTracks` (`ReadonlySet<string>`). Toggles via `toggleTrack`.
  - `previewClips = visibleClips(timeline.clips, hiddenTracks)` feeds `PreviewCanvas` — hidden video track drops out of preview playback (the only playback surface; audio has no playback path today).
  - Wires `onSplit` → `useTimelineState.splitClip`, `onDelete` → `useTimelineState.removeClip` (both already exposed, untouched).
- `components/preview-canvas.tsx`: dropped `filters` prop + CSS `filter` style. Reduced to `{ clips, currentTime }`.
- `components/assets-panel.tsx`: `addToTimeline` propagates `asset.thumbnail` onto the new `Clip` (was discarded). Waveform has no upstream source today, so it's not synthesized here.

### Removed
- `components/filter-controls.tsx`: deleted. Angular workbench has no preview-side brightness/contrast/saturation controls (audit H12). Decision rationale: Angular parity = remove; lazy-senior principle favors deletion over documenting a non-parity extra; `RenderPanel` already doesn't consume filters and PropertiesPanel sliders stay decorative (audit H13 parity-OK, untouched).

## Tests added (pure transforms only — React component behavior not unit-tested, matching existing workbench test scope)
- `__tests__/trim.test.ts`: `canSplitAt` — covers start/end edges, 0.1s epsilon boundary, mid-clip true, unknown id, empty list.
- `__tests__/timeline.test.ts`: `trackKey` type/index distinction; `toggleTrack` add/remove/immutability; `visibleClips` filtering by hidden key.

## What was intentionally NOT done
- No render-path change: hidden tracks still render to backend (audit L7 says render is functional; task scope said preserve render API). Hidden affects preview only.
- No media analysis: no thumbnail generation, no waveform computation. Presentation only.
- Per-track eye/lock in Angular are decorative placeholders (`matTooltip="coming soon!"`, `[disabled]="true"`). Per task wording ("actually affect editing/playback"), Next makes them functional — divergence is intentional and documented here.
- No FilterControls replacement: PropertiesPanel (audit H13, parity-OK) remains the only color-adjustment surface.
- TS diagnostics warnings on Tailwind `var(--…)` shorthand are project-wide style; left untouched to match existing convention.
