# Provider-neutral video generation plan
## Decision (CORRECTED — see Wave 3, supersedes original "Replicate Seedance" framing below)
- Build provider/model registry, not Seedance-specific controller.
- Preserve `/api/videos/generate-videos` and `MediaItem` lifecycle. Request selects stable internal `model_key`; backend resolves enabled model/provider and adapter.
- **ACTUAL first external adapter: direct BytePlus ModelArk (Ark) API**, not Replicate. `.env` already has `ARK_API_KEY`/`ARK_API_BASE_URL=https://ark.byteplusapi.com/api/v3`. No Replicate account/dependency involved. Replicate section below is historical/wrong, kept only for context — do not implement it.
## Minimal domain
- `ai_providers`: id/key/display_name/type/enabled/secret_ref/base_url/timeout/created/updated. `secret_ref` names Secret Manager secret; no secret value in DB/API/UI.
- `ai_models`: internal key/provider_id/vendor_model_id/media_type/display_name/enabled/capabilities JSON/defaults JSON/cost metadata/environment/priority.
- `provider_jobs`: media_item_id/provider/model/provider_job_id/status/request metadata safe subset/provider metrics/error timestamps. Never store auth headers/secrets.
- Existing media item gains provider key, model key/version, provider job ID or relation for audit/reproduction; retain legacy `model` compatibility during transition.
## Stable adapter contract
- `capabilities(model) -> VideoCapabilities`
- `submit(VideoGenerationRequest, ModelConfig) -> ProviderJob`
- `status(provider_job_id) -> ProviderJobStatus`
- `cancel(provider_job_id)`
- `collect(provider_job) -> list[ProviderOutput]`
- Normalize provider states to processing/completed/failed/stopped. Adapter maps only supported inputs; capability validation rejects unsupported combinations before billing.
## Capabilities
- Text-to-video, image-to-video, first/last frame, reference images, video extension, audio generation, aspect ratios, resolutions, durations, output count, seed, negative prompt, max inputs/file constraints.
- Frontend requests `/api/generation-options/video` and renders controls from capabilities; no vendor/model hardcoding.
## Replicate Seedance adapter
1. Server reads API token from Secret Manager.
2. Upload/provide provider-supported input URLs; avoid leaking long-lived GCS access. Use short signed URLs or controlled copy.
3. Create async prediction for pinned official model/version; set `Cancel-After` budget.
4. Store prediction ID immediately, then poll provider from backend worker or receive verified webhook.
5. On success, download output before provider retention expiry, validate MIME/size, store in owned GCS, generate thumbnail, update media item.
6. On failure/cancel/timeout, sanitize provider error and update terminal state.
7. Add idempotency around callback/poll completion and output ingestion.
## Admin feature
- `/admin/ai-providers`: list provider health/enabled state; create/update metadata and Secret Manager reference; test connection server-side; disable provider.
- `/admin/ai-models`: add/edit model mapping, capabilities/defaults, environment, priority, enabled state; clone config; validation preview.
- Never allow arbitrary Python class/import, arbitrary webhook URL, arbitrary outbound base URL in normal admin form. Provider types remain code allowlist to prevent SSRF/RCE. Admin adds instances/models for supported adapters, not executable providers.
- Show secret presence/version, never secret value. Secret creation/rotation remains privileged GCP Secret Manager workflow unless narrowly scoped server endpoint is separately approved/audited.
## Routing/fallback
- User selects model by key. Optional policy chooses preferred enabled model for requested capabilities.
- Do not auto-fallback after provider accepted billable job; risk duplicate charges/results. Fallback only before submission or on explicit known non-billable rejection.
- Circuit breaker/provider health can disable new jobs; existing jobs continue status collection.
## Rollout
0. Contract tests/golden Veo requests; DB migration with legacy compatibility.
1. Registry seeded with current Veo/Gemini models; wrap existing Veo code in adapter without behavior change.
2. Capability endpoint drives Next video UI.
3. Admin provider/model management with audit logging and role checks.
4. Add Replicate Seedance behind feature flag and workspace/admin allowlist.
5. Shadow validation, then limited quota/cost cap, then wider rollout.
6. Add second provider adapter after operational data proves need.
## Tests/security
- Adapter conformance suite; mocked submit/status/cancel/output; webhook signature/replay/idempotency; timeouts/rate limits; MIME/size/url validation; workspace authorization; disabled model/provider; secret redaction.
- E2E each capability path; failure/cancel; output copied to GCS; cost/quota observability.
- Egress allowlist, Secret Manager IAM least privilege, webhook secret/signature, no private-network URL fetch, maximum download size/time.
## Parallel lanes
- Lane A registry schema/repositories/migrations. ✅ DONE (rev d4a1e9b8c2f3)
- Lane B adapter contract + current Veo adapter. ✅ DONE (VeoAdapter thin wrapper, ponytail TODOs for real submit/cancel wiring)
- Lane C capability API + Next dynamic model UI after contract freezes. ✅ BACKEND DONE (`/api/options/video-generation` + `CapabilityService`). ✅ ANGULAR DONE (`GenerationOptionsService` + `VideoComponent` rewired to capability signals). Next.js deferred (migration in progress).
- Lane D admin providers/models UI/API after schema freezes. ✅ BACKEND DONE (`/api/admin/ai-providers` + `/api/admin/ai-models` CRUD). ✅ ANGULAR DONE (feature-flagged off via `FeatureFlagsService.aiProviderRegistryAdmin=false`).
- Lane E Replicate Seedance adapter after contract and secret plumbing. ⏳ NOT STARTED. Contract + secret redaction + conformance suite ready.
- Lane F conformance/security/contract tests. ✅ DONE (`tests/ai_providers/test_conformance.py` + `test_security.py`; 1 skip for redaction helper future wave).
Merge: A -> B -> C/D/F in parallel -> E -> rollout. Shared adapter/schema files owned by A/B only.

