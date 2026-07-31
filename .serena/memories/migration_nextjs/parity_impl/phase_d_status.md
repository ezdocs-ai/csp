# Phase D parity recovery — runtime complete, CLI gate pending

## Completed fixes
- SSR-safe persisted state: Image + Video use deterministic initial render, deferred localStorage restore, gated persistence.
- Image contract/UI: strips client-only fields before strict DTO; Angular four-model IMAGE allowlist + stale selection reconciliation; stable JobPoller status callback prevents maximum-depth loop.
- Shared source assets: UI type -> backend mime wildcard; page/pageSize -> limit/offset; normalized names/URLs; signed previews use plain `<img>` and truthy thumbnail fallback.
- Upscale: CSRF preserved; FormData mapper sends existing source/media asset to backend `/api/images/upload-upscale`; contract tests added.
- VTO: `shoes` -> backend `shoe_image`; VTO assets BFF added; preset/upload callers use valid Next routes; empty thumbnail fallback fixed.
- Nested `<main>` violations removed; only layout-owned and standalone page mains remain.

## Live browser evidence (avei@tridorian.com)
- Image POST 202, poll 200; no hydration mismatch; valid Angular image model; no update-depth loop after clean reload.
- Video POST 202 and completed with `presignedUrls` result.
- Audio POST 202 and completed with `presignedUrls` result.
- Upscale source picker GET 200 (46 assets), selection works, POST 202, poll 200.
- VTO assets GET 200, presets render, top+shoe request POST 202, poll 200.
- Video, Audio, and VTO completed with `presignedUrls` results; Image and Upscale remained processing at final status check.
- Final studio flows had zero fresh console errors.

## Reviews/memories
- Hydration: `mem:migration_nextjs/parity_impl/phase_d_hydration_review`
- Nested mains: `mem:migration_nextjs/parity_impl/phase_d_nested_main_fix`
- Source assets: `mem:migration_nextjs/parity_impl/phase_d_source_assets_review`
- Upscale: `mem:migration_nextjs/parity_impl/phase_d_upscale_runtime_fix`
- VTO: `mem:migration_nextjs/parity_impl/phase_d_vto_runtime_fix`
- Final review: `mem:migration_nextjs/parity_impl/phase_d_final_review`

## Validation state
- Project diagnostics: 0 errors; style warnings remain.
- Final independent review: no blockers.
- Required CLI gate has not been run by the agent because no terminal tool is available. Run from `frontend-next`: `bun run build && bun run lint && bun run test`.
