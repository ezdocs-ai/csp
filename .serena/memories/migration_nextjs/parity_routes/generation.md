# Generation surfaces — UI/UX parity findings (Wave 0 evidence, code-only)

Scope owner: Generation Code Analyst. Source of truth = Angular `frontend/`. Read-only analysis; no product code edited. Browser not used. Confidence per section noted. Files actually read are cited; anything not listed under "verified files" was not opened.

## Shared Angular primitive — `app-flow-prompt-box`
Verified files:
- `frontend/src/app/common/components/flow-prompt-box/flow-prompt-box.component.html` (full)
- used by `frontend/src/app/home/home.component.html` (image) and `frontend/src/app/video/video.component.html` (video)

Structure (single card, `max-w-2xl`, `rounded-3xl bg-neutral-900`):
1. Top row: left = Mode selector button (chevron, opens popover above card listing modes). right = status chips that open a single Settings popover: Model chip (icon + name), Aspect Ratio chip (value only), Outputs chip (`x{n}`), Duration chip (`{n}s`, video-only, capability-gated), Resolution chip (icon, capability-gated).
2. Prompt `textarea` (h-24, text-xl). Placeholder is mode-aware ("Generate an image with text..." vs "Generate a video with text..." vs "Prompt not needed for concatenation"). Disabled in Concatenate mode.
3. Bottom row: left = contextual reference-media slots (mode-gated): Frames/Concatenate/Extend → 1 or 2 image slots with `compare_arrows` between; Ingredients → N reference image thumbnails with `{n}/{max}` badge + video-ref + audio-ref slots (Gemini Omni only). Each slot has hover edit overlay (template `#editOverlay`) + clear `×`. Right = `Rewrite` (drive_file_rename_outline) + `Generate` (gemini-spark-icon, gradient text) buttons.
4. Settings popover (`absolute right-0 bottom-full`, w-[500px], grid): Model dropdown, Aspect Ratio dropdown (with icons), Outputs dropdown (1..maxOutputs), Duration dropdown (capability-gated), Resolution dropdown (capability-gated, disables unsupported).
5. Mode menu popover (`absolute left-0 bottom-full`, w-64).

Key behavior: model + aspect + outputs + duration + resolution are CONTEXTUAL (chips + popover), never a permanent form. Mode is contextual. Reference media is contextual to mode. This is the #1 thing Next got wrong.

## Shared Angular primitive — `app-media-lightbox`
Verified: `frontend/src/app/common/components/media-lightbox/media-lightbox.component.ts` (outline only).
- Inputs: mediaItem, initialIndex, showSeeMoreInfoButton, showShareButton, showDownloadButton, showDeleteButton.
- Outputs: editClicked, generateVideoClicked, sendToVtoClicked, editWithOmniClicked, extendWithAiClicked, concatenateClicked, deleteClicked, tagsChanged.
- Uses PhotoSwipe lightbox; handles image/video/audio; has share menu, audio player controls, assign-tags dialog.
- This is the unified result + action surface across ALL generation features. Next has no equivalent.

Other shared Angular helpers used by generation: `image-selector`, `image-cropper-dialog`, `gallery-card`, `gallery-item-overlay`, `studio-toolbar`/`studio-button`/`studio-dropdown` family, `notification-container`, `workspace-switcher`.

---