## Wave 2 additions
- Alembic `f1a2b3c4d5e6_normalize_video_resolution_keys`: maps JSONB `capabilities.resolutions` and `defaults.resolution` from provider literals (`720p`/`1080p`/`4k`) to user-facing wire aliases (`1K`/`2K`/`4K`) matching `CreateVeoDto.resolution`. Expanded per-model resolution lists mirror `CreateVeoDto.validate_cross_fields`.
- Validation gates: backend 422 tests pass + 1 skip; alembic head `f1a2b3c4d5e6`; frontend `npm run compile` passes strict tsc; addlicense + black pass; pre-commit `gts-fix` hook broken in pre-commit container (eslint ENOENT) — lint via `docker compose exec frontend npx eslint` instead; pre-existing eslint HTML parser noise (`Unexpected token 2025` on license headers) is baseline, not introduced by this wave.
- `ponytail:` TODOs left: Secret Manager version lookup, SSRF hardening for `base_url`, real provider connection test, request_metadata credential redaction helper, Veo 3.0 source-input vendor branches in video.component.ts.

- Lane A registry schema/repositories/migrations.
- Lane B adapter contract + current Veo adapter.
- Lane C capability API + Next dynamic model UI after contract freezes.
- Lane D admin providers/models UI/API after schema freezes.
- Lane E Replicate Seedance adapter after contract and secret plumbing.
- Lane F conformance/security/contract tests.
Merge: A -> B -> C/D/F in parallel -> E -> rollout. Shared adapter/schema files owned by A/B only.

## Wave 3 — ARK (BytePlus ModelArk) adapter, confirmed contract + plan

### Confirmed API contract (Context7 `/websites/byteplus_en_modelark`, verified)
Base: `ARK_API_BASE_URL` (`.env`: `https://ark.byteplusapi.com/api/v3`), key `ARK_API_KEY` (`.env` already set). Use `httpx` directly (already a backend dep) — do NOT add `byteplus-python-sdk-v2`/`byteplussdkarkruntime`.

**Create task** `POST {base}/contents/generations/tasks`, header `Authorization: Bearer {key}`.
Body:
```json
{"model":"seedance-1-0-pro-250528","content":[{"type":"text","text":"prompt"},{"type":"image_url","image_url":{"url":"https://..."}}],"generate_audio":true,"ratio":"16:9","duration":5,"watermark":false,"resolution":"720p","return_last_frame":true,"service_tier":"default"}
```
- text-to-video: only text content item. image-to-video: add `image_url` content item (no role needed for simple i2v).
- resolutions: `480p,720p,1080p,4k`. ratios: `16:9,4:3,1:1,3:4,9:16,21:9,adaptive`.
- Response: `{"id":"cgt-..."}` only.

**Get status** `GET {base}/contents/generations/tasks/{id}`. Response: `{id, model, status: queued|running|succeeded|failed, content:{video_url, last_frame_url}, error:{code,message}, resolution, ratio, duration, ...}`. `video_url` is plain HTTPS (volces.com TOS), NOT gs://. Expires after `execution_expires_after` secs (e.g. 172800=48h) — download promptly.

