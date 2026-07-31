# Angular → Next.js parity matrix

Source read: Angular routes, components/services, env, visible specs; `mem:migration_nextjs/feature_catalog`, `mem:frontend/core`, `mem:migration_nextjs/plan`, `mem:migration_nextjs/target_architecture`.

## Route inventory

`environment.backendURL`: dev `/api`; production placeholder or `http://localhost:8080/api`. Shape also has Firebase config, `isLocal`, `GOOGLE_CLIENT_ID`, `EMAIL_REGEX`, `ADMIN`. Build SSR/prerender on; dev SSR/prerender off. Auth interceptor sends raw Firebase token. Do not copy web-storage auth into Next.

| Angular route | Component | Primary service(s) | Backend endpoints called | State persistence | Auth/role guard | Next.js target route |
|---|---|---|---|---|---|---|
| `/login` | `LoginComponent` | `AuthService`, common `UserService` | auth/user bootstrap through `AuthService` | `FIREBASE_SESSION_KEY`, `USER_DETAILS` localStorage | none | `/(public)/login` |
| `/` | `HomeComponent` | `SearchService`, `ImageStateService`, source assets/gallery/workspace/brand | `POST /images/generate-images`; `GET /gallery/item/:id`; `POST /gemini/rewrite-prompt`; `POST /gemini/random-prompt`; gallery/source-asset calls | `image_state`; in-memory active job; router `state` | `AuthGuardService` | `/(studio)/` |
| `/video` | `VideoComponent` | `SearchService`, `VideoStateService`, source assets/workspace/brand | `POST /videos/generate-videos`; `POST /videos/concatenate`; `GET /gallery/item/:id`; Gemini prompt endpoints; upload calls | `video_state` excludes reference files; active job; `history.state.remixState` | `AuthGuardService` | `/(studio)/video` |
| `/vto` | `VtoComponent` | `SearchService`, `VtoStateService`, source assets/gallery/workspace | `POST /images/generate-images-for-vto`; `GET /gallery/item/:id`; source-asset search/upload | root singleton only; selected model/garments; active job | `AuthGuardService` | `/(studio)/vto` |
| `/audio` | `AudioComponent` | `SearchService`, `AudioStateService`, workspace | `POST /audios/generate`; `GET /gallery/item/:id`; media delete; voice endpoints used by dialog | `audio_generation_state`; active job | `AuthGuardService` | `/(studio)/audio` |
| `/imagen-upscale` | `UpscaleComponent` | `SourceAssetService` | `POST /images/upload-upscale`; `GET /gallery/item/:id`; `GET /source_assets/:id` | root `activeUpscaleJob`; component selected asset/result | `AuthGuardService` | `/(studio)/imagen-upscale` |
| `/gallery` | `MediaGalleryComponent` | `GalleryService`, tags/workspace | `POST /gallery/search`; `POST /gallery/bulk-delete`; `/bulk-download`; `/bulk-copy`; tags bulk assign | service cache/selection; `gallery_features_hint_seen`; workspace state | **no route guard** | `/(studio)/gallery` |
| `/gallery/:id` | `MediaDetailComponent` | `GalleryService`, workspace | `GET /gallery/item/:id`; media delete; `POST /media-templates/from-media-item/:id` | router `state` carries remix/navigation payload | `AuthGuardService` | `/(studio)/gallery/[id]` |
| `/asset-detail/:id` | `MediaDetailComponent` | `GalleryService` | `GET /source_assets/:id` | same | `AuthGuardService` | `/(studio)/asset-detail/[id]` or normalize to gallery detail |
| `/fun-templates` | `FunTemplatesComponent` | `MediaTemplatesService` | `GET /media-templates?limit=30` | component filters; navigation extras hydrate studio | `AuthGuardService` | `/(studio)/fun-templates` |
| `/workbench` | `WorkbenchComponent` | `WorkbenchService` | `POST /workbench/render` binary blob | component timeline/player state | `AuthGuardService` | `/(studio)/workbench` |
| `/workflows` | `WorkflowListComponent` | `WorkflowService` | `POST /workflows/search`; `DELETE /workflows/:id` | root service list/loading subscriptions | `AuthGuardService`; `WORKFLOWS` or `ADMIN` | `/(studio)/workflows` |
| `/workflows/new` | `WorkflowEditorComponent` | workflow/form/media-resolution services | `POST /workflows`; execution calls after save | form-service singleton; route state return URL | same parent guard | `/(studio)/workflows/new` |
| `/workflows/edit/:workflowId` | `WorkflowEditorComponent` | same | `GET/PUT /workflows/:id`; `POST /workflows/:id/workflow-execute`; `POST .../batch-execute`; execution GET | same | same parent guard | `/(studio)/workflows/[workflowId]/edit` |
| `/workflows/:id/executions` | `ExecutionHistoryComponent` | `WorkflowService`, execution polling | `GET /workflows/:id`; `GET /workflows/:id/executions`; execution detail GET; execute POST | poll subscription/component state | same parent guard | `/(studio)/workflows/[workflowId]/executions` |
| `/admin/dashboard` | `AdminHomeComponent` | `AdminDashboardService` | `GET /admin/overview-stats`, `/media-over-time`, `/workspace-stats`, `/active-roles`, `/generation-health`, `/active-users-monthly`; `POST /admin/cleanup-stuck-jobs` | date/component state | lazy `/admin` guarded by `AdminAuthGuard` | `/(admin)/admin/dashboard` |
| `/admin/users` | `UsersManagementComponent` | admin `UserService` | `GET/POST /users`; `GET/PUT/DELETE /users/:id`; `POST /users/:id/restore` | paginator/filter/component state | `AdminAuthGuard` | `/(admin)/admin/users` |
| `/admin/source-assets` | `SourceAssetsManagementComponent` | admin `SourceAssetsService` | `POST /source_assets/search`; `POST /source_assets`, `/upload`; `PUT/DELETE /source_assets/:id` | table/filter/component state | `AdminAuthGuard` | `/(admin)/admin/source-assets` |
| `/admin/media-templates` | `MediaTemplatesManagementComponent` | `MediaTemplatesService` | `GET/POST /media-templates`; `PUT/DELETE /media-templates/:id` | table/component state | `AdminAuthGuard` | `/(admin)/admin/media-templates` |
| `/admin/media-gallery` | `MediaGalleryManagementComponent` | gallery/tags/admin dashboard | gallery search, restore/delete, tag calls, `POST /admin/cleanup-stuck-jobs` | filter/page/component state | `AdminAuthGuard` | `/(admin)/admin/media-gallery` |
| `/admin/tags` | `TagsManagementComponent` | `TagsService`, workspace state | `POST /tags/search`; `POST /tags`; `PUT/DELETE /tags/:id`; `POST /tags/bulk-assign` | current workspace singleton; page state | `AdminAuthGuard` | `/(admin)/admin/tags` |
| workspace switcher (header dialog, no route) | `WorkspaceSwitcherComponent` | workspace/brand/workspace-state | `GET/POST /workspaces`; `POST /workspaces/:id/invites`; brand guideline endpoints | `activeWorkspaceId` localStorage + root singleton; URL `workspaceId` read only | shell-level, backend scope check | shared workspace provider + `workspaceId` search param |