## IMAGE
### Angular behavior (verified: `home.component.html` full, `home.component.ts` outline + L98-290)
- Composition top→bottom: (a) Hero "Welcome to Creative Studio" with gooey gradient bg + gemini-spark icon (mobile variant uses `mobile-white-gemini-spark-icon`); shown when no results. (b) Loading overlay = fixed inset-0 z-100 black/70 + spinner + "Generating Images..." + "This may take a few moments. You can safely navigate away." (c) Result = `app-media-lightbox` (max-h-60vh) with edit/generateVideo/sendToVto/delete/seeMoreInfo. (d) Option toolbar = horizontal row of 16x16 mat-fab buttons each with matTooltip + label below, in this order: Style (mat-menu), Color & Tone (mat-menu), Lighting (mat-menu, svgIcon `lighting-icon`), Composition (mat-menu), Negative Phrases (mat-menu with chip-grid form inside), Watermark (Yes/No mat-menu), Google Search (mat-slide-toggle, ONLY when model is gemini-3-pro-image / 3.1-flash-image / 3.1-flash-lite-image), Brand Guidelines (toggle), Enhance Prompt (toggle). Responsive: `grid grid-cols-2 md:grid-cols-3 lg:flex`. (e) `app-flow-prompt-box` (modes: Text to Image, Ingredients to Image).
- State persistence: `saveState()`/`restoreState()` via `localStorage`-backed state service (prompt, negativePrompt, aspectRatio, model, lighting, watermark, googleSearch, resolution, style, colorAndTone, numberOfMedia, composition, useBrandGuidelines, enhancePrompt, mode).
- Defaults: model `gemini-3.1-flash-lite-image`, aspectRatio `1:1 Square`, numberOfMedia 4, watermark No.
- aspectRatioOptions: 13 entries (1:1, 16:9, 9:16, 3:4, 4:3, 2:3, 3:2, 4:5, 5:4, 21:9, 1:4, 4:1, 1:8, 8:1) each with viewValue label + crop icon.
- Cross-feature: result actions route to `/video` and `/vto` via router state (`remixState`).

### Next behavior (verified: `app/(studio)/page.tsx`, `features/image-studio/components/image-studio.tsx`, `components/studio/{generation-form,option-controls,prompt-input,result-panel,job-poller}.tsx`, `features/image-studio/{types.ts,hooks/use-image-state.ts}`)
- Layout: `<main max-w-4xl>` → header "Studio Workspace / Image Studio" (Angular has NO such header) → canvas (WelcomeCard gradient OR ResultPanel) → GenerationForm (OptionControls card + PromptInput).
- WelcomeCard: gradient bg + sparkle svg + "Welcome to Creative Studio". Closer than other features but adds a dark overlay and uses inline svg path instead of registered `white-gemini-spark-icon`; no mobile icon variant.
- ResultPanel: side-by-side card (image left, status + action buttons right) — NOT a lightbox. Action buttons use emoji (🔄 remix, ✏️ edit, 🎬 send video, 👕 send vto, 🗑️ delete). onSendToVideo/onSendToVto are declared in props but NOT wired in `image-studio.tsx` (bug/missing). No "See more info", no share, no tags.
- OptionControls: circular 14x14 buttons with dropdowns for Style, Color & Tone, Lighting, Composition, Resolution, Negative Prompt (plain text input, not chips), Watermark (toggle button). MISSING vs Angular: Google Search toggle (model-gated), Brand Guidelines toggle, Enhance Prompt toggle. Negative prompt is a single text input, not a chip list with count badge. Adds "Reset to Default" per dropdown (Angular uses menu-item-selected highlight only).
- PromptInput: good attempt at flow-prompt-box parity — settings popover with Model/Aspect/Outputs dropdowns, chips that open it. But: Mode selector is hardcoded "Text to Image" (no Ingredients mode, no mode menu). No reference-image slots at all. No keyboard shortcut (Angular: Ctrl+Enter generates). Rewrite calls `/api/gemini/rewrite` directly inside the component (Angular centralizes in service).
- Loading: no fixed overlay; ResultPanel shows inline "Generating your concept...".
- State: `useImageState` persists to localStorage key `imageStudioState` (parity ✓). Workspace sync via `useWorkspace`.

### Deltas
| Delta | Type | Severity |
|---|---|---|
| Header "Image Studio" + "Studio Workspace" eyebrow | layout mismatch | Medium (all Next features add this; Angular has none) |
| ResultPanel is side-by-side card not media-lightbox; emoji buttons; missing See more info / Share / Tags | layout mismatch + missing | High |
| onSendToVideo/onSendToVto not wired in ImageStudio | behavior mismatch | High |
| OptionControls missing Google Search, Brand Guidelines, Enhance Prompt toggles | missing | High |
| Negative prompt is text input not chip list with count | behavior mismatch | Medium |
| PromptInput Mode hardcoded "Text to Image"; no Ingredients mode; no mode menu | missing | High |
| No reference-image slots in prompt box (Ingredients mode absent) | missing | High |
| No Ctrl+Enter generate shortcut | behavior mismatch | Low |
| aspectRatioOptions come from backend `/api/images?options=1` (good) but PromptInput dropdown lacks the Angular viewValue labels ("Square"/"Horizontal"/etc.) and per-ratio icons beyond 3 hardcoded | behavior mismatch | Medium |
| Loading is inline not fixed overlay with "You can safely navigate away" | state mismatch | Medium |
| Rewrite logic lives in PromptInput not a service | behavior mismatch | Low |

