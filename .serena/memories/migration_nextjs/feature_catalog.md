# Feature catalog
## Cross-cutting
- Auth: local uses Firebase popup/ID token; non-local uses Google Identity Services/Identity Platform OIDC. Browser stores raw ID token + expiry and backend user in localStorage; interceptor adds Bearer token. FastAPI verifies token, enforces optional hosted-domain allowlist, JIT-provisions PostgreSQL user, checks roles. Roles include ADMIN, USER, WORKFLOWS. Workspace guard separately scopes resources.
- Workspace: list/create/invite; active workspace precedence is URL `workspaceId`, localStorage, then public/default. Invite sends email. Brand guideline is workspace-scoped.
- Shared media: `media_items` stores generation status, prompt lineage, model/options, GCS/original/thumbnail URIs, source asset/media lineage, type-specific metadata, soft-delete audit. Gallery responses sign GCS URLs.
## User-facing routes/features
- `/`: image studio. Model/mode/prompt and style, lighting, color, composition, aspect, resolution, output count, watermark, negative prompt. Upload/crop/select source/reference media, Gemini rewrite/random prompt, async Imagen generation, 5s polling, remix/edit, send result to video or VTO, delete result. Image settings persist through `ImageStateService`/localStorage.
- `/video`: Veo/Gemini Omni studio. Text-to-video, first/last frame, reference images (asset/style), extension source video, Omni video/audio/image references, model/resolution/duration/output/audio/options. Conflicting reference-vs-frame/video inputs rejected backend. Async generation/concatenation with 15s polling; edit/extend/concatenate follow-ups. State persists locally.
- `/vto`: choose/upload person plus top/bottom/dress/shoes from assets/gallery; backend resolves source links, downloads/optimizes images, applies garments sequentially via recontext API, stores lineage/result; 15s polling. Result can become model, remix input, or video frame.
- `/audio`: Lyria music and Chirp/Gemini/TTS speech modes; model-specific prompt/text, voice/language controls; generation job + polling and custom audio player. Backend handles output storage/status. Transcription endpoint accepts audio upload via Speech API.
- `/imagen-upscale`: upload image or select existing asset, optional crop, choose factor; backend creates processing media item, performs upscale, exposes download/detail, polls status.
- `/gallery`: unified media + source-asset feed; filter by workspace/media/status/date/tags/owner, infinite pagination/cache; signed media thumbnails. Multi/range select, bulk soft-delete, ZIP download, copy to workspace, bulk tag assignment. Admin can include deleted; detail routes expose lineage, prompts/options and remix/edit/video/VTO/template/restore actions.
- `/fun-templates`: fetch/filter public media templates by industry/model/search; template hydrates generation route/state. Detail can create template from media item; admin maintains CRUD template fields/assets/tags.
- `/workbench`: browser timeline editor with video/audio tracks, drag/trim/split/scrub/play/filter; sends timeline to backend. Backend downloads signed/GCS sources, probes media, composes/renders with ffmpeg, streams output blob.
- `/workflows`: role-gated workflow list/search/delete; editor builds ordered typed steps (user input, text/image/edit/video/VTO/audio), fixed/linked/mixed inputs and output references, drag reorder, validation/save/run. Backend persists definition, translates it into Google Workflows YAML calling executor endpoints with propagated auth, creates/updates/deletes matching GCP workflow. Run snapshots definition, supports single and CSV batch execution, lists/polls executions, resolves media outputs, shows detailed per-step history.
## Admin
- `/admin/dashboard`: date-filtered overview, media-over-time, workspace totals, role distribution, generation health, monthly active users; cleanup processing jobs older than one hour.
- `/admin/users`: paged/filter users, roles update, soft-delete/restore; prevent unsafe current-user operations in UI.
- `/admin/source-assets`: search/filter/page, multipart upload, metadata edit, delete; asset upload validates media/aspect, generates thumbnails, stores GCS + DB, returns signed URLs. VTO asset presets split by type.
- `/admin/media-templates`: CRUD forms including model/options, GCS/thumbnail URIs, tags/industry; signed source enrichment.
- `/admin/media-gallery`: filter/page all jobs including deleted, restore/delete, cleanup stuck jobs.
- `/admin/tags`: workspace-scoped search/create/edit/delete and bulk media assignment; ownership/admin checks backend.
## Brand guidelines
- Workspace dialog gets signed upload URL, uploads PDF directly to GCS, finalizes processing. Backend creates processing record, splits large PDF, uploads chunks, Gemini extracts/aggregates tone/visual guidance, updates status; UI polls, caches per-workspace result, replace/delete supported. Prompt enhancement consumes guideline.
## Backend-only executors/platform
- Generation starters create `processing` media item then run long worker via ThreadPoolExecutor/background process pattern; workers own DB sessions, invoke Google GenAI, upload outputs/thumbnails, update completed/failed. Frontend polls generic gallery item.
- Workflows executor normalizes source asset/media inputs, calls domain generators, polls resulting media, returns outputs to Google Workflows.
- GCS service handles bytes/files/streams/delete; IAM signer caches signed read URLs and creates V4 upload URLs.
- PostgreSQL + Alembic persist users/workspaces/media/assets/templates/tags/workflows/runs; unified gallery DB view merges media/assets.
## Tests
- Backend tests exist for every controller/service domain except brand guideline directory not visible in test folder inventory. Frontend specs cover core route features and some shared/admin pieces, but workflows UI coverage is mostly service-only and audio/upscale/admin dashboard/tags lack visible specs.