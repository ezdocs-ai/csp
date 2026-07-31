# Phase D — Code/Runtime Correctness Review (READ-ONLY)

Reviewer: Code/Runtime reviewer. Scope: `components/studio/**`, `features/{image,video,upscale,vto,audio}-studio/**`, `app/(studio)/**/page.tsx`, BFF `app/api/**/route.ts`. Cross-checked against `openapi.json` + `backend/src/**` DTOs.

Build/lint are green; all findings below are invisible to `next build`/`diagnostics` (runtime-only or BFF-contract mismatches).

---

## CRITICAL (4)

### C1 — Image studio: infinite rapid polling loop
**File**: `features/image-studio/components/image-studio.tsx` L113-130 + `lib/hooks/use-media-job.ts` L13-33
**Bug**: `getStatus = useCallback(..., [job])` calls `setJob(new object)` inside every tick. The new `job` reference recreates `getStatus`, which is in `useMediaJob`'s effect dep array → effect tears down + re-subscribes + calls `tick()` immediately on every poll response. During the entire "processing" duration, the component fires a network request on every round-trip (hundreds instead of the intended 6 over 30s). Stops only when status flips to completed/failed (because `enabled={job.status === "processing"}` goes false).
**Fix direction**: Remove `job` from `getStatus`'s deps — read the current job id via a ref (`jobIdRef.current`) so `getStatus` is stable. Compare: VTO and Upscale correctly depend on `[jobId]`/`[mediaItemId]` (stable during a single job) and call `setState` on a DIFFERENT variable, avoiding this loop.

### C2 — Upscale: POST sends no CSRF token → 403 every submit
**File**: `features/upscale/hooks/use-upscale.ts` L17-21
**Bug**: `fetch("/api/upscale", { headers: { "Content-Type": "application/json" } })` — no `x-csrf-token`. The route (`app/api/upscale/route.ts` L8) calls `verifyCsrf(cookie, header)`; `verifyCsrf` (session.ts L94) returns `false` when `submittedToken` is undefined. Every upscale attempt is rejected 403. All other studios (image/video/audio use `csrfFetch`; VTO reads `csp_csrf` cookie) send the token correctly — upscale is the sole outlier.
**Fix direction**: Wrap with the same `csrfFetch` pattern (fetch `/api/auth/csrf` → send `x-csrf-token`) or read the `csp_csrf` cookie like VTO.

### C3 — Video BFF route validates wrong field name → 400 every submit
**File**: `app/api/video/route.ts` L12 vs `features/video-studio/hooks/use-video-submit.ts` L17-37
**Bug**: Route checks `!body.model`; client (`toBackendPayload`) sends `generationModel` (matching `CreateVeoDto.generation_model` / camelCase alias). `body.model` is always `undefined` → 400 "workspaceId and model required" before the request reaches the backend. The audio route has the same `!body.model` check (L10) but the audio client DOES send `model`, so audio's validation passes (audio fails later for a different reason — see C4).
**Fix direction**: Change route validation to `!body.generationModel`.

### C4 — Audio sends short model names; backend enum expects full values → 422
**File**: `features/audio-studio/types.ts` L3 + `app/api/audio/route.ts` L10-17
**Bug**: Client sends `model: "lyria" | "chirp" | "gemini-tts"`. The BFF route forwards `body` verbatim to `/api/audios/generate`. Backend `CreateAudioDto.model` is `GenerationModelEnum` with values `"lyria-002"`, `"chirp_3"`, `"gemini-2.5-flash-tts"`. Pydantic rejects the short names → 422. The audio wave-3 memory claims "Model→backend mapping is the Next /api/audio proxy's concern" but the proxy does NO mapping (forwards verbatim).
**Fix direction**: Either map in the BFF route (`{lyria:"lyria-002", chirp:"chirp_3", "gemini-tts":"gemini-2.5-flash-tts"}[body.model]`) or send the full enum values from the client.

---

## HIGH (2)

### H1 — Video & Audio polling read `data.signedUrl`; `MediaItemResponse` has no such field → result never displays
**File**: `features/video-studio/components/video-studio.tsx` L113; `features/audio-studio/components/audio-studio.tsx` L46
**Bug**: Both poll handlers do `if (data.status === "completed" && data.signedUrl) setResultUrl(data.signedUrl)`. The BFF routes (`app/api/{video,audio}/[id]/route.ts`) proxy to `/api/gallery/item/{id}` which returns `MediaItemResponse` — that schema (openapi + `gallery_response_dto.py`) has `presignedUrls: string[]`, NOT `signedUrl`. So `data.signedUrl` is always `undefined` → `resultUrl` stays null → `isCompleted` is never true → the MediaLightbox result never renders, even after a successful generation. Image/VTO/Upscale correctly read `presignedUrls`.
**Fix direction**: Read `data.presignedUrls?.[0]` instead of `data.signedUrl`.