Code truth conflicts: `/gallery` is unguarded. `/admin` redirects to `/admin/dashboard`. No Angular route exists for `/templates/edit/:id`, though `MediaDetailComponent` navigates there after template-from-media. This is broken/orphan route, not parity target until product decides.

## Per-feature journeys

### Login
- Happy: open `/login`; Google/Firebase sign-in; store session and `USER_DETAILS`; navigate `/`; guard admits.
- Error: provider/login failure; loader clears; current UX logs/error path; no retry automation, user retries sign-in.
- Permission: protected route without session redirects `/login`. Expired session guard redirects `/login`.

### Image studio `/`
- Happy: select workspace; set prompt/options/source refs; optional rewrite/random; `POST /images/generate-images`; service holds processing item; poll `GET /gallery/item/:id`; completed thumbnails/result, success snackbar; remix/delete/send-to-video/VTO use router state.
- Error: no workspace gives snackbar; POST/rewrite/random failure snackbar; polling failure logs then stops; failed job snackbar. User submits again manually.
- Permission: unauthenticated redirects `/login`; workspace absent gets inline action-blocking snackbar; backend must reject foreign workspace.

### Video `/video`
- Happy: choose model/mode/options/frames/references; validate compatible input; `POST /videos/generate-videos` or `POST /videos/concatenate`; poll gallery item; completed success snackbar; edit/extend/remix state available.
- Error: unsupported file or incompatible model/input gives snackbar and may switch model/clear conflicting input; POST/upload/prompt failure snackbar; polling failure logs/stops. Manual resubmit.
- Permission: unauthenticated redirects `/login`; missing workspace snackbar; backend scope remains authority.

