# Migration COMPLETE — all waves
## Final route inventory (53 routes)
### Studio (`app/(studio)`)
- `/` — Image studio
- `/video`, `/vto`, `/audio`, `/imagen-upscale` — Generation studios
- `/gallery`, `/gallery/[id]` — Gallery list + detail
- `/fun-templates`, `/fun-templates/[id]` — Templates
- `/workbench` — Timeline editor
- `/workflows`, `/workflows/[id]`, `/workflows/new`, `/workflows/[id]/edit`, `/workflows/[id]/run` — Workflow CRUD + editor + runner
- `/settings/workspaces`, `/settings/brand-guidelines`

### Admin (`app/(admin)/admin`)
- `/admin` — Dashboard (charts)
- `/admin/users`, `/admin/source-assets`, `/admin/templates`, `/admin/tags`, `/admin/media-gallery`

### Public (`app/(public)`)
- `/login` — GIS + FedCM sign-in

### BFF API (`app/api/*`)
Auth: `csrf`, `login`, `logout`
Gallery: `delete`, `copy`, `tag`, `restore`, `download`
Images: `route`, `[id]`
Video: `route`, `[id]`, `concatenate`, `edit`, `extend`
Audio: `route`, `[id]`
VTO: `route`, `[id]`
Upscale: `route`, `[id]`
Workspaces: `route`, `[id]`, `[id]/invites`
Brand guidelines: `route`, `[id]`
Source assets: `route`, `[id]`, `upload-url`
Workflows: `route`, `create`, `[id]`, `[id]/update`, `[id]/execute`, `[id]/executions`, `[id]/run`
Admin: `dashboard`, `users`, `users/[id]`, `templates`, `templates/[id]`, `tags`, `tags/[id]`, `media-gallery`
Workbench: `render`

### Other
- `/visual` — design-system fixture (Playwright screenshots)
- Middleware proxy protecting studio/admin routes

## Wave summary
- **W0**: Tokens, OpenAPI client, auth (GIS+session+BFF), UI primitives (16), workspace provider, Docker/CI, route groups, providers.
- **W1**: Gallery read + media primitives, workspace UI + brand guideline, templates, Visual QA harness.
- **W2**: Gallery mutations, image studio, admin shell + users, source-assets primitives.
- **W3**: Upscale, audio, VTO, admin templates/tags/media-gallery.
- **W4**: Video core + advanced (edit/extend/concatenate), workflow list/detail/execute/history.
- **W5**: Workflow editor (steps/reorder/validation), workflow run + CSV batch, workbench pure timeline model + tests.
- **W6**: Workbench interactive UI (tracks/playback/render), deployment config (Terraform Cloud Run + Cloud Build + standalone Dockerfile).

## Validation (ALL GREEN)
- `bun run lint` — 0 errors, 1 pre-existing warning (admin media-gallery effect dep, not blocking).
- `bun run build` — ALL 53 routes compiled, TypeScript strict pass.
- `bun test src` — 17 pass / 0 fail (session, workspace, workbench timeline/trim/time).
- `bunx playwright test --list` — 17 specs across e2e + visual + a11y.
- `docker compose config --services` — 5 services including `frontend-next`.
- `terraform validate` — Success.
- `docker compose run --rm pre-commit run addlicense` — Passed.

## Known gaps / TODO
1. **Backend contract**: `GET /api/workspaces/{id}` returns 404 (BFF proxy exists, no FastAPI endpoint). Backend lane to add or remove proxy.
2. **Backend contract**: Video edit/extend have no dedicated endpoints; BFF reuses `/generate-videos` with mode flags.
3. **Backend contract**: OpenAPI 4xx/5xx schemas sparse (only HTTPValidationError). Generated types may miss error shapes.
4. **Backend contract**: Admin media-gallery path `/api/media-items` unverified (used `/api/media-items` with `include_deleted`).
5. **Auth local**: GIS OIDC login cannot JIT-provision against local Firebase Admin verifier. Needs backend local-verifier change OR local token setup for dev.
6. **Phase 7 cutover** (NOT executed — production safety):
   - Add Secret Manager secrets (AUTH_SESSION_SECRET, GOOGLE_CLIENT_ID, etc.).
   - Apply Terraform (Cloud Run Next service).
   - Cloud Build trigger test.
   - Firebase Hosting rewrites → Cloud Run (canary path).
   - DNS/traffic shift, monitor, rollback window.
   - Delete Angular only after parity sign-off + stable prod period.
7. **E2E tests**: Specs written but need dev server + mocked session helper to run live.
8. **Feature flags**: Phase 0.4 (traffic split/rollback) not yet defined in code.

## Architecture decisions
- Server Components for shells + initial data reads; Client Components for studios/editors/uploaders/players/polling.
- BFF Route Handlers forward authenticated calls with server session's `idToken`. Browser never holds bearer token.
- URL search params for shareable state (filters, pagination, workspace, template hydration). localStorage for studio form persistence only.
- Native primitives (dialog element, audio/video, canvas crop) over heavy libs. No react-query, no radix, no headless-ui.
- `output: "standalone"` + Node 20 alpine runtime on Cloud Run.
