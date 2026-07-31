# Migration progress
## Wave 0 — DONE
Foundation: tokens, OpenAPI client, auth (GIS + session cookie + BFF), UI primitives (16 components), workspace provider, Docker/CI, route groups, providers wired. See `mem:migration_nextjs/wave0_status` for details.

## Wave 1 — DONE
Four parallel lanes landed:
- **Gallery (A)**: `src/features/gallery/*`, `src/components/media/*` (media-card, lightbox, player, pagination, infinite-loader, filters), `app/(studio)/gallery/{page,[id]/page,loading,error}.tsx`. Server-side reads via `getServerApiClient()`. Endpoints: `POST /api/gallery/search`, `GET /api/gallery/item/{id}`.
- **Workspace UI (B)**: `src/features/workspaces/components/*` (switcher, create dialog, invite dialog, list), `app/api/workspaces/{route,[id]/route,[id]/invites/route.ts}` BFF proxies, `app/(studio)/settings/workspaces/page.tsx`. WorkspaceSwitcher wired into studio Topbar. Brand guideline: `src/features/brand-guidelines/{components,hooks}/*`, BFF proxies at `app/api/brand-guidelines/{route,[id]/route.ts}`, settings page, 5s polling hook.
- **Templates (C)**: `src/features/templates/{components,hooks,types}/*`, `app/(studio)/fun-templates/{page,[id]/page,loading,error}.tsx`. URL-encoded template hydration (no service singleton). Endpoints: `/api/media-templates`, `/api/media-templates/{id}`.
- **Visual QA (D)**: `playwright.config.ts`, `tests/e2e/{auth,gallery,workspace,templates,a11y}.spec.ts`, `tests/visual/design-system.spec.ts`, `app/visual/page.tsx` (design-system fixture). Playwright + chromium installed.

Routes live (16): `/`, `/_not-found`, `/admin`, `/api/brand-guidelines`, `/api/brand-guidelines/[id]`, `/api/workspaces`, `/api/workspaces/[id]`, `/api/workspaces/[id]/invites`, `/fun-templates`, `/fun-templates/[id]`, `/gallery`, `/gallery/[id]`, `/login`, `/settings/brand-guidelines`, `/settings/workspaces`, `/visual`.

## Validation
- `bun run lint`, `bun run build`, `bun test` (8/8) all green.
- `addlicense` Passed on all new files.

## Open items
1. Backend lacks `GET /api/workspaces/{id}` — BFF proxy exists but FastAPI returns 404. Backend contract lane to add or remove proxy.
2. OpenAPI types sparse for 4xx/5xx + some gallery list fields. Backend contract lane should enrich.
3. Topbar switcher uses native `<select>` — acceptable but could be styled as a custom dropdown later.
4. Playwright specs written but mostly skipped (features depend on auth mocking + live backend). Real E2E needs dev server + mocked session helper.
5. `@axe-core/playwright` not added — a11y specs do manual style checks.
6. Phase 0.4 (feature flags/traffic split/rollback) not yet defined.

## Next waves (per `mem:migration_nextjs/parallel_execution`)
- **Wave 2**: gallery mutations/tags/copy/download/restore, image studio + shared generation form, admin shell/users, source-assets upload/crop/select.
- **Wave 3**: upscale, audio, VTO, admin templates/tags.
- **Wave 4**: video core + advanced, workflow list/history/schema.
- **Wave 5**: workflow editor, workflow run/CSV, workbench model.
- **Wave 6**: workbench UI, parity suite, deployment config.
