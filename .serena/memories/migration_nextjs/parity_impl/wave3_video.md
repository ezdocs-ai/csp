# Wave 3 — Video Studio Next.js port (verification + finishing)

Owner: Wave-3 Video agent. Write set: `csp/frontend-next/src/features/video-studio/**` (STRICT). Primitives in `components/studio/**` FROZEN. No terminal; static verification only.

## State on arrival
A prior wave had ALREADY landed ~95% of the rebuild. `video-studio.tsx` already composed `StudioHero`, `GenerationOverlay`, `OptionToolbar`, `FlowPromptBox`, `ReferenceMediaStrip`, `MediaLightbox`; `mode-slots.ts` (pure mode→slot map) + its test were present; preserve-verbatim hooks (capabilities/submit/state) intact; page route `app/(studio)/video/page.tsx` has `requireUser()` + imports `VideoStudio` from barrel `index.ts` (exports match). The three "UNREAD mode components" named in the task (`video-concatenate/edit/extend.tsx`) DO NOT EXIST — the prior wave correctly folded their logic into `mode-slots.ts` (lazy/senior: one pure fn > three components) + the MediaLightbox action handlers in `video-studio.tsx`.

## Files changed (this wave)
1. `components/video-studio.tsx` — **BUG FIX (root cause)**: mode switching was broken. `FlowPromptBox` (frozen) selects via `entry.value === mode` and emits `entry.value`, but `modes` was built with raw enum values while `mode` prop + `onModeChange` used display labels → no item ever matched, and clicking a mode emitted the raw value which the label-expecting handler never resolved → `update({mode})` never called. Fix: build `modes` with `{ value: MODE_LABELS[value], label: MODE_LABELS[value] }` so value===label===trigger text; all three contract points (prop, list, handler) now align. 1-line semantic change + 2 comment lines.
2. `components/slot-config.ts` — **DELETED**. Dead code (grep across all `frontend-next/**/*.ts*`: zero importers of `slotConfigForMode`/the file). Superseded by `mode-slots.ts`; carried a STALE `ponytail:` comment whose premise ("mode values absent from the frozen VideoMode union") is now FALSE — types.ts has all 5 Angular modes. "Deletion over addition" mandate.
3. `__tests__/slot-config.test.ts` — **DELETED**. Tested only the dead `slotConfigForMode` + a legacy 4-entry MODE_LABELS (first/last-frame/reference only). Its replacement `mode-slots.test.ts` already covers the live logic thoroughly.

## Gaps closed
- Mode-switch functional bug (above) — was a silent total failure of the primary affordance.
- Dead-code/stale-comment removal (slot-config.ts).

## Gaps DEFERRED / reported (out of write set)
- **Welcome video asset MISSING**: Angular hero uses `assets/videos/generate-video-homepage-video.mp4`; `frontend-next/public/assets/videos/` only has `google-deepmind-veo3.mp4`. `StudioHero` is wired WITHOUT `videoSrc` → gradient fallback (the sanctioned fallback per task; never points at a 404). Copying the mp4 is OUTSIDE `features/video-studio/**` (public/ is another owner). Left gradient + reported.
- **Rewrite endpoint unverified**: `video-studio.tsx` `handleRewrite` calls `/api/gemini/rewrite-prompt`. Backend openapi.json HAS it (`RewritePromptRequestDto{targetType,userPrompt}`, `targetType: image|video|audio` ✓). No local `app/api/gemini/*` BFF handler exists (unlike video/options which have handlers) — relies on an inferred catch-all proxy in next.config (not readable here). Best-effort try/catch, non-blocking. Flag as unverified-proxy, not a hard gap.

## What the 3 "mode components" contained & reuse
They DIDN'T exist as files. Equivalent logic reused: (a) slot layout → `mode-slots.ts` `modeSlotConfig(mode,{maxReferenceImages,isOmni})` (Frames→2 image+divider; Concatenate→2 video+divider; Extend→1 video; Ingredients→N image refs + video-ref/audio-ref when Omni; Text→none). (b) mode-switch handlers → `handleExtendWithAi/handleEditWithOmni/handleConcatenate` in `video-studio.tsx` set remix state (mode + parentMediaItemId + seed a slot asset) — Angular-faithful (Angular sets `remixState`, does NOT call API directly). Corresponding BFF routes `/api/video/{concatenate,edit,extend}` EXIST but are intentionally not called from these handlers (matches Angular).

## Primitive prop-surface gaps
None encountered. All 6 frozen primitives' contracts matched `video-studio.tsx`'s call sites exactly: `FlowOption{value,label,icon?,disabled?}`, `FlowMode{value,label}`, `OptionToolbarItem{...,customMenu}`, `ReferenceSlot{id,kind,previewUrl?,label?}`, `MediaLightboxActions{extendWithAi,editWithOmni,concatenate,delete,...}`, `GenerationOverlay{status,title,message,onDismiss}`, `StudioHero{title,subtitle?,icon?,videoSrc?,backgroundVideoSrc?}`. z-index stack respected (FlowPromptBox popover z-[60] / card z-[55] above OptionToolbar z-50) — untouched.

## Endpoints (no-invent rule) — all VERIFIED real
BFF route folders confirmed present: `app/api/video/route.ts` (POST), `app/api/video/[id]` (GET poll, `signedUrl` extraction), `app/api/video/{concatenate,edit,extend}`, `app/api/options/video-generation`. openapi.json backend: `/api/videos/generate-videos` (CreateVeoDto ✓ matches `toBackendPayload`), `/api/gemini/rewrite-prompt`. NO invented endpoints.

## Verification done (no terminal)
- `diagnostics` on `video-studio.tsx`: 0 errors. Remaining warnings are (a) LSP artifact attributing another file's classes to a nonexistent "line 536" (file is 535 lines; classes like `text-h3-size`/`font-weight-semibold` don't appear in this file), and (b) `text-[var(--tri-state-error)]`→`text-error` which is the MANDATED `--tri-*` styling pattern — left as-is per task directive.
- `diagnostics` on `mode-slots.ts`: clean.
- Re-read every edited/deleted region by eye (edit_file truncation check): confirmed intact.
- Contracts checked by eye against frozen primitive sources (FlowPromptBox selected/emits `entry.value`; StudioHero `videoSrc?`; MediaLightboxActions keys).
- Preserve-verbatim hooks NOT modified; `capabilities.test.ts` covers untouched functions (safeResolutions/safeDurations/safeAspectRatios/safeMaxOutputs/pickModel) — still valid.
- Tests use `import { test } from "bun:test"` ✓ (capabilities + mode-slots). Deleted slot-config.test.ts was the only non-bun-irrelevant one.
- Alias check: all imports `@/src/...` (incl `@/src/lib/hooks/use-media-job`, `@/src/lib/workspace`, `@/src/lib/auth/server`) — NO `@/lib/` misuse. `"use client";` literal directive at top of client files ✓.
- NOT run: `bun test` / `next build` (no terminal per task). Tests are pure-function; static review only.

## Unverified
- `bun test` execution (no terminal). `next build` (no terminal). The rewrite proxy path (above).