### Logic to PRESERVE (Next)
- `features/image-studio/hooks/use-image-state.ts` — `useImageState` (localStorage persistence).
- `features/image-studio/types.ts` — `ImageOptions`, `ImageGenerationRequest`, `defaultImageState`, `ImageJob`.
- `components/studio/generation-form.tsx` — `/api/images?options=1` fetch + workspace sync pattern.
- `components/studio/job-poller.tsx` + `lib/hooks/use-media-job` — polling primitive (shared).
- `image-studio.tsx` `submit`/`getStatus` — `/api/images` POST with csrf + `/api/images/{id}` GET.

---

## VIDEO
### Angular behavior (verified: `video.component.html` full, `video.component.ts` grep of key symbols)
- Composition: (a) Loading hero with spinner. (b) Processing/Failed overlays (fixed inset, same pattern as image; failed has Close button calling `closeErrorOverlay()`). (c) Result = `app-media-lightbox` with extendWithAi/editWithOmni/concatenate/delete. (d) When no completed job: autoplay muted loop video (`assets/videos/generate-video-homepage-video.mp4`) + gradient text "Generate Video Ads". (e) Option toolbar (order): Style, Color & Tone, Lighting, Composition, Audio toggle (volume_up/volume_off, disabled when `isAudioGenerationDisabled`), Negative Phrases (chips), Brand Guidelines toggle, Enhance Prompt toggle. (Duration menu commented out — moved into flow-prompt-box settings.) (f) `app-flow-prompt-box` with video modes.
- Component state is signal-based: `videoModelsSignal`, `selectedModelKeySignal`, `selectedModelSignal` (computed), `availableAspectRatiosSignal`, `availableResolutionsSignal`, `availableDurationsSignal` — driven by `GenerationOptionsService` (capability registry). `isAudioGenerationDisabled` derived from capability.
- Flow-prompt-box video modes (from html): Text to Video, Frames to Video (2 slots + arrow), Ingredients to Video (ref images + video-ref + audio-ref for Gemini Omni), Concatenate Video (2 slots + arrow), Extend Video (1 slot).
- State persistence via `VideoStateService`.

### Next behavior (verified: `app/(studio)/video/page.tsx`, `features/video-studio/components/video-studio.tsx`, `features/video-studio/{types.ts,hooks/use-video-capabilities.ts,hooks/use-video-state.ts,hooks/use-video-submit.ts}`)
- Layout: two-column grid (`lg:grid-cols-[1fr_1fr]`). Left = form with `<h1>Video studio</h1>`, native `<select>` for Model and Mode, textarea Prompt, Input Negative prompt, conditional AssetField buttons (first/last/reference), 4-col grid of SelectField (Resolution/Aspect/Duration/Count), checkbox "Include audio", Generate Button. Right = Result heading + plain `<p>` status + `MediaPlayer`.
- This is the FLATTENED generic form the parity plan warns about. No welcome video, no option toolbar, no flow-prompt-box, no contextual reference slots inline with prompt, no overlays.

### Deltas
| Delta | Type | Severity |
|---|---|---|
| Entire layout is generic two-column form, not hero+toolbar+flow-prompt-box | layout mismatch | Critical |
| No welcome autoplay video + "Generate Video Ads" gradient | missing | High |
| No option toolbar (Style/Color/Lighting/Composition/Audio/Negative/Brand/Enhance) | missing | High |
| Model/Mode/Resolution/Aspect/Duration/Count are permanent native selects, not contextual chips+popover | behavior mismatch | Critical |
| Modes limited to text-to-video/first-frame/last-frame/reference; missing Concatenate, Extend, Ingredients-with-video/audio-ref | missing | High |
| Reference media via separate AssetPicker dialog, not inline slots in prompt box | behavior mismatch | High |
| No Processing/Failed fixed overlays | state mismatch | High |
| Result is plain MediaPlayer + status text, not media-lightbox with extend/edit/concatenate actions | missing + layout | High |

