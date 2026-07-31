# Generation primitives — final prop surfaces (build in-progress)

Owner: Generation Primitives agent. Source of truth = Angular. Primitives live in `csp/frontend-next/src/components/studio/`. Import shared UI from `@/src/components/ui` (`Menu`, `MenuItem`, `Tooltip`, etc.). Styling uses `--tri-*` vars + Tailwind. All existing studio files kept compiling; new primitives land alongside `option-controls.tsx`/`prompt-input.tsx`/`result-panel.tsx` until feature agents adopt.

## 1. FlowPromptBox  — `flow-prompt-box.tsx` (DONE)
The central prompt card. `max-w-2xl rounded-3xl bg-neutral-900`. Mode selector (top-left, `<Menu side="top">`) + status chips (top-right) opening ONE shared settings popover (`absolute bottom-full right-0 w-[500px]`, grid of labelled dropdowns). Prompt textarea (h-24 text-xl), Ctrl/Cmd+Enter → onGenerate. Bottom row: `referenceSlots` passthrough (left) + Rewrite + Generate (gradient text + spark) (right). Duration/Resolution chips hidden unless their option arrays + callbacks are passed (capability gating).

Exported types:
- `FlowOption = { value: string; label: string; icon?: ReactNode; disabled?: boolean }`
- `FlowMode = { value: string; label: string }`

Props:
```
mode: string; modes: FlowMode[]; onModeChange(mode)
model: FlowOption | null; models: FlowOption[]; onModelChange(value)
aspectRatio: string; aspectRatioOptions: FlowOption[]; onAspectRatioChange(value)   // chip shows ratio token only (split(" ")[0])
outputs: number; maxOutputs: number; onOutputsChange(value)                          // chip "x{n}", dropdown x1..xmax
duration?: number; durations?: FlowOption[]; onDurationChange?(value:number)         // OMIT to hide chip (gating)
resolution?: string; resolutions?: FlowOption[]; onResolutionChange?(value)          // OMIT to hide chip (gating)
prompt: string; onPromptChange(value); promptPlaceholder?: string; promptDisabled?: boolean   // caller owns mode-aware placeholder/disabled
isLoading: boolean; onGenerate(); onRewrite?(); generateDisabled?: boolean
referenceSlots?: ReactNode   // render <ReferenceMediaStrip/> here
```
Notes: `SettingsDropdown` + `Chip` are internal (not exported). Mode menu uses shared `<Menu>` (chevron does not rotate — Menu is uncontrolled). Settings popover has its own click-outside + Escape dismiss.

## 2. GenerationOverlay — `generation-overlay.tsx` (DONE)
`fixed inset-0 z-[100] bg-black/70`. processing → spinner + title + message + "This may take a few moments. You can safely navigate away." failed → title + message + same copy + Close button (only when `onDismiss` provided). Returns null when status is null.
```
status: "processing" | "failed" | null; title?; message?; onDismiss?()
```

## 3. OptionToolbar — `option-toolbar.tsx` (DONE)
Horizontal row of `size-14` circular icon buttons, each with a Tooltip + caption below. `grid grid-cols-2 md:grid-cols-3 lg:flex`. Supersedes `option-controls.tsx` (kept for now; only `generation-form.tsx` imports it).
```
items: OptionToolbarItem[] where
  OptionToolbarItem = { id; icon:ReactNode; label; tooltip; kind:"menu"|"toggle";
    selected?; disabled?; options?:{value,label,selected?,disabled?}[]; onSelect?(value); onToggle?(); customMenu?:ReactNode }
```
Menus use shared `<Menu side="bottom">` (options → MenuItem, or `customMenu` escape hatch for the negative-phrases chip grid, which widens the panel to min-w-[20rem]). Toggles render a real `<button aria-pressed>`.

## 4. StudioHero — `studio-hero.tsx` (DONE)
Gradient (default) or full-bleed background-video banner. Title uses gradient text. `videoSrc` → centered autoplay muted loop `<video>` (Video feature). `backgroundVideoSrc` → full-bleed `<video>` + dark overlay (Audio feature). `icon` shown only when no `videoSrc`.
```
{ title; subtitle?; icon?:ReactNode; videoSrc?; backgroundVideoSrc? }
```

## 5. MediaLightbox — `media-lightbox.tsx` (DONE)
Unified result surface for ALL generation features (replaces ResultPanel + MediaPlayer + upscale comparison). Image/video/audio variants share a media stage + optional thumbnail strip (when `urls.length > 1`, internal `selectedIndex`) + action toolbar. `comparison` variant = before/after slider (AFTER image clipped via `clipInset(slider)`, range input drives handle, Before/After labels). Actions are OPT-IN callbacks; only wired actions render. Audio uses native `<audio controls>`; video uses native `<video controls muted>`. Real Lucide-style SVG icons (NO emoji). No PhotoSwipe dependency.
```
type MediaVariant = "image" | "video" | "audio" | "comparison"
MediaLightboxMedia = { url?; urls?:string[]; prompt?; mimeType?; posterUrl? }
MediaLightboxActions = { edit?; generateVideo?(pos:"start"|"end"); sendToVto?; editWithOmni?; extendWithAi?; concatenate?; delete?; seeMoreInfo?; share?; download?; assignTags? }
props: { variant; media: MediaLightboxMedia | null; beforeUrl?; afterUrl?; actions? }
exported pure fn: clipInset(percent:number):string  → "inset(0 0 0 N%)" clamped+rounded [0,100]
```
Action order (Angular-faithful): edit, generateVideo(start/end submenu, image only), sendToVto, share, download, seeMoreInfo, assignTags, delete, editWithOmni, extendWithAi, concatenate.

## 6. ReferenceMediaStrip — `reference-media-strip.tsx` (DONE)
Inline reference slots rendered bottom-left of FlowPromptBox via `referenceSlots`. `size-20` dashed slots with hover Edit overlay + clear `×`, drag-drop + click to open, keyboard (Enter/Space) accessible. `showDivider` inserts a compare_arrows between two image slots (Frames/Concatenate). `max` renders an `{filled}/{max}` badge (Ingredients). Slot kinds: image/video/audio (distinct empty-state icons).
```
ReferenceSlot = { id; kind:"image"|"video"|"audio"; previewUrl?; label? }
props: { slots: ReferenceSlot[]; max?:number; showDivider?:boolean; onOpen?(slot); onClear?(slot); onEdit?(slot) }
```

## Test
`__tests__/media-lightbox.test.ts` — covers `clipInset` (0/100/midpoint/clamp/round), `node:test` style matching `features/video-studio/__tests__/`. Run: `bun test` (or `node --test`).

## Deferred (other agents own)
- SettingsPopover as standalone export (internal to FlowPromptBox).
- RewriteButton/GenerateButton standalone exports (inlined in FlowPromptBox).
- StepperFlow (VTO-only; VTO agent owns).
- Negative-phrases chip-grid markup (passed to OptionToolbar via `customMenu` by feature agent).
- Audio custom player parity (native `<audio controls>` used as boring/accessible baseline; upgrade when a feature needs the custom seek UI).
- media-lightbox action styling: Angular shows video actions (editWithOmni/extend/concatenate) as labelled pills; here all actions are uniform circular icon buttons with tooltips.

## Needs from shared-UI owner
None blocking. Optional: a `Menu` controlled/open variant so FlowPromptBox mode chevron can reflect open state (currently cannot — Menu is uncontrolled).
