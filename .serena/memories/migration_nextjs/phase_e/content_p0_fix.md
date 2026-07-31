# Phase E content P0 fixes — COMPLETE

## Changed files (10)
1. `frontend-next/src/components/media/pagination.tsx` — `useSearchParams` moved above early `return null` (hook unconditional); preserves all filters on page nav.
2. `frontend-next/src/features/templates/types.ts` — widened `TemplateDetail` to real `MediaTemplateResponse` shape (`generationParameters`, `sourceAssets`, `enrichedSourceAssets`, `mimeType`, `gcsUris`, `presignedUrls`). Legacy flat fields kept for back-compat.
3. `frontend-next/src/features/templates/components/use-template-button.tsx` — rewrote to read `generationParameters` + `enrichedSourceAssets`; exported pure helpers `deriveMediaType`, `studioRouteFor`, `buildTemplateParams`. Test caught NaN-asset-id bug → filter now uses `Number.isFinite`.
4. `frontend-next/app/(studio)/page.tsx` — consume template URL params → `ImageGenerationRequest` (prompt, model, aspectRatio, style, colorAndTone, lighting, composition, negativePrompt, sourceAssetIds, workspaceId).
5. `frontend-next/src/features/gallery/components/copy-to-workspace-dialog.tsx` — NEW dialog using `useWorkspace` + `useGalleryMutations.copyMedia`. Reset via remount key (no setState-in-effect).
6. `frontend-next/src/features/gallery/components/bulk-actions.tsx` — wire `CopyToWorkspaceDialog` (action "copy") with `key={action}` remount; SelectionBar reformatted multi-line (no behavior change).
7. `frontend-next/src/features/gallery/components/gallery-detail.tsx` — wired genuinely-functional actions (download/downloadZip, assign tags/TagAssigner, delete/ConfirmDialog+deleteMedia). NO fabricated actions.
8. `frontend-next/app/(studio)/asset-detail/[id]/page.tsx` — NEW authenticated route fetching real backend `/api/source_assets/{id}` via server API client; renders MediaPlayer/Image + metadata.
9. `frontend-next/app/(studio)/asset-detail/[id]/loading.tsx` — NEW skeleton (mirrors gallery pattern).
10. `frontend-next/app/(studio)/asset-detail/[id]/error.tsx` — NEW error boundary (mirrors gallery pattern).
11. `frontend-next/src/features/templates/__tests__/use-template-button.test.ts` — NEW bun:test (8 cases) for pure helpers.

## Completed goals (5/5)
1. ✅ Authenticated asset-detail route using real `/api/source_assets/{id}` + existing MediaPlayer/Image/Badge/Card components.
2. ✅ Pagination preserves all search params (hook unconditional, lint clean).
3. ✅ Copy-to-workspace invokes real `copyMedia` mutation through dialog + workspace selection (no setState-in-effect).
4. ✅ Template handoff hydrates supported image fields (prompt/model/aspectRatio/style/colorAndTone/lighting/composition/negativePrompt/sourceAssetIds) — reads real `generationParameters`, falls back to flat fields.
5. ✅ Gallery detail actions wired only where APIs/routes functional (download, tags, delete). No fabricated edit/share/video/vto/extend/concatenate.

## Diagnostics
- 0 errors across all 11 changed files.
- Remaining: pre-existing repo-wide CSS-variable style warnings (e.g. `gap-(--tri-space-2)` shorthand) — NOT from these changes, NOT fixed (out of scope).

## Tests
- `bun test src/features/templates src/features/gallery/__tests__` → 27 pass, 0 fail.

## Intentionally unsupported actions (do NOT wire — no functional target)
- **Gallery detail**: edit, share, generate-video, send-to-vto, edit-with-omni, extend-with-ai, concatenate. No route/mutation exists for these from the detail page; Angular lightbox toolbar deferred (router-state carry needs lead decision). Lightbox component (`media/lightbox.tsx`) is dead code in gallery context.
- **Template handoff → video/audio/vto studios**: these studio components (`VideoStudio`/`AudioStudio`/`VtoStudio`) take NO props and read NO URL params. Template handoff ONLY functional for image studio (home route). Hydrating those studios requires component-level changes outside this task's scope.
- **Asset-detail actions**: source assets have no gallery-style copy/delete-from-detail API for non-admin users. Page is read-only (preview + metadata) — no fabricated actions.

## Key findings (audit corrections)
- Old audit overstated Lightbox actions wiring — `Lightbox` is unused in gallery; GalleryView links directly to `/gallery/{id}`.
- Video/Audio/VTO studios accept no URL hydration — template handoff was never functional for them.
- Gallery BFF copy route forwards `{mediaIds, workspaceId}` straight to backend `/api/gallery/bulk-copy` (same pattern as delete/tag). `useGalleryMutations.copyMedia` already existed but was never called.

## Note
- Stale memory `migration_nextjs/phase_e/admin_templates_fix` created earlier (wrong name) — this is the correct one: `migration_nextjs/phase_e/content_p0_fix`.