### Logic to PRESERVE (Next) — this is the strongest Next logic, do NOT rewrite
- `features/video-studio/hooks/use-video-capabilities.ts` — `useVideoCapabilities` fetches `/api/options/video-generation` capability registry; `pickModel`, `safeResolutions`, `safeDurations`, `safeAspectRatios`, `safeMaxOutputs`. This is MORE correct than Angular's hardcoded lists and must drive the new flow-prompt-box.
- `features/video-studio/types.ts` — `VideoCapabilities`, `VideoModelOption`, `ModelDefaults`, `VideoGenerationOptions`, `VideoMode`, `VideoGenerationRequest`, fallbacks.
- `features/video-studio/hooks/use-video-submit.ts` — `toBackendPayload` (maps UI state → CreateVeoDto wire shape with startImageAssetId/endImageAssetId/referenceImages), `csrfFetch`. Keep verbatim.
- `features/video-studio/hooks/use-video-state.ts` — localStorage persistence.
- `video-studio.tsx` `pollJob` — `/api/video/{id}` polling with signedUrl extraction.
- `features/video-studio/components/{video-concatenate,video-edit,video-extend}.tsx` — NOT verified (exist on disk, not read). Likely contain working logic for those modes that Angular exposes via media-lightbox actions; must be read before rebuild.

---

## AUDIO
### Angular behavior (verified: `audio.component.html` full, `audio.component.ts` full, `audio.constants.ts` NOT read)
- DIFFERENT pattern from image/video — no flow-prompt-box, no option toolbar.
- Composition: full-bleed `video-background` (abstract-waves.mp4 + overlay) → header "Describe Your Sound" with gemini-spark icon → Processing/Failed overlays → `studio-container` with `glass-effect control-panel`: `mat-button-toggle-group` model selector (Lyria (Music) / Chirp TTS / Gemini TTS) → `mat-divider` → conditional config grid:
  - Lyria: Prompt textarea (Ctrl+Enter generates), Negative Prompt input, Seed number input, Results select (1-4).
  - Chirp/Gemini TTS: Text to Speech textarea (Ctrl+Enter), Language select (40+ languages from `LanguageEnum`), Voice select with "Add your voice" custom-clone option (`AddVoiceDialogComponent`) + 29 preset voices (`VoiceEnum`) with gender labels, Results select.
  - Action row: single "Create" `mat-raised-button` with inline spinner when processing.
- Result = `app-media-lightbox` (audio variant with custom player: play/pause, seek, time/duration).
- State persistence via `AudioStateService`.

### Next behavior (verified: `app/(studio)/audio/page.tsx`, `features/audio-studio/components/audio-studio.tsx`, `features/audio-studio/{types.ts,hooks/use-audio-submit.ts}`)
- Two-column grid form. `<h1>Audio studio</h1>`, native model `<select>` (Lyria/Chirp 3 HD/Gemini TTS), conditional fields. Music: Prompt textarea + Negative Input. TTS: Text textarea + Voice name Input (free text) + Language code Input (default "en-US"). Generate Button. Right = Result + MediaPlayer.
- Polling via `useMediaJob` on `/api/audio/{id}`.

### Deltas
| Delta | Type | Severity |
|---|---|---|
| No full-bleed video background + "Describe Your Sound" header | layout mismatch | High |
| No `glass-effect` control-panel styling | layout mismatch | High |
| Model selector is native select not `mat-button-toggle-group` (segmented control) | behavior mismatch | Medium |
| TTS Voice is free-text input, not select with 29 presets + "Add your voice" clone dialog | missing + behavior | High |
| TTS Language is free-text single value, not 40+ language select | missing | High |
| Lyria missing Seed field | missing | Medium |
| Results (sampleCount) missing entirely | missing | Medium |
| No audio player parity (Angular media-lightbox has custom player) | missing | Medium |
| No Processing/Failed overlays | state mismatch | Medium |

### Logic to PRESERVE (Next)
- `features/audio-studio/hooks/use-audio-submit.ts` — `csrfFetch`, POST `/api/audio`.
- `features/audio-studio/types.ts` — `AudioModel`, `AudioGenerationRequest`, `AUDIO_MODELS`.
- `audio-studio.tsx` poll on `/api/audio/{id}`.

---

