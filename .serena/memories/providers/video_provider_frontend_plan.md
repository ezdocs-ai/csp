# Provider-neutral video registry — frontend plan

## Validation
- Confirmed `frontend/src/app/` exists.
- Confirmed video surface: `frontend/src/app/video/video.component.ts` calls `SearchService.startVeoGeneration()` at lines 759-760; service posts generation request at `frontend/src/app/services/search/search.service.ts:157-169`.
- Layout matches Angular feature-module expectations. Not Next UI.

## 1. Frontend root discovery
`frontend/src/app/` top-level dirs:
- `admin/` — lazy-loaded admin feature module, layouts, management screens, guard.
- `audio/` — audio generation surface.
- `common/` — shared models, config, components, pipes, services, module.
- `components/` — app-level reusable UI components.
- `footer/` — footer UI.
- `fun-templates/` — template browsing/use surface.
- `gallery/` — media gallery, detail, gallery service.
- `header/` — header/navigation UI.
- `home/` — image-generation surface.
- `login/` — login UI.
- `services/` — cross-feature state and API services.
- `upscale/` — image-upscale surface.
- `utils/` — UI utilities.
- `video/` — video-generation surface.
- `vto/` — virtual try-on surface.
- `workbench/` — workbench surface.
- `workflows/` — workflow list/editor/execution surfaces.

## 2. Video generation surface
- Component: `frontend/src/app/video/video.component.ts`.
  - Builds `VeoRequest` at lines 709-756.
  - Calls `SearchService.startVeoGeneration(payload)` at lines 759-760.
  - Template passes models/settings to shared prompt UI at `frontend/src/app/video/video.component.html:365-401`.
- API service: `frontend/src/app/services/search/search.service.ts`.
  - `startVeoGeneration(searchRequest: VeoRequest): Observable<MediaItem>` at lines 157-169.
  - POST URL: ``${environment.backendURL}/videos/generate-videos`` at line 158. Environment base likely includes `/api`; requested endpoint resolves as `POST /api/videos/generate-videos`.
  - Job state uses RxJS `BehaviorSubject`, not Angular Signals: `activeVideoJob` lines 58-59; polling lines 190-229.
- Request type: `VeoRequest` in `frontend/src/app/common/models/search.model.ts:62-86`; current selector sends `generationModel: string`, not stable `model_key`.
- Hardcoding: shared literal registry, not enum mirror.
  - `MODEL_CONFIGS` is literal `GenerationModelConfig[]` in `frontend/src/app/common/config/model-config.ts:53+`; video entries lines 224-296 hardcode vendor IDs and capabilities.
  - `VideoComponent` filters it at lines 229-234, defaults to `'gemini-omni-flash-preview'` at lines 136-152 and 230-234.
  - More vendor/model branches remain: `selectModel()` lines 383-413, Veo 3 strings and forced model switching lines 641-674, plus later model-specific branches found by search.
  - Persisted state validates against same literal registry in `frontend/src/app/services/video-state.service.ts:93-100`.

## 3. Generation-options consumer pattern
- No frontend caller for `GET /api/options/image-generation` exists. Exhaustive `frontend/src/app` search for `image-generation`, `/options/`, `generationOptions`, and `GenerationOptions` produced no source match.
- Therefore no service snippet, cache, Angular Signal, or template consumer can be quoted for that endpoint. Current image/video option source is compile-time `MODEL_CONFIGS`, not backend capabilities.
- Closest dynamic-consumer pattern is local component Signals:
  - `frontend/src/app/common/components/flow-prompt-box/flow-prompt-box.component.ts:73-90`: `@Input() generationModels` copies literal config into `generationModelsSignal`; selected model copied into `selectedGenerationModelSignal`.
  - Lines 207-220: local `supportedResolutions` Signal and computed option visibility.
  - Lines 322-346: selected config read from signal, then local capability fields determine resolution/duration options.
  - Parent passes compile-time models at `frontend/src/app/video/video.component.html:365-401`.
- This is input-derived UI state, not HTTP caching. Do not mirror this as server-capability cache without a dedicated service Signal.

