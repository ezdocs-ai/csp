# Tridorian registry UI + source-assets loading fix

Date: 2026-07-30
Status: COMPLETE

## AI Models / AI Providers UI
Applied `tridorian-agent-instructions.md` and `tridorian-agent-theme-v3.json`:
- Semantic `--tri-*` tokens only; removed residual `--color-*` usage.
- Merged redundant desktop columns for stronger hierarchy:
  - Models: Model, Provider/vendor, Type, Environment, Priority, Status, Actions.
  - Providers: Provider, Type, Secret, Timeout, Status, Actions.
- Sticky desktop headers now use shared Table's own `max-h-[70vh] overflow-auto` scroll container.
- Numeric fields right-aligned with tabular numerals.
- Border-subtle/surface separation; no generic shadows.
- Mobile `<768px` renders semantic card lists instead of horizontally scrolling tables.
- Initial empty loads use tonal skeletons; populated refreshes retain rows and compact status.
- Filters and dialogs use 44px tokenized controls, 3px focus-visible ring, Field/Input primitives, semantic checkboxes, responsive form grids.
- Add is the sole primary action; Edit secondary; Test/Delete ghost; coral reserved for destructive confirmation dialog.
- Model save/toggle failures surface accessibly; number inputs clamp >=1; blank duration input no longer emits `[0]`.
- Provider failure status uses role=alert; provider mobile titles can shrink without overflow.
- Critical safety fix: `providerToInput` omits `secretRef`; unrelated edit/toggle no longer sends empty secret and clears stored provider secret. Mapper test updated.

## `/admin/source-assets` root cause and fix
Evidence:
- PostgreSQL contains 46 source assets.
- User roles are `{user,admin}`; role scoping and empty DB ruled out.
- Backend logs show ADC reauthentication and `serviceAccountTokenCreator` failures. Each IAM/GCS signing call waited up to 60s; list enrichment waited for all, so UI appeared to load no data.

Backend fix:
- `list_assets_for_user` gives each asset enrichment a concurrent 5-second budget with `asyncio.wait_for`.
- `asyncio.gather(..., return_exceptions=True)` isolates slow/failed assets.
- Failed enrichment returns authorized metadata with empty preview URLs rather than dropping/failing rows; pagination metadata preserved.
- Warning logs identify affected asset IDs without exposing secrets.
- Regression test simulates slow signing and asserts metadata, empty URLs, count/page/page_size/total_pages.

Frontend source-assets fix:
- Added explicit loading state.
- Initial requests show a semantic tokenized skeleton, not a false `No source assets` state.
- Existing rows remain during refresh.
- Corrected invalid `--tri-error` references to `--tri-state-error` and aligned table wrapper with semantic card/border tokens.
- Effect defers load with setTimeout(0), satisfying React lint convention.

## Validation
- Frontend production build: pass (59/59 pages)
- Frontend ESLint: pass
- Frontend unit tests: 279 pass, 0 fail, 620 assertions
- Backend targeted source-assets tests: 18 pass
- Backend full suite: 458 pass, 1 skip
- Backend coverage: 83.60% (required >=80%)
- Scoped Docker pre-commit: pass
- git diff --check: pass
- Diagnostics: no errors; Tailwind canonicalization suggestions only
- Independent Tridorian UI review: no blockers
- Independent source-assets fallback review: approved/no blockers

Live authenticated browser verification of `/admin/source-assets` was not possible at the end because the Playwright browser session expired and redirected to `/login`. Root cause was instead confirmed from Docker logs + DB state, with containerized regression tests. Preview thumbnails will remain placeholders locally until ADC is reauthenticated and the caller has serviceAccountTokenCreator; metadata rows now load regardless.

No gcloud commands, cloud/IAM changes, infrastructure changes, dependencies, or commits performed.