## VTO (Virtual Try-On)
### Angular behavior (verified: `vto.component.html` full; `vto.component.ts`, `vto.model.ts` NOT read)
- DIFFERENT pattern: hero + `mat-stepper` (linear, 2 steps).
- Hero: gradient bg + "Creative Studio Virtual Try-On" + subtitle (mobile variant).
- Processing/Failed overlays (same shared pattern).
- Step 1 "Choose your model": `mat-radio-group` (Female/Male) → 2-col grid: left "Select a model" = horizontal `mat-card` grid of preset models (click to select, `selected` class); right "Or upload your own" = dropzone (click→openImageSelector, drag-drop) with placeholder, preview + clear button, "Examples" card row.
- Step 2 "Choose your clothes": top = result media-lightbox (processing/completed/failed states inline here too). Bottom = 4-col grid: left col-1 "Selected Model" preview + "Back to Model Selection" + gradient "Try on!" button (disabled if !firstFormGroup.valid). Right col-3 "clothing-options": 4 sections (Tops/Bottoms/Dresses/Shoes) each = upload dropzone (`openGarmentSelector(slot)`) + horizontal card grid with `selected` state.
- `matStepperNext`/`matStepperPrevious` drive linear flow.

### Next behavior (verified: `app/(studio)/vto/page.tsx`, `features/vto-studio/components/vto-studio.tsx`, `features/vto-studio/{types.ts,hooks/use-vto-state.ts}`)
- `vto/page.tsx` has NO `requireUser()` guard — BUG vs all other routes (image/video/audio/upscale all guard).
- Layout: header "Studio / Virtual try-on" → 2-col grid: left = form card with "Person" text-button + 2x2 garment slot text-buttons + Generate; right = aside with MediaCard when result else empty dashed placeholder.
- No stepper, no preset model gallery, no gender radio, no examples, no dropzone (uses AssetPicker dialog only), no inline processing states.

### Deltas
| Delta | Type | Severity |
|---|---|---|
| `vto/page.tsx` missing `requireUser()` guard | behavior mismatch (security) | Critical |
| No stepper (2-step Choose model → Choose clothes) | layout mismatch | Critical |
| No gender Female/Male radio | missing | High |
| No preset model card gallery; no upload dropzone with examples | missing | High |
| Garments are 4 text-buttons, not 4 labeled sections (Tops/Bottoms/Dresses/Shoes) each with dropzone + card grid | layout + missing | High |
| No "Selected Model" preview pane with Back/Try-on | missing | High |
| No Processing/Failed overlays; result uses MediaCard not media-lightbox | state + layout | High |

### Logic to PRESERVE (Next)
- `features/vto-studio/hooks/use-vto-state.ts` — `useVtoState` (person + garments map).
- `features/vto-studio/types.ts` — `GarmentSlot`, `VtoRequest`.
- `vto-studio.tsx` `submit`/`getStatus` — POST `/api/vto` (csrf from cookie), poll `/api/vto/{id}`.

---

## UPSCALE
### Angular behavior (verified: `upscale.component.html` full; `upscale.component.ts` NOT read)
- DIFFERENT pattern: hero + step-progress + 2-pane comparison.
- Hero: gradient + "Creative Studio Imagen Upscale" + subtitle (mobile variant).
- Processing/Failed overlays (shared pattern).
- Step-progress header: "1 Upload Image to Upscale" (completed number) → progress-line → "2 Upscaled Result" (number activates when loading/done).
- Grid (1 col mobile, 4 col desktop): left col-1 `upload-panel-upscaler`:
  - `drop-zone-upscaler` (click→openUploaderDialog, drag-drop): placeholder OR image preview with hover overlay (Change / delete) OR processing spinner.
  - Settings box (`bg-[#404040]`): Upscale Factor buttons (2/4, selected=blue), Enhance Input Image checkbox, Image Preservation Factor slider (0-1 step 0.1, "Auto" when null, helper text), gradient "Upscale" button (auto_awesome icon).
- Right col-3 `result-panel-upscaler`: loading state ("..."/"Upscaling initiated...") OR empty ("Comparison results will appear here.") OR `slider-comparison-container` with two imgs clipped via `clipPath: inset(...)` driven by `sliderValue` range input + `compare_arrows` handle + Before/After labels. Below: Download + "See more info" buttons.