### VTO `/vto`
- Happy: load assets; choose/upload model and garment(s); validate top/bottom/dress relation; `POST /images/generate-images-for-vto`; poll gallery item; completed snackbar; result can navigate image/video.
- Error: missing garment/workspace, invalid garment pairing, upload/load/generation error gives snackbar; polling failure snackbar/log then stop; manual retry.
- Permission: unauthenticated redirects `/login`; missing workspace blocked locally; foreign asset/media must fail backend scope check.

### Audio `/audio`
- Happy: select model, prompt/text, language/voice; `POST /audios/generate`; poll gallery item; completed snackbar/player; delete calls gallery deletion.
- Error: no workspace snackbar; generation/delete failure snackbar; poll failure logs/stops. Retry submit.
- Permission: unauthenticated redirects `/login`; backend scopes generated media.

### Upscale `/imagen-upscale`
- Happy: upload/select source asset; choose factors; `POST /images/upload-upscale`; poll gallery item; completed preview/download/detail navigation.
- Error: start failure snackbar; failed job overlay plus backend message; poll error logs/stops; select/upload again.
- Permission: unauthenticated redirects `/login`; foreign asset must backend-deny.

### Gallery `/gallery` and detail
- Happy: search/filter media; `POST /gallery/search`; select items; bulk delete/download/copy/tags; detail reads item/asset; detail can remix/edit/send or restore/delete.
- Error: bulk copy failure snackbar; other mutation failures often only console or loading reset; detail fetch/create-template/delete snackbar. Retry by rerunning action.
- Permission: **unauthenticated `/gallery` currently allowed by router**; detail redirects `/login`; admin-only deleted/restore behavior relies backend/admin UI. Workspace mismatch must backend-deny.

### Fun templates `/fun-templates`
- Happy: fetch templates; filter industry/model/search; select template; router navigation extras hydrate image/video form.
- Error: template fetch only logs and clears loading; retry requires reload/filter action.
- Permission: unauthenticated redirects `/login`; public template access/backend semantics need contract check; workspace scope applies after hydration.

### Workbench `/workbench`
- Happy: arrange/trim/split timeline; render; `POST /workbench/render`; receive blob; browser downloads/plays result.
- Error: render/download failure logs and resets downloading; retry render/download. Client timeline validation behavior needs feature test capture.
- Permission: unauthenticated redirects `/login`; input media authorization must backend-check.

### Workflows routes
- Happy: list via search; create/edit ordered steps; save `POST`/`PUT`; run `POST .../workflow-execute` or batch; poll details/list; terminal state toast and history.
- Error: editor/list uses `errorMessage` inline plus snackbars for execution/load; CSV parse failures inline; polling error logs. Retry save/run/load manually.
- Permission: unauthenticated redirects `/login`; missing `WORKFLOWS`/`ADMIN` redirects `/`; backend must enforce workflow/workspace ownership.

### Admin dashboard
- Happy: open date range; issue six analytics GETs; show charts/stats; confirm cleanup then `POST /admin/cleanup-stuck-jobs`.
- Error: chart failures mostly console-only; cleanup error snackbar; retry refresh/cleanup.
- Permission: unauthenticated redirects `/login`; non-admin gets access-denied snackbar, forced logout, then login. Backend still source of truth.

### Admin users
- Happy: filter/page `GET /users`; edit role dialog then `PUT`; confirm soft-delete `DELETE`; restore `POST .../restore`.
- Error: form validation marks fields; service error becomes snackbar; retry dialog action.
- Permission: same admin guard; UI checks current user before unsafe operation, but backend must enforce role.

### Admin source assets
- Happy: search/page; upload multipart; edit dialog `PUT`; confirm delete.
- Error: invalid form blocks close; upload/update/delete errors snackbar; retry dialog action.
- Permission: same admin guard; source scope must backend-enforce.

### Admin media templates
- Happy: list; dialog create `POST` or update `PUT`; confirm delete.
- Error: fetch gives inline `errorLoading`; save errors console-only/TODO snackbar; delete snackbar; retry action.
- Permission: same admin guard; template authorization backend.

### Admin media gallery
- Happy: filter/page all jobs; restore/delete with confirmation; cleanup stuck jobs; tag actions.
- Error: restore/delete/cleanup snackbar; tag load may only console-log; retry action.
- Permission: same admin guard; backend controls deleted and workspace visibility.

