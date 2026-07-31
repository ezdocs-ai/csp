# Wave 3 — Audio Studio parity (Next.js ← Angular)

Owner: Audio agent. Scope: `frontend-next/src/features/audio-studio/**` ONLY. Angular truth: `frontend/src/app/audio/{audio.component.html,audio.component.ts,audio.constants.ts}`. Primitives FROZEN in `components/studio/`.

## Files changed
- `features/audio-studio/audio-constants.ts` (NEW) — `LANGUAGES` (46), `VOICES` (29, with gender labels), `DEFAULT_LANGUAGE="en-US"`, `DEFAULT_VOICE="Puck"`. Copied EXACTLY from Angular `audio.constants.ts` + the arrays in `audio.component.ts`. Verified tail landed (last entry `Zubenelgenubi (Male)`).
- `features/audio-studio/types.ts` — updated `AUDIO_MODELS` labels to Angular segmented-control text ("Lyria (Music)"/"Chirp TTS"/"Gemini TTS"); added pure `audioFieldsFor(model)` (model→visible-fields map). Types `AudioGenerationRequest`/`AudioModel`/`AudioGenerationResponse` UNCHANGED (already had seed/sampleCount/language/voice — additive only).
- `features/audio-studio/components/audio-studio.tsx` — full rewrite: `StudioHero` (gradient, see asset gap) + `GenerationOverlay` (processing/failed) + `MediaLightbox variant="audio"` (replaces MediaPlayer) + glass `control-panel` + segmented `<input type=radio name=audio-model>` model control + divider + conditional config grid (Lyria: Prompt+Ctrl+Enter / Negative / Seed(number) / Results 1-4; TTS: Text-to-Speech+Ctrl+Enter / Language(46) / Voice(29+disabled clone) / Results) + single "Create" button w/ inline Spinner. Single `prompt` state consolidated (matches Angular + `CreateAudioDto.prompt`).
- `features/audio-studio/__tests__/audio-fields.test.ts` (NEW) — `bun:test`, covers `audioFieldsFor` for lyria/chirp/gemini-tts.
- `hooks/use-audio-submit.ts` — UNTOUCHED (csrfFetch + POST /api/audio preserved verbatim).
- `index.ts` — UNTOUCHED.
- `app/(studio)/audio/page.tsx` — UNTOUCHED (imports `AudioStudio`).

## Gaps closed (vs parity_routes/generation.md AUDIO table)
- Full-bleed video bg + "Describe Your Sound" header → StudioHero (gradient fallback, asset missing).
- glass-effect control-panel styling.
- Model selector → segmented radio group (native radios, sr-only + styled labels, free arrow-key nav).
- TTS Voice → 29-preset select + gender labels.
- TTS Language → 46-language select.
- Lyria Seed number input.
- Results (sampleCount) 1-4 select.
- Result surface → MediaLightbox audio variant (native `<audio controls>`).
- Processing/Failed overlays → GenerationOverlay.

## Gaps DEFERRED (with reasons)
- **Background video asset MISSING**: `public/assets/videos/abstract-waves.mp4` does NOT exist (only `google-deepmind-veo3.mp4`). Used gradient StudioHero variant. `ponytail:` comment in component names the asset path to add; pass `backgroundVideoSrc="/assets/videos/abstract-waves.mp4"` once landed. NOT pointing at a 404.
- **Voice clone ("Add your voice")**: NO clone endpoint in `openapi.json` — only `/api/audios/generate` + `/api/audios/transcribe` exist. Angular `AddVoiceDialogComponent` has no backend. Rendered as a DISABLED `<option value="__add_voice__">Add your voice (coming soon)</option>` + `title="Custom voice cloning is not yet available"` + `ponytail:` comment naming the missing `POST /api/audios/clone`. Did NOT fabricate an API call.
- **MediaLightbox action wiring** (Angular shows seeMoreInfo + delete): NOT wired. Existing Next feature only polls `/api/audio/{id}`; no gallery-delete plumbing exists in this feature. `/api/gallery/bulk-delete` exists in openapi but is out of scope for visual-parity swap. Rendered MediaLightbox with `media={url,prompt}` only.
- State persistence (Angular `AudioStateService`) — NOT ported; Next feature had none and task is visual parity, not state infra.

## Primitive prop-surface gaps
- NONE. `StudioHero{title,icon,backgroundVideoSrc?}`, `GenerationOverlay{status,title?,message?,onDismiss?}`, `MediaLightbox{variant,media,actions?}` all matched the generation_primitives.md contract exactly. No primitive edits needed (FROZEN anyway).

## Voice-clone endpoint decision
Disabled-option + ponytail (above). Fabricated API rejected per hard rule.

## Unverified / notes
- No terminal; could NOT run `bun test` or `next build`. LSP diagnostics on all 4 touched files = clean (component warnings are Tailwind long-form `[var(--tri-*)]` shorthand nits, identical to sibling `video-studio.tsx`; the LSP also emitted a stale "line 284" batch referencing DELETED old-file classes — confirmed by re-read that file ends cleanly at line 283 with no duplication).
- Diagnostics tool MISSED checks done by eye: confirmed `"use client"` is a literal directive (not `import "use client"`); import alias `@/src/...` (never `@/lib`); `KeyboardEvent` type imported from "react" (no `React.` namespace); no `?? ""` redundancy; `<img>` rules N/A (no imgs in this feature).
- Model→backend mapping (`lyria`→`lyria-002`, `chirp`→`chirp_3`, `gemini-tts`→`gemini-2.5-flash-tts`) is the Next `/api/audio` proxy's concern; UI sends the AudioModel union value as before to preserve the hook verbatim. Did NOT change model values sent.
- sampleCount default = 4 (matches Angular); DTO max 4. ✓
- Ctrl/Cmd+Enter generate wired on the shared prompt textarea.