### Next behavior (verified: `app/(studio)/imagen-upscale/page.tsx`, `features/upscale/components/upscale-studio.tsx`, `features/upscale/{types.ts,hooks/use-upscale.ts}`)
- Single `max-w-3xl` column. Header "Upscale image" + subtitle. Card with UploadDropzone, "Select asset" button, Scale select (2x/4x), Upscale button. Result section = text "Upscale {status}" + Download link.
- No step-progress, no before/after slider comparison, no Enhance Input Image, no Image Preservation Factor, no hover Change/delete on preview.

### Deltas
| Delta | Type | Severity |
|---|---|---|
| No hero gradient + title | layout mismatch | Medium |
| No step-progress header (Upload → Result) | layout mismatch | High |
| No before/after slider comparison (core UX of upscale) | missing | Critical |
| No Enhance Input Image checkbox | missing | High |
| No Image Preservation Factor slider with Auto | missing | High |
| No hover Change/Delete on uploaded preview | behavior mismatch | Medium |
| Result is text + download link, not visual comparison + See more info | layout + missing | High |

### Logic to PRESERVE (Next)
- `features/upscale/hooks/use-upscale.ts` — `useUpscale` POST `/api/upscale`.
- `features/upscale/types.ts` — `UpscaleRequest { factor: 2|4 }`.
- `upscale-studio.tsx` poll `/api/upscale/{id}` + download via `/api/gallery/download?ids=`.

---

## Proposed shared generation primitives (build once in `frontend-next/src/components/studio/`)
Lazy-minimum prop surfaces. Each replaces a per-feature reimplementation. Token styling via existing Tridorian vars.

1. **`<StudioHero>`** — gradient/gooey welcome banner with title + optional subtitle + mobile variant.
   Props: `{ title: string; subtitle?: string; iconVariant?: "spark" | "none"; mobileIconVariant?: boolean }`. Replaces per-feature WelcomeCard + Angular hero. Image/Upscale/VTO use gradient; Video uses autoplay video (add `videoSrc?` prop); Audio uses full-bleed video (add `backgroundVideoSrc?` prop).

2. **`<OptionToolbar>`** — horizontal row of 16x16 (size-14) icon buttons with dropdowns/toggles, each with tooltip + label below. Responsive `grid-cols-2 md:grid-cols-3 lg:flex`.
   Props: `{ items: OptionToolbarItem[] }` where `OptionToolbarItem = { id: string; icon: ReactNode; label: string; tooltip: string; kind: "menu"|"toggle"; selected?: boolean; disabled?: boolean; options?: {value;label}[]; value?: any; onSelect?: (v)=>void; customMenu?: ReactNode }`. Negative-phrases chip-list is passed as `customMenu`. Replaces Angular per-feature mat-fab toolbar AND Next OptionControls.