**Cancel/delete** `DELETE {base}/contents/generations/tasks/{id}` — 200, empty body.

### Design decisions
- `ArkAdapter` implements existing `VideoProviderAdapter` protocol (`contract.py`) via httpx. submit() posts create-task, stores Ark task id as `provider_job_id`. status() polls get-task, maps `queued/running`→PROCESSING, `succeeded`→COMPLETED, `failed`→FAILED via `normalize_state()`. cancel() calls DELETE. collect() downloads `content.video_url` via `httpx.get()` then `gcs_service.upload_bytes_to_gcs()` (existing helper) — mirrors Veo thumbnail upload pattern, no new GCS helper needed.
- Pick ONE vendor_model_id to support first: `seedance-1-0-pro-250528` (top-level fields style, not embedded `--flag` text commands).
- Minimal-diff integration into legacy `/api/videos/generate-videos` path: **do NOT refactor Veo's non-registry worker**. Instead branch inside `_process_video_in_background` (veo_service.py, currently branches on GEMINI_OMNI at L353-358, `else` Vertex branch L753+): add new `elif` branch when resolved model's provider_type == ARK, calling `ArkAdapter` directly (submit + poll loop + collect), writing to `media_repo.update()` same shape as existing paths (`gcs_uris`, `thumbnail_uris` — thumbnail can reuse `generate_thumbnail()` on downloaded video same as Veo path). Need model→provider lookup by `request_dto.generation_model` key via `AiModelRepository`/`AiProviderRepository` inside worker (new small helper, worker currently has no such lookup).
- `ProviderRegistryService.register()` has ZERO call sites anywhere (confirmed). Still wire `ArkAdapter` through it in `main.py` lifespan for future-correctness/testability even though worker calls it more directly for v1 — OR skip registry wiring entirely for v1 and just instantiate `ArkAdapter()` directly in worker (simpler, fewer moving parts, consistent with "shortest diff" rule; registry wiring is a Lane E2 follow-up, not required for first working path). **Recommendation: skip full registry wiring for v1, instantiate ArkAdapter directly in worker.** Document as ponytail: registry integration deferred.
- `GenerationModelEnum` (`backend/src/common/base_dto.py`) is a closed enum — add e.g. `ARK_SEEDANCE_1_0_PRO = "seedance-1-0-pro-250528"`. `CreateVeoDto.validate_video_generation_model` (`create_veo_dto.py` ~L266) has explicit allowlist — add new enum member there too, or the request gets rejected at validation before reaching worker.
- `ConfigService` needs `ARK_API_KEY: str = ""` and `ARK_API_BASE_URL: str = "https://ark.byteplusapi.com/api/v3"` fields added (currently `.env` vars are inert, `extra="ignore"` swallows them).
- `ProviderTypeEnum` (`constants.py`) needs `ARK = "ARK"` member.
- Bootstrap (`bootstrap.py::seed_ai_models`) needs new `ark` provider row + Seedance model row with capabilities (resolutions 480p/720p/1080p/4k, ratios per above, durations model-specific e.g. [5,10], generate_audio true) + defaults (resolution 720p, ratio 16:9, duration 5).

