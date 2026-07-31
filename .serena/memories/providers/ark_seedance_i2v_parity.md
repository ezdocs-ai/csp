# Ark/Seedance ↔ Veo parity (image-to-video)

## Verified live (2026-07-28)

- `ARK_API_BASE_URL=https://ark.byteplusapi.com/api/v3` was **NXDOMAIN**. Fixed in
  `backend/.env` to `https://ark.ap-southeast.bytepluses.com/api/v3`. Requires
  `docker compose up -d --force-recreate --no-deps backend` (plain restart does not reload `.env`).
- `GET /models` now returns 200. All 6 Ark model ids exist and advertise
  `ImageToVideo`: `seedance-1-0-pro-250528`, `seedance-1-0-pro-fast-251015`,
  `seedance-1-5-pro-251215`, `dreamina-seedance-2-0-260128`,
  `dreamina-seedance-2-0-fast-260128`, `dreamina-seedance-2-0-mini-260615`.
- **BLOCKER**: every one returns `404 ModelNotOpen` — account `3003718177` has not
  activated them in the BytePlus Ark Console. User action required; cannot be done
  from the repo. End-to-end generation stays blocked until then.

## Root cause of the UI breakage

Repo convention (migration `f1a2b3c4d5e6`): DB capabilities + wire DTO speak the
user-facing aliases `1K/2K/4K`; the adapter maps to provider literals at submit
time via `VIDEO_RESOLUTION_MAP` (1K→720p, 2K→1080p, 4K→4k).

Ark rows were seeded with raw provider literals (`480p/720p/1080p/4k`), breaking
that convention. Cascading damage: the resolution dropdown hardcodes `1K/2K/4K`
so every Ark resolution renders disabled; `getSelectedModelDurations` collapses to
longest-only unless `selectedResolution() === '1K'`, so Ark never offers `[5, 10]`;
`CreateVeoDto.resolution` had to be widened with provider literals to compensate.

Fix = normalize Ark rows to aliases, not widen the frontend types.

## Plan (3 disjoint waves)

1. **Backend seed/DTO** — bootstrap Ark capabilities use `1K/2K/4K` (drop `480p`,
   no alias exists); `defaults.resolution = "1K"`; new alembic migration to
   normalize existing rows; revert `CreateVeoDto.resolution` to
   `Literal["1K","2K","4K"]` and the Ark branch of `validate_cross_fields` to the
   same set. Keep `duration_seconds` `le=10` and the Ark aspect-ratio branch.
2. **Capability split** — add `reference_images: bool` to `VideoCapabilitiesDto`
   (true for Veo/Omni, false for Ark). `image_to_video` alone previously implied
   both Frames-to-Video and Ingredients-to-Video; Ark supports first/last frame
   only. Flip Ark `image_to_video` back to `true`.
3. **Frontend gating** — filter the mode menu by the selected model's capabilities
   instead of rendering all 5 static modes; `Ingredients to Video` / `Extend Video`
   / `Concatenate Video` require `referenceImages`; `maxReferenceImages` keys off
   `referenceImages`, not `imageToVideo`. No resolution type widening.

## Already wired (earlier session, in working tree)

- `VideoGenerationRequest.last_frame_image_uri` added (`ai_providers/contract.py`).
- `ArkAdapter.submit` emits top-level `role: "first_frame"` / `"last_frame"` on
  image content items.
- `veo_service.py` Ark branch (~L766-853) converts `start_image_for_api.gcs_uri` /
  `end_image_for_api.gcs_uri` through `gcs_uri_to_public_url` (bucket is
  public-read, so no signing needed) and warns if reference images reach Ark.

## Pitfalls

- Bootstrap only inserts-if-missing — a seed edit never updates existing
  `ai_models` rows. Always pair it with a migration or direct SQL `UPDATE`.
- Backend container loses dev deps on recreate: run
  `uv sync --extra dev` before `pytest`.
- Full suite with `-v` gets OOM-killed; use `-q`.
- `docker compose run --rm pre-commit run --all-files` fails on frontend hooks
  (`spawn eslint ENOENT`); run `black` inside the backend container instead.
- Ark has no ingredients/multi-reference mode; keep it out of
  `supported_reference_models`.