### Admin tags
- Happy: read active workspace; search/page; create/edit/delete tags; assign bulk tags.
- Error: load/create/update/delete snackbar; retry form/action.
- Permission: same admin guard; backend ownership/admin validation mandatory.

### Workspace switcher
- Happy: `GET /workspaces`; choose URL `workspaceId` if valid, else `activeWorkspaceId`, else public/first; create `POST /workspaces`; invite `POST /workspaces/:id/invites`; stores selection.
- Error: load/create/invite failures snackbar; retry dialog action. Brand guideline upload/poll errors create failed job state.
- Permission: unauthenticated behavior depends shell auth; selecting inaccessible ID silently falls back if absent from list; backend must deny non-member data access.

## State persistence audit

| Holder/key | Shape and route carry | Next mapping under target rules |
|---|---|---|
| `ImageStateService` / `image_state` localStorage | prompt, negative prompt, aspect/model/lighting/watermark/search/resolution/style/color/count/composition/brand/enhance/mode. Validates model on load. References and results live component/service. Gallery/template/remix uses navigation extras. | Local client form state for draft. Shareable template/remix identifiers in URL search params. Keep unsaved recovery only if explicit product need; no raw media blobs/URLs in storage. |
| `VideoStateService` / `video_state` localStorage | prompt/options/model/mode/audio/reference type. Saves all except `referenceVideo`, `referenceAudio`, `referenceImages`; model validation. `history.state.remixState` carries frames/media context. | Client form state. URL carries source/media IDs, mode, start/end role; scoped React Context only during multi-step editor. Server/session payload only if URL too large or sensitive. |
| `AudioStateService` / `audio_generation_state` localStorage | model/prompt/negative prompt/seed/sample count/language/voice; validates model. | Local component state. Optional draft localStorage only if recovery retained. |
| `VtoStateService` root singleton | stepper index, model type/model, top/bottom/dress/shoes. No browser persistence; survives Angular navigation/service lifetime only. | Scoped React Context around `/vto`, plus URL media/asset IDs for remix/share/navigation. No Context for durable cross-tab data. |
| `SearchService` root singleton | `activeImageJob`, `activeVideoJob`, `activeVtoJob`, `activeAudioJob`; prompt strings; polling subscriptions. Survives route navigation. | Job ID in URL or feature-scoped Context; `useMediaJob(id, interval)` owns cancellation. Query canonical media item on reload. |
| `SourceAssetService` root singleton | `activeUpscaleJob`, source asset pagination/cache. | URL `jobId` or local feature state; generic media-job hook; server fetch for asset by ID. |
| `WorkspaceStateService` + `activeWorkspaceId` localStorage | numeric active ID. Switcher precedence URL query, storage, public/default. Does not write query param on change. | Workspace Context for current shell state; `workspaceId` search param canonical/shareable; session preference only convenience. |
| `BrandGuidelineService` root subjects | cached guideline and active job per current workspace; polling subscription. | Workspace Context/cache; guideline ID/status from FastAPI; job ID URL only if deep link required. |
| `WorkflowService`/form service | workflow list BehaviorSubject/subscriptions; editor form graph and execution state. | Local client editor reducer keyed workflow ID; URL for workflow/execution IDs; do not cross-route singleton-store mutable drafts. |
| Other localStorage | `FIREBASE_SESSION_KEY`, `USER_DETAILS`, `menuFixed`, `gallery_features_hint_seen`, `showTooltip`. | HttpOnly session cookie replaces auth keys. UI preference/hint can stay localStorage. |

Critical carry paths: image result to `/video` or `/vto`; VTO result to `/` or `/video`; gallery detail to image/video/VTO; fun template to image/video; video concatenate via `history.state.remixState`. Angular router state disappears on reload/deep link. Next must encode stable asset/media IDs and intent in typed URL params or short server-side session payload; never persist files in URL/storage.

## Polling audit