### Task split for sub-agents (disjoint write scopes, use this memory to hand off context)
- **Agent A (contract/constants/config)**: `constants.py` add `ProviderTypeEnum.ARK`; `config_service.py` add `ARK_API_KEY`/`ARK_API_BASE_URL` fields; `base_dto.py` add `GenerationModelEnum.ARK_SEEDANCE_1_0_PRO`; `create_veo_dto.py` add to `validate_video_generation_model` allowlist (do NOT touch resolution/reference-role validators unless needed for Ark — Ark doesn't use those DTO fields for v1, prompt+resolution+duration+aspect_ratio only).
- **Agent B (adapter)**: new `backend/src/ai_providers/adapters/ark_adapter.py` — `ArkAdapter` class, httpx-based, implements `capabilities/submit/status/cancel/collect` per contract above. Must not log/leak `ARK_API_KEY`. Unit tests mocking httpx (success/fail/timeout) in `backend/tests/ai_providers/test_ark_adapter.py`, extend conformance suite pattern from `test_conformance.py`.
- **Agent C (worker wiring)**: `veo_service.py::_process_video_in_background` — add ARK branch (model lookup via `AiModelRepository`/`AiProviderRepository` by `generation_model` key, call `ArkAdapter` directly, poll, download via httpx+GcsService, update media_repo). Also `bootstrap.py::seed_ai_models` — seed `ark` provider + model row.
- **Agent D (tests/validation)**: run `docker compose exec backend uv run pytest tests -v --cov=src --cov-fail-under=80`, fix any coverage/failures from A/B/C's changes, run pre-commit/lint per `csp/GEMINI.md`. Do NOT commit. Report final pass/fail status only.

### Pitfalls carried over
- Different Seedance generations have different request shapes — target `seedance-1-0-pro-250528` top-level-fields style only for v1.
- `video_url` expires in 48h — collect promptly, no long delay between succeeded status and download.
- Legacy `CreateVeoDto` allowlist is the actual gate — options API listing an Ark model alone does NOT make it submittable.

### Wave 3 status: ✅ DONE (backend implementation, text-to-video only)
- Agent A: `ProviderTypeEnum.ARK`, `config_service.ARK_API_KEY`/`ARK_API_BASE_URL`, `GenerationModelEnum.ARK_SEEDANCE_1_0_PRO`, `CreateVeoDto` allowlist — all landed.
- Agent B: `backend/src/ai_providers/adapters/ark_adapter.py` (`ArkAdapter`, httpx-based, full `VideoProviderAdapter` protocol) + `backend/tests/ai_providers/test_ark_adapter.py` (19 tests) — landed, 1 test fixed post-hoc (call_args positional arg mismatch, not kwarg `url`).
- Agent C: `veo_service.py::_process_video_in_background` new `elif` branch for `ARK_SEEDANCE_1_0_PRO` (submit/poll/collect via `ArkAdapter`, reuses Vertex-branch thumbnail download/upload pattern) + `bootstrap.py::seed_ai_models` seeds `ark` provider + `seedance-1-0-pro-250528` model row. Registry (`ProviderRegistryService.register()`) intentionally NOT wired — adapter called directly from worker per "shortest diff" decision; still zero registry call sites in codebase (Veo included), documented as deferred, not a regression.
- **Known v1 limitation (ponytail)**: image-to-video NOT wired for Ark — `input_image_uri` hardcoded `None` in worker branch, because `start_image_for_api` holds a `gs://` URI and Ark requires a fetchable HTTPS URL (needs signed-URL generation, deferred). Text-to-video only works end-to-end for now.
- Validation: `docker compose exec backend uv run pytest tests -q --cov=src --cov-fail-under=80` → 441 passed, 1 skipped, 83.56% coverage. `black` reformatted 3 new/touched files (now clean). `ruff check` shows only pre-existing baseline noise (E402 import-order in bootstrap.py header, unused `google.genai.Client` import in veo_service.py) — confirmed via `git stash` diff that this baseline noise predates this wave, not introduced by it.
- NOT done: frontend verification that Ark model renders in `/video` UI once seeded (should work automatically per capability-driven `GenerationOptionsService`, not manually tested this wave); registry wiring in `main.py` lifespan (deferred, no call sites exist for any provider including Veo); image-to-video signed-URL support for Ark.
- NOT committed (per project rule) — changes left in working tree for user review.

### Wave 4 — Fixed: Ark model missing from `/video` UI list (ROOT CAUSE + FIX, DONE)
**Symptom**: user reported no Seedance/Ark model in video generation model list in running app.
**Investigation**: queried DB directly (`docker compose exec postgres psql -U studio_user -d creative_studio`, note actual creds are `DB_USER=studio_user`/`DB_PASS=studio_pass`, NOT `postgres` — differs from earlier assumption in this memory). Found `ai_providers`/`ai_models` had ONLY `google_veo` rows — Ark rows never seeded (bootstrap hadn't been re-run since code landed, as suspected).
**Real root cause (not what was originally guessed)**: re-running bootstrap (`docker exec -t creative-studio-backend sh -c "PYTHONPATH=/app uv run python -m bootstrap.bootstrap"`) failed with `UniqueViolationError: duplicate key value violates unique constraint "ai_providers_pkey" DETAIL: Key (id)=(1) already exists`. The `ai_providers`/`ai_models` Postgres identity/serial sequences were desynced from actual row data (existing `google_veo` row occupies id=1, but sequence `nextval` also returned 1) — likely because that row was inserted via a migration with an explicit id rather than through the sequence. Bootstrap's idempotent `get_by_key('ark')` check correctly found no row and attempted INSERT, but INSERT itself collided on the stale sequence, aborting seeding entirely before Ark rows landed.
**Environment/enabled-flag theories from Wave 3 write-up were WRONG/moot** — Veo rows are `environment=PRODUCTION` and DO show up locally, confirming `CapabilityService.get_video_options()` has no environment filter blocking this; `enabled` defaults true correctly. Not the cause.
**Fix applied** (data-only, no code changes):
```sql
SELECT setval(pg_get_serial_sequence('ai_providers','id'), COALESCE((SELECT MAX(id) FROM ai_providers), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('ai_models','id'), COALESCE((SELECT MAX(id) FROM ai_models), 0) + 1, false);
```
Then re-ran bootstrap successfully — `ark` provider row (id=2, enabled=true) + `seedance-1-0-pro-250528` model row (provider_id=2, enabled=true) inserted.
**Verified fixed**: `curl http://localhost:9000/api/options/video-generation` (public endpoint, no auth, host port 9000→container 8080) now returns `seedance-1-0-pro-250528` as `defaultModelKey` (priority 100, alphabetically/priority-sorted ahead of Veo/Omni models) with correct capabilities (textToVideo+imageToVideo, durations [5,10], resolutions 480p/720p/1080p/4k, aspectRatios incl 21:9) and defaults (720p/16:9/5s). Frontend `GenerationOptionsService` reads this endpoint dynamically with zero hardcoded model list (confirmed prior session) — no frontend code change needed, browser reload/refetch will show it.
**Follow-up note for future waves**: if any other new `ai_providers`/`ai_models` rows are seeded manually or via new migrations that set explicit `id` values, re-check/reset the serial sequence afterward to avoid repeat of this exact failure mode.

### Wave 5 — Add remaining Seedance model variants (plan, confirmed via Context7 `/websites/byteplus_en_modelark`)
**No live model-list API usable** (confirmed again) — ModelArk `ListFoundationModelVersions` needs AK/SK HMAC auth, not present in `.env` (only inference `ARK_API_KEY`). Model IDs/capabilities seeded from docs manually, same as Wave 3. This is intentional, not a gap.

**Confirmed full Seedance catalog + capabilities** (sources: ModelArk/1330310, /2298881, /1366799, /1544106, /2291680):

| Model key (enum + vendor_model_id) | display_name | resolutions | durations | image_to_video | audio |
|---|---|---|---|---|---|
| `seedance-1-0-pro-250528` | Seedance 1.0 Pro | 480p,720p,1080p | [5,10] (2-12s range, keep existing 5/10 discrete like Wave 3) | first+last, first | not set (existing, unchanged) |
| `seedance-1-0-pro-fast-251015` | Seedance 1.0 Pro Fast | 480p,720p,1080p *(inherited from 1.0 Pro — docs confirm i2v-first-frame-only + faster/cheaper but do NOT separately tabulate resolution/duration; documented assumption, not fabricated)* | [5,10] *(inherited assumption, same caveat)* | first frame only | false |
| `seedance-1-5-pro-251215` | Seedance 1.5 Pro | 480p,720p,1080p | [5,10] (4-12s range) | first+last, first | true |
| `dreamina-seedance-2-0-260128` | Dreamina Seedance 2.0 | 480p,720p,1080p,4k | [5,10] (4-15s range) | first+last, first | true |
| `dreamina-seedance-2-0-fast-260128` | Dreamina Seedance 2.0 Fast | 480p,720p | [5,10] (4-15s range) | first+last, first | true |
| `dreamina-seedance-2-0-mini-260615` | Dreamina Seedance 2.0 Mini | 480p,720p | [5,10] (4-15s range) | first+last, first | true |

All models: `text_to_video: true`, `aspect_ratios` same set as existing Ark capabilities block (`16:9,4:3,1:1,3:4,9:16,21:9`), `max_outputs: 1`, `defaults` = `{duration_seconds:5, aspect_ratio:"16:9", resolution:"720p"}` (720p valid default for all, incl 480p/720p-only models).

**Worker branch generalization decision**: current `veo_service.py` L756-758 checks `request_dto.generation_model == GenerationModelEnum.ARK_SEEDANCE_1_0_PRO` (single-model equality). Chose: define a module-level `frozenset` of all Ark enum members (e.g. `ARK_SEEDANCE_MODELS = frozenset({GenerationModelEnum.ARK_SEEDANCE_1_0_PRO, GenerationModelEnum.ARK_SEEDANCE_1_0_PRO_FAST, ...})`) near top of file or right above `_process_video_in_background`, change branch condition to `request_dto.generation_model in ARK_SEEDANCE_MODELS`. Rejected DB provider_type lookup alternative — adds async repo call + more code for equivalent behavior, violates shortest-diff rule since all Ark models share identical submit/poll/collect logic already (only `vendor_model_id`, i.e. `request_dto.generation_model.value`, varies, and that already flows through unchanged).

**Files touched (disjoint sub-agent split)**:
- Agent 1: `backend/src/common/base_dto.py` (5 new `GenerationModelEnum` members), `backend/src/videos/dto/create_veo_dto.py` (extend allowlist same list), `backend/src/videos/veo_service.py` (add frozenset constant + generalize branch condition, no other logic changes).
- Agent 2: `backend/bootstrap/bootstrap.py::seed_ai_models` — add 5 more `ark_capabilities`/`ark_defaults`-shaped dict literals (inline, not shared var, to keep per-model values independent) + 5 more `if not await model_repo.get_by_key(...)` + `model_repo.create(AiModelModel(...))` blocks, mirroring existing `ARK_SEEDANCE_1_0_PRO` block exactly.

**Post-implementation steps**: done, see status below.

### Wave 5 status: ✅ DONE
- Enum/`base_dto.py`, `create_veo_dto.py` allowlist, `veo_service.py` `ARK_SEEDANCE_MODELS` frozenset + generalized `elif ... in ARK_SEEDANCE_MODELS` branch — all landed exactly per plan, verified by direct read after sub-agent report.
- `bootstrap.py::seed_ai_models` — 5 new capability/defaults blocks + create calls landed at L567-710, existing 1.0 Pro block (538-565) untouched, `ark_provider` reused correctly.
- Bootstrap re-run: exit 0, no sequence-desync this time (unrelated pre-existing `ensure_admin_user_exists` failure due to placeholder `<YOUR_ADMIN_USER>` env value in this dev environment — not caused by this wave, doesn't block AI model seeding step which runs independently after).
- DB verified via `docker compose exec -T postgres psql -U studio_user -d creative_studio`: `ai_providers` has `ark` (id=2, enabled=t); `ai_models` has all 6 Ark model rows (`seedance-1-0-pro-250528`, `seedance-1-0-pro-fast-251015`, `seedance-1-5-pro-251215`, `dreamina-seedance-2-0-260128`, `dreamina-seedance-2-0-fast-260128`, `dreamina-seedance-2-0-mini-260615`), all enabled=t, provider_id=2.
- API verified: `curl http://localhost:9000/api/options/video-generation` returns all 6 models with correct distinct per-model capabilities (Dreamina 2.0 has 4k, Fast/Mini variants capped at 480p/720p, others 480p/720p/1080p) — matches seeded data exactly.
- Tests: container had no `pytest` installed (`uv sync --extra dev` needed first — dev deps not in default install). After `docker exec creative-studio-backend sh -c "PYTHONPATH=/app uv sync --extra dev"`, ran `docker exec creative-studio-backend sh -c "PYTHONPATH=/app uv run pytest tests -q --cov=src --cov-fail-under=80"` → **441 passed, 1 skipped, 83.59% coverage** (no new tests needed — `ArkAdapter` already model-agnostic via `vendor_model_id`, worker branch logic body unchanged, only the branch condition generalized).
- `black` reformatted `veo_service.py` (cosmetic only, confirmed via git diff — only touched the new frozenset/branch-condition lines we added, no unrelated reformatting).
- `ruff check` — same pre-existing baseline noise as Wave 3 (bootstrap.py E402 import-order from `setup_logging()` call before imports; unused `google.genai.Client` import in veo_service.py) — confirmed unrelated to this wave's changes, not newly introduced.
- **Command note**: this project's container name is `creative-studio-backend`; `docker compose exec backend ...` (service name) works for some commands but the working pytest/uv invocations in this session used `docker exec -t creative-studio-backend sh -c "PYTHONPATH=/app uv run ..."` directly — use that form if `docker compose exec` errors with TTY/stdin issues, and remember `uv sync --extra dev` may be needed first if pytest/black/ruff aren't already installed in a given container instance.
- NOT done (unchanged from Wave 3, still deferred, not a regression): image-to-video support for any Ark model (all 6 share the same `input_image_uri=None` limitation), registry wiring in `main.py` lifespan.
- NOT committed (project rule) — all changes left in working tree for user review.