## 4. Admin area
- Existing module: `frontend/src/app/admin/admin.module.ts` declares `AdminLayoutComponent`, `AdminHomeComponent`, users, source assets, templates, gallery, tags at lines 62-75.
- Existing child routes: `frontend/src/app/admin/admin-routing.module.ts:27-41`.
  - `/admin` redirects to `/admin/dashboard` at lines 29-33.
  - Existing dashboard route: `/admin/dashboard` uses `AdminHomeComponent` line 33.
  - Existing management routes: `/admin/users`, `/admin/source-assets`, `/admin/media-templates`, `/admin/media-gallery`, `/admin/tags` lines 34-38.
- Navigation entry:
  - Global admin entry in `frontend/src/app/header/header.component.html:259-265`, `routerLink="/admin"`, only rendered when `authService.isUserAdmin()`.
  - Admin side-nav entries in `frontend/src/app/admin/admin-layout/admin-layout.component.html:27-66`; child route outlet lines 70-73.
- Existing admin API service: `frontend/src/app/services/admin/admin-dashboard.service.ts`; dashboard consumes it in `frontend/src/app/admin/admin-home/admin-home.component.ts:36-44, 82-90, 119-145`.

## 5. Routing + guards
- Root router: `frontend/src/app/app-routing.module.ts`.
  - `/video` uses `AuthGuardService` at line 44.
  - `/admin` lazy-loads `AdminModule` and uses `AdminAuthGuard` at lines 75-79.
- Admin guard: `frontend/src/app/admin/admin-auth.guard.ts`.
  - Browser requires authenticated user at lines 65-69.
  - Browser requires `userEmail && authService.isUserAdmin()` at lines 71-75. This is existing ADMIN-role equivalent, but guard checks `AuthService.isUserAdmin()` allowlist/role abstraction rather than route `data.requiredRoles`.
  - SSR deliberately permits shell render at lines 55-63; client checks after hydration.

## 6. Lane C — capability-driven video UI
Minimal files:
- Add `frontend/src/app/common/models/generation-options.model.ts`.
  - Export backend-contract types. Suggested shape:
    ```ts
    export interface VideoModelCapabilities {
      modelKey: string;
      displayName: string;
      modes: string[];
      aspectRatios: string[];
      resolutions: string[];
      durations: number[];
      outputCounts: number[];
      supportsAudio: boolean;
      supportsNegativePrompt: boolean;
      maxReferenceImages: number;
      supportsFirstFrame: boolean;
      supportsLastFrame: boolean;
      supportsReferenceVideo: boolean;
      supportsReferenceAudio: boolean;
      supportsVideoExtension: boolean;
    }
    export interface VideoCapabilities {
      models: VideoModelCapabilities[];
      defaultModelKey: string | null;
    }
    ```
  - Exact JSON field names must freeze with backend contract before coding. Do not copy frontend legacy names if backend returns different names.
- Add `frontend/src/app/services/generation-options.service.ts`.
  - Existing frontend has no generation-options service. Keep HTTP here; never in component.
  - Private writable cache: `private readonly videoCapabilitiesState = signal<VideoCapabilities | null>(null);`.
  - Public read-only accessor signature: `getVideoCapabilities(): Signal<VideoCapabilities | null>`.
  - Add `loadVideoCapabilities(): Observable<VideoCapabilities>` to GET exact backend URL after contract freeze. Prompt names `GET /api/options/video-generation`; plan memory names `/api/generation-options/video`. Resolve mismatch before code; no fallback dual-call.
  - Load once, set Signal on success, preserve null/error state; components read Signal.
- Edit `frontend/src/app/video/video.component.ts`.
  - Inject options service. Load capabilities in `ngOnInit`.
  - Replace `MODEL_CONFIGS.filter(m => m.type === 'VIDEO')`, default literal, explicit Veo/Omni model switches, static `modes`, aspect ratios, output counts, and model capability checks with derived state from loaded `VideoCapabilities` and selected `modelKey`.
  - Keep existing request and polling path. Change request field only when backend accepts stable `model_key`; coordinate contract migration because `VeoRequest.generationModel` is current wire field.