3. **`<FlowPromptBox>`** — THE central primitive (port of Angular's). Single card: Mode chip (left) + status chips (right) opening Settings popover; prompt textarea; contextual reference-media slots (mode-gated); Rewrite + Generate buttons.
   Props: `{ mode; modes; onModeChange; model; models; onModelChange; aspectRatio; aspectRatioOptions; onAspectRatioChange; outputs; maxOutputs; onOutputsChange; duration?; durations?; onDurationChange?; resolution?; resolutions?; onResolutionChange?; prompt; onPromptChange; isLoading; onGenerate; onRewrite; referenceSlots?: ReactNode; ctrlEnterToGenerate?: boolean }`. Capability gating driven by `VideoCapabilities`-style object. Replaces Next PromptInput + video-studio form.

4. **`<SettingsPopover>`** — the contextual popover opened by FlowPromptBox status chips. Grid of labeled dropdowns (Model/Aspect/Outputs/Duration/Resolution).
   Props: `{ open; onClose; fields: SettingsField[] }` where `SettingsField = { id; label; value; options:{value,label,disabled?,icon?}[]; onSelect }`. Internal to FlowPromptBox but separable for reuse.

5. **`<ReferenceMediaStrip>`** — inline reference-image/video/audio slots inside FlowPromptBox. Mode-gated slot config.
   Props: `{ slots: { kind: "image"|"video"|"audio"; count: 1|2|"multi"; label?; previewUrl?; type?: "media_item"|"url" }[]; onOpenPicker(slot); onClear(slot); onEdit?(slot) }`. RendersFrames/Ingredients/Concatenate/Extend variants.

6. **`<MediaLightbox>`** — unified result surface (port of Angular's). Replaces ResultPanel + MediaPlayer + upscale comparison.
   Props: `{ mediaItem; initialIndex?; actions?: { edit?; generateVideo?; sendToVto?; editWithOmni?; extendWithAi?; concatenate?; delete?; seeMoreInfo?; share?; download?; assignTags? }[]; showSeeMoreInfo?; showDelete?; variant?: "image"|"video"|"audio"|"comparison" }`. The `comparison` variant is the upscale before/after slider. This is the biggest gap — Next has 4 different result surfaces, Angular has 1.

7. **`<GenerationOverlay>`** — fixed inset processing/failed overlay with spinner + message + "You can safely navigate away" + Close.
   Props: `{ status: "processing"|"failed"|null; title?; message?; onDismiss? }`. Replaces per-feature inline overlays.

8. **`<RewriteButton>` / `<GenerateButton>`** — the FlowPromptBox action pair. Generate uses gradient text + spark icon. Rewrite uses `drive_file_rename_outline`. Props: `{ loading; disabled; onGenerate; onRewrite; generateLabel? }`. Small but keeps the exact Angular affordance.

9. **`<StepperFlow>`** (VTO-only, but generic) — linear mat-stepper equivalent.
   Props: `{ steps: { label; isValid?; content: ReactNode }[]; activeStep; onNext; onPrev }`. VTO uses 2 steps. Keep minimal; only build if VTO rebuild lands.

Primitives 1, 3, 6, 7 are the highest-leverage (cover all 5 features). 2 covers image+video. 4, 5, 8 are internal to 3. 9 is VTO-specific.

## Per-feature severity ranking (highest first)
1. **Video** — Critical. Next is a fully generic form; Angular is hero+toolbar+flow-prompt-box+lightbox with 5 modes. Biggest gap. But Next has the best preserve-logic (capability registry + submit mapper).
2. **Upscale** — Critical (core before/after slider comparison entirely missing; result is text).
3. **VTO** — Critical (stepper + galleries missing; also auth guard bug in page.tsx).
4. **Image** — High (closest Next impl; OptionControls + PromptInput exist but flattened, missing 3 toggles + Ingredients mode + reference slots; ResultPanel not lightbox; send-to-video/vto unwired).
5. **Audio** — High (different Angular pattern — glass panel + toggle group + voice clone + 40 languages; Next is bare form).

## What was NOT verified (read before rebuild)
- `frontend/src/app/video/video.component.ts` body (only outline + grep) — full mode logic, remix/extend/concatenate handlers.
- `frontend/src/app/vto/vto.component.ts` + `vto.model.ts` — model/garment data shape, preset sources.
- `frontend/src/app/upscale/upscale.component.ts` — `assetPair`, `sliderValue`, `imagePreservationFactor`, `enhanceInputImage`, `upscaleFactors` defaults, `navigateToDetails`.
- `frontend/src/app/audio/audio.constants.ts` — exact `LanguageEnum`/`VoiceEnum` values.
- `frontend/src/app/common/components/flow-prompt-box/flow-prompt-box.component.ts` — the `@Input()`/`@Output()` contract and `getSelectedModelObject()`/`availableModes()`/`hasDurationOptions()`/`hasResolutionOptions()` capability logic.
- `frontend/src/app/common/components/media-lightbox/media-lightbox.component.html` + `.scss` — exact action button order/icons, PhotoSwipe config, share menu.
- `frontend-next/src/features/video-studio/components/{video-concatenate,video-edit,video-extend}.tsx` — exist, not read; likely contain working mode logic to preserve.
- Angular state services (`VideoStateService`, `AudioStateService`, etc.) — persistence shape.
- Angular `SearchService` (`activeVideoJob$`, `activeAudioJob$`, `startAudioGeneration`) — job orchestration.
- `GenerationOptionsService` + generation-options model — capability registry contract Angular uses.

Confidence: Medium-High on layout/composition deltas (templates fully read). Medium on exact prop contracts (Angular component TS bodies not fully read). Low on Next video mode sub-components (not read).