### H2 — Audio `useMediaJob` receives an inline (non-memoized) `getStatus` → polls on every render
**File**: `features/audio-studio/components/audio-studio.tsx` L40-51
**Bug**: The poll callback is an inline `async () => {...}` closing over `mediaItemId`, recreated every render. `useMediaJob` has `getStatus` in its effect dep array → the effect tears down + re-subscribes + fires `tick()` immediately on every render. During processing, any user interaction (typing in the prompt, changing a select) triggers an immediate unscheduled poll. The 15s interval is effectively bypassed during user activity. (Does NOT infinite-loop like C1 because the inline function doesn't depend on state it mutates, but it's still excessive polling.)
**Fix direction**: Wrap in `useCallback(async () => {...}, [mediaItemId])` — same pattern VTO/Upscale use.

---

## MEDIUM (4)

### M1 — Gemini rewrite endpoints: no BFF handler + image uses wrong path
**File**: `features/image-studio/components/image-studio.tsx` L135 (`/api/gemini/rewrite`); `features/video-studio/components/video-studio.tsx` L223 (`/api/gemini/rewrite-prompt`)
**Bug**: There are NO `app/api/gemini/**/route.ts` files and NO proxy rewrites in `next.config.ts` (confirmed: the config is bare `output: "standalone"`). Both rewrite calls hit Next's default 404 (HTML), fail JSON parse, and silently no-op. Additionally, image calls `/api/gemini/rewrite` but the backend endpoint is `/api/gemini/rewrite-prompt` — so even if a handler/proxy existed, image's path wouldn't match. Video uses the correct backend path but still has no BFF handler.
**Fix direction**: Add `app/api/gemini/rewrite-prompt/route.ts` BFF handler (proxy to backend); fix image's path to match.

### M2 — `useVideoState.update` is not `useCallback`-wrapped → effect churn
**File**: `features/vto-studio/hooks/use-video-state.ts` L43-46
**Bug**: `update` is an inline function (new identity every render), but is used in 3 `useEffect` dep arrays in `video-studio.tsx` (L82, L98, L106). Every render re-runs all 3 effects. Not an infinite loop (guarded conditions prevent cascading `setState`), but every keystroke triggers redundant effect executions. Compare: `useImageState` correctly wraps `update` in `useCallback([])`.
**Fix direction**: Wrap `update` in `useCallback([])`.

### M3 — `useMediaJob` doesn't reset `status` when polled identity changes → stale-status flash
**File**: `lib/hooks/use-media-job.ts` L9
**Bug**: `status` initial state is `"processing"` but is never reset when `getStatus` identity changes (i.e., when a new job starts). After job-1 completes (`status="completed"`), starting job-2: `mediaItemId`/`jobId` changes → `getStatus` changes → effect re-subscribes, but `status` retains `"completed"` until the first tick. During that gap, `hasResult`/`isCompleted` may evaluate true using job-2's (stale) media + job-1's completed status → brief flash of wrong content. Affects VTO (`hasResult`), Upscale (`hasResult`), and Audio. Not C1 because it's transient.
**Fix direction**: Reset `status` to `"processing"` inside the effect body before the first tick, or clear local media/job state when starting a new submission.

### M4 — VTO `lightboxMedia.mimeType` hardcoded to `"image/png"` regardless of actual type
**File**: `features/vto-studio/components/vto-studio.tsx` L293
**Bug**: `mimeType: media.metadata?.mimeType ? String(media.metadata.mimeType) : "image/png"`. VTO results from the backend are JPEG (`MimeTypeEnum.image/jpeg` is common for generated images). The fallback `"image/png"` is incorrect for JPEG outputs. Currently harmless because `MediaLightbox` ignores `mimeType` for the `image` variant, but it's inaccurate metadata that will mislead if the lightbox ever uses it.
**Fix direction**: Omit the default or use the actual `media.mimeType` field from `MediaItemResponse` (the poll returns it at top level, not nested in `metadata`).

---

## LOW (1)

### L1 — `useImageState` localStorage-restore effect dep is `[initial]` (unstable prop reference)
**File**: `features/image-studio/hooks/use-image-state.ts` L16-24
**Bug**: The effect re-reads localStorage and applies `{...current, ...JSON.parse(saved), ...initial}` whenever `initial` changes. `initial` is `initialState` from `page.tsx` (`{ prompt: params.prompt, workspaceId: ... }`). Currently stable because the page is a Server Component (serialized once), so this is latent. But if a future parent re-renders, the `...initial` spread at the end would clobber the user's in-session prompt with the URL `prompt` (typically `undefined`). Compare: `useVideoState` reads localStorage in the `useState` initializer (runs once, no effect).
**Fix direction**: Move localStorage read into the `useState` initializer (like `useVideoState`), eliminating the effect entirely.

---

## NOT a bug (verified clean)
- All 5 `app/(studio)/**/page.tsx` call `requireUser()` ✓ (the VTO auth gap from the original parity analysis is fixed).
- All 5 BFF mutating routes enforce CSRF via `verifyCsrf` ✓ (the issue is the upscale CLIENT not sending the token, not the route).
- Primitive prop contracts: all 5 features honor the documented `generation_primitives` surfaces — no drift detected after wave-3 adoption.
- `MediaLightbox comparison` variant now renders `ActionsToolbar` ✓ (the wave-3-lead fix holds).
- `flow-prompt-box` Escape/click-outside dismiss effect has correct cleanup ✓.
- VTO `getStatus`/Upscale `getStatus` correctly use `[jobId]`/`[mediaItemId]` deps → no infinite loop (only image has it).
