# Admin tags GET 405 fix

Date: 2026-07-30

User supplied terminal evidence while discussing Source Assets:
- `GET /api/source-assets?...` succeeded with HTTP 200.
- Actual error was `GET /api/admin/tags` → BFF called backend `GET /api/tags` → FastAPI 405 with `Allow: POST`.

Root cause:
Backend tags controller has no GET list route. Listing/search is exclusively `POST /api/tags/search` with `TagSearchDto`. Media Gallery uses browser-facing `GET /api/admin/tags` to populate tag filter options, and the BFF incorrectly forwarded GET to `/api/tags`.

Fix:
- Kept browser-facing `GET /api/admin/tags` stable.
- Added pure `tagSearchPayloadFromQuery(URLSearchParams)` mapping optional `workspace_id`, `user_id`, `limit`, `offset` to finite numbers and trimmed `search` to string.
- BFF GET now calls `api.post('/api/tags/search', JSON.stringify(payload))`.
- Added unit coverage for valid mapping and invalid/blank omission.
- Existing POST create/search/bulk-assign and `[id]` mutations unchanged.

Validation:
- Next production build passed (59/59 pages)
- ESLint passed
- frontend unit suite: 280 pass, 0 fail, 622 assertions
- diagnostics clean for all 3 changed files
- scoped Docker pre-commit passed
- git diff --check passed
- independent contract/security review: pass, original 405 resolved

No backend, cloud, infra, dependency, or commit changes for this fix.