| Feature | Start/status endpoint | Cadence | Stop/cancellation |
|---|---|---|---|
| Image | `POST /images/generate-images`; `GET /gallery/item/:id` | first 2s, then 5s | completed/failed or request error. Root service subscription continues across component navigation; no visibility pause. |
| Video | `POST /videos/generate-videos` or `/videos/concatenate`; gallery item GET | first 5s, then 15s | completed/failed/error; root service survives navigation. |
| VTO | `POST /images/generate-images-for-vto`; gallery item GET | first 5s, then 15s | completed/failed/error; explicit `clearActiveVtoJob` stops. |
| Audio | `POST /audios/generate`; gallery item GET | first 5s, then 15s | completed/failed/error; root service survives navigation. |
| Upscale | `POST /images/upload-upscale`; gallery item GET | first 2s, then 5s | completed/failed/error; root source-asset service survives navigation. |
| Brand guideline | finalize flow; `GET /brand-guidelines/:jobId` | immediate, then 30s, max 120 attempts/10min | completed/failed/error/max attempts; singleton service. |
| Workflow list | `GET /workflows/:id/executions` | immediate, then 3s | observable has no terminal status stop; component unsubscribe required. |
| Workflow detail | `GET /workflows/:id/executions/:executionId` | immediate, default 5s | terminal non-`ACTIVE`; component subscription must cancel navigation. |

Next parity: preserve 5s image/upscale and 15s video/VTO/audio initially. Generic hook must abort on unmount/navigation, pause hidden tab, stop terminal status. This improves existing navigation leak but preserves visible behavior.

## Endpoint reconciliation flags

| Angular call | Evidence | Contract lane flag |
|---|---|---|
| `POST ${badgeURL}badge-info` | common `UserService.getUserBadges`; `badgeURL` not normal `/api/users` service path | No visible controller mapping in Angular call sites. Likely stale/orphan; search backend OpenAPI/controllers before Next client generation. |
| `POST ${badgeURL}badge-confetti-status` | common `UserService.updateBadgeInfo` | Same. No route UX found from current scan. Contract lane owns delete/replace decision. |
| `POST /media-templates/from-media-item/:id` | `GalleryService.createTemplateFromMediaItem`, detail success navigates `/templates/edit/:id` | Endpoint exists in Angular client, but destination route does **not** exist. Reconcile controller/OpenAPI and intended admin edit route before parity. |
| `GET /gallery/item/:id` generation polling | `SearchService` comments claim endpoint may need adding, but code uses it everywhere | Confirm current backend contract and terminal status casing. Comments stale; endpoint is central. |

## Service singleton → Next mapping

Target rules applied: URL params for shareable filters/pagination/workspace/media IDs; local component state for forms; Context only auth/workspace/toasts or tightly scoped interactive editor; server session for sensitive/non-URL handoff; FastAPI stays canonical.

- `AuthService`: server session cookie + server layout guard; no Firebase/raw ID token localStorage. Backend auth remains authority.
- `WorkspaceStateService`: shell `WorkspaceProvider`; canonical `?workspaceId=`. Validate membership from `/workspaces` and backend response.
- `ImageStateService`, `VideoStateService`, `AudioStateService`: client feature state. Keep only benign draft recovery; explicit source IDs/intent in search params.
- `VtoStateService`: `/vto` scoped Context/reducer, URL asset/media IDs for navigation boundary.
- `SearchService` active jobs: feature hook/context with job ID route state; generic `useMediaJob`; no app-global mutable generation service.
- `SourceAssetService` active upscale: local upscale hook plus `jobId` search param if result must survive navigation.
- `BrandGuidelineService`: workspace-scoped provider/cache; active job hook with cleanup.
- `WorkflowService`/`WorkflowFormService`: server initial list/read where session allows; client reducer for editor; URL workflow/execution IDs; dedicated execution polling hook.

## Freeze gaps and risks found beyond plan

1. Route protection inconsistent: `/gallery` unguarded while `/gallery/:id` guarded; guards allow SSR shell and depend on localStorage client redirect. Next must choose explicit public gallery policy and server-session behavior.
2. Route integrity broken: detail creates template then navigates missing `/templates/edit/:id`. Do not migrate phantom route; resolve product/backend contract.
3. Error parity uneven: polling errors often only console + silent stop; fun templates/admin dashboard/template save lack consistent user feedback. Freeze expected UX before shared Next error primitives.
4. Generation root singleton polling leaks across navigation and has no hidden-tab pause; cancellation ownership must be explicit.
5. Workspace URL precedence reads `workspaceId` but changing workspace writes only localStorage. Deep-link/share semantics currently unstable; Next should make query canonical.

Coverage: 22 concrete Angular routes (including discovered gallery/asset/workflow children) plus workspace switcher; 48 route/feature journeys listed as happy/error/permission.