- Edit `frontend/src/app/video/video.component.html`.
  - Bind prompt-box inputs only to derived capability lists. Hide unsupported controls, not vendor names.
- Edit `frontend/src/app/common/components/flow-prompt-box/flow-prompt-box.component.ts` only if needed.
  - Prefer adapting existing `GenerationModelConfig` input shape at video container boundary first. Do not broaden shared prompt box until image/audio migration needs generic backend types.
- Edit `frontend/src/app/services/video-state.service.ts`.
  - Stop validating persisted video model against `MODEL_CONFIGS`; validate after capability load or safely reset unknown model to backend default.
- Tests: edit/add `frontend/src/app/video/video.component.spec.ts`, `frontend/src/app/services/video-state.service.spec.ts`; add `frontend/src/app/services/generation-options.service.spec.ts`.

## 7. Lane D — admin providers/models UI
Backend admin endpoints arrive later. UI feature flag must stay off until endpoints and contract exist. No current frontend feature-flag framework found (`feature flag`, `FEATURE_`, and equivalent source search produced no implementation).

Minimal files/routes:
- Add `frontend/src/app/admin/ai-providers-management/ai-providers-management.component.ts|html|scss|spec.ts`.
- Add `frontend/src/app/admin/ai-models-management/ai-models-management.component.ts|html|scss|spec.ts`.
- Add `frontend/src/app/services/admin/ai-providers.service.ts` for all provider/model HTTP. Define no URLs until backend wave publishes them. Never put `HttpClient` in components.
- Edit `frontend/src/app/admin/admin-routing.module.ts`.
  - Add child routes `ai-providers` and `ai-models` under existing protected `/admin` parent.
  - Existing dashboard route to extend: `/admin/dashboard` (`AdminHomeComponent`, `frontend/src/app/admin/admin-routing.module.ts:33`). Do not replace dashboard; add management navigation/routes beside it.
- Edit `frontend/src/app/admin/admin-layout/admin-layout.component.html`.
  - Add side-nav entries only when injected feature-flag service reports enabled. Current nav owns links at lines 27-66.
- Edit `frontend/src/app/admin/admin.module.ts`.
  - Declare components and add only Angular Material modules actually used.
- Add `frontend/src/app/common/services/feature-flags.service.ts` only if no existing approved feature-flag source arrives with backend. Default `false`; one `aiProviderRegistryAdmin` Signal is enough. Remove/replace local flag when centralized config exists.
- Existing `AdminAuthGuard` already protects parent `/admin`; retain it. UI-only hiding is not authorization; backend must enforce ADMIN independently.

## 8. Open questions / risks
- Plan says “Next dynamic model UI”; repository is Angular 18 NgModule architecture, Angular Material/CDK, RxJS plus limited Signals. Implement Angular plan above, not Next code.
- Endpoint conflict: user task says `GET /api/options/video-generation`; source plan says `/api/generation-options/video`. Freeze one backend route/schema before frontend work.
- Existing image options endpoint has no frontend consumer. No existing service can be extended; add one narrow options service.
- `VideoComponent` injects `HttpClient` directly (`frontend/src/app/video/video.component.ts:221`) despite project rule; Lane C must not add HTTP there. Existing code is out of scope unless refactor needed for capability move.
- `VideoStateService` and `MODEL_CONFIGS` hardcode model validity/defaults. Runtime registry must handle stale localStorage model keys and backend-disabled models.
- Shared `FlowPromptBoxComponent` accepts `GenerationModelConfig` and encodes model capability behavior. Adapt conservatively or it becomes registry coupling.
- Current frontend capability model covers modes/ratios/resolutions/durations/audio; plan additionally needs first/last frame, reference images/video/audio, extension, negative prompt, count, seed, file constraints. Backend response must express all needed controls.
- Existing guard allows SSR admin shell (`admin-auth.guard.ts:55-63`). Backend remains authorization source.
- No feature-flag implementation found. Do not expose admin registry links/routes until flag policy source exists.
