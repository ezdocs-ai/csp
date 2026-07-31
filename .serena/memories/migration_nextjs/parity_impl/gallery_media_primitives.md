# Gallery media primitives — parity implementation log

Scope owner: Gallery Media Primitives agent. Write set:
`components/media/{media-card,lightbox,media-player}.tsx`. Source of truth:
Angular `gallery-card`, `media-lightbox`, `media-gallery`. Task list:
`mem:migration_nextjs/parity_routes/content.md`.

## Task 1 — media-card.tsx structural rebuild (DONE)

### Contract (REQUIRED first)
- `MediaCardProps.{onSelect, anySelected}` already present (lead cross-lane fix,
  `parity_impl/wave_status.md` L12-13). `gallery-view.tsx` L178-184 passes
  `anySelected` + 2-arg `onSelect(item, event)`; card calls
  `onSelect(media, event)`. vto-studio (`<MediaCard media={media} />`) passes no
  `onSelect` -> compatible (non-interactive tile). Signature unchanged.

### Files changed
- `frontend-next/src/components/media/media-card.tsx` — full rewrite.

### Gaps closed (vs content.md "Gallery card" deltas)
- Aspect-driven spacer (`spacerPadding`: 2:1 wide / 1:2 tall / audio 2:1 / 1:1).
- Media layering: stacked `<img>` active/inactive opacity crossfade.
- Hover-to-play video swap: thumb + play overlay -> `<video autoPlay muted loop>`.
- Audio tile: dark bg, equalizer icon, `group-hover:animate-pulse`.
- Carousel: prev/next + dots, opacity-0 until `group-hover` (>1 url only).
- Selection indicator: 28px glass circle (top-left), gradient when selected;
  sibling `<button>` (NOT nested in anchor) calls `onSelect` w/ stopPropagation.
- Item-type overlay: bottom gradient scrim + SparkIcon/CloudUploadIcon.
- Tag chips: glass chips + "+N more" (20-char budget).
- Title -> `alt`/`aria-label` via `shortPrompt` (parses JSON `prompt_name`); no
  visible footer (Angular card has none).

### Decisions / departures
- Removed visible footer (title `<h2>`, status `Badge`, type, date `<time>`) —
  Angular card is a pure media tile. Dropped Card/Badge ui imports. IMPACT:
  vto-studio result preview is now a clean tile; caption = VTO-agent concern.
- `next/image` `<Image>` -> `<img>` + eslint-disable (remote signed URLs; matches
  `studio/media-lightbox.tsx` precedent + task hard rule).
- Added `"use client"` (hover-to-play + carousel state).
- Selection indicator + carousel are SIBLINGS of anchor -> valid HTML.
- Audio pulse = `group-hover:animate-pulse` (Angular custom keyframes skipped).
- Tag colored layer omitted (Angular `::before` layer is commented out).
- Hit targets `min-h/min-w-[44px]` with smaller inner visuals.

### Deferred / not verified
- No browser; visual confirm pending. 2 benign diagnostics warnings
  (`opacity-0` + `focus-visible:opacity-100`) — intentional reveal pattern.

## Task 2 — lightbox.tsx (DONE: delegate, not third impl)

### Decision
- `studio/media-lightbox.tsx` (`MediaLightbox`) ALREADY covers gap core:
  image/video/audio stage, output thumbnail strip (>1 url), ActionsToolbar,
  comparison variant, exported `clipInset`. Built by another agent; NOT edited.
- `media/lightbox.tsx` `Lightbox` was an ORPHAN modal duplicating stage logic.
- Per task guidance, made `Lightbox` a thin MODAL A11Y SHELL delegating the
  stage to `studio/MediaLightbox`. Deleted duplicated `next/image` +
  `MediaPlayer` stage.

### Files changed
- `frontend-next/src/components/media/lightbox.tsx` — rewrite (shell + delegate).

### Gaps closed
- Modal a11y shell: `role=dialog`, `aria-modal`, scrim click-to-close, close
  button (44px, auto-focus), Escape + Arrow L/R, item-level `onNavigate`
  Previous/Next (44px).
- Maps `MediaItem` -> `MediaLightboxMedia` + `variant` (from `metadata.mimeType`).
- Output thumbnails + action toolbar flow through studio component when caller
  passes `actions` (none today — detail agent wires; router-state = lead call).

### Deferred (structurally blocked)
- Custom audio in lightbox: studio audio stage is NATIVE `<audio controls>`;
  cannot edit studio, third impl forbidden. Custom audio in `media-player.tsx`
  (task 3) serves its direct consumers. Lightbox audio native until studio
  agent switches to `MediaPlayer`.
- PhotoSwipe zoom: new dep -> blocked. Share menu / `img_index` sync: studio-owned.

## Task 3 — media-player.tsx custom audio UI (DONE)

### Files changed
- `frontend-next/src/components/media/media-player.tsx` — audio branch rebuilt;
  video branch unchanged (native controls, per memo).

### Gaps closed
- Custom `AudioPlayer`: hidden `<audio>` + 44px play/pause circle
  (accent-primary), current/total time (`m:ss`, tabular-nums, `--tri-font-code`),
  native `<input type=range>` seek (`accent-color` token, >=44px, disabled until
  duration known). Resets on `ended`. Stdlib/native first (range = mat-slider
  equivalent; CSS accent-color over JS).
- `MediaPlayerProps{src,type,poster}` unchanged. Benefits audio-studio +
  gallery-detail audio (lightbox no longer imports it after task 2).

## Cross-agent contract changes
- NONE. `MediaCardProps`/`LightboxProps`/`MediaPlayerProps` unchanged.
  gallery-view/vto-studio/audio-studio/video-studio/gallery-detail/workflow-run
  re-typecheck (0 errors).
- NEW cross-import `media/lightbox.tsx` -> `@/src/components/studio/media-lightbox`
  (sanctioned by task; did NOT edit studio).

## Could not verify
- No browser/terminal. Static only: re-read each edited region after each write;
  `diagnostics` on all 3 files + 5 consumers (0 errors; only repo-wide Tailwind
  v4 `(--tri-*)` shorthand suggestions matching existing style, not introduced
  here). `"use client"` + `@/src/...` alias checked by eye.
