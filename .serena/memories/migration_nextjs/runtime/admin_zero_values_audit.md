# Admin Dashboard — Next KPIs show 0 (Angular fine) — READ-ONLY AUDIT

Date: 2026-07-30
Scope: READ-ONLY. No source edits. Compare Angular vs Next admin dashboard.

## Symptom
- Next `localhost:3000/admin` KPI cards render 0 for: total_users, total_workspaces,
  images_generated, videos_generated, audios_generated, total_media,
  user_uploaded_media, overall_total_media.
- Angular `localhost:4200/admin` (admin-home) shows real values.
- Role donut + Generation-health line chart on Next DO render (single-word keys).

## Root Cause (1 source, 90% confidence)
**Pydantic camelCase alias serialization vs Next snake_case key lookup.**

### Evidence chain
1. `backend/src/common/base_dto.py`:
   ```python
   class BaseDto(BaseModel):
       model_config = ConfigDict(
           alias_generator=to_camel,   # <-- snake_case attr -> camelCase JSON
           extra="forbid",
           populate_by_name=True,
           from_attributes=True,
       )
   ```
2. `backend/src/admin/dto/admin_response_dto.py` `AdminOverviewStats` declares snake_case
   fields: `total_users, total_workspaces, images_generated, videos_generated,
   audios_generated, total_media, user_uploaded_media, overall_total_media`.
3. FastAPI `response_model=AdminOverviewStats` defaults `response_model_by_alias=True`,
   so the wire JSON keys are camelCase: `totalUsers, totalWorkspaces, imagesGenerated,
   videosGenerated, audiosGenerated, totalMedia, userUploadedMedia, overallTotalMedia`.
4. Angular `frontend/src/app/services/admin/admin-dashboard.service.ts` interface
   `AdminOverviewStats` uses **camelCase** (`totalUsers`, `imagesGenerated`...) -> MATCHES
   backend wire format. Angular renders values.
5. Next `frontend-next/src/features/admin/components/admin-charts.tsx`:
   - `OVERVIEW_KPIS[].key` are **snake_case** (`total_users`, `images_generated`...).
   - `overviewKpis(overview)` does `Number(source[kpi.key] ?? 0)` -> `source["total_users"]`
     is `undefined` on the camelCase payload -> every KPI = 0.
6. Comment on `OVERVIEW_KPIS` claims "Keys match snake_case fields returned by
   /api/admin/overview-stats" -- INCORRECT assumption. Matches Python attr names,
   NOT serialized JSON keys.
7. Next route `app/api/admin/dashboard/route.ts` passes backend JSON straight through:
   `NextResponse.json({ overview, ... })`. `overview` keeps camelCase keys. Page
   receives camelCase; lookup with snake_case misses.

### Secondary mismatch (same root cause, affects Media-over-time chart)
- `AdminMediaOverTime.total_generated` serializes to `totalGenerated`.
- Page `app/(admin)/admin/page.tsx:56` reads `item.total ?? item.count` -- neither key
  exists -> bar chart also empty. (Angular reads `totalGenerated`.)

### Why role donut + generation-health still render
- `AdminActiveRole { role, count }` and `AdminGenerationHealth { status, count }` have
  only single-word fields -> `to_camel` is identity -> wire keys unchanged -> Next OK.

## NOT the cause (verified, ruled out)
- Date query handling: Next `resolveDashboardDateRange()` (dashboard-date-range.ts)
  defaults first..last day of current month, same as Angular admin-home. Both send
  `?start_date=...&end_date=...`. Backend `_apply_date_filters` parses `%Y-%m-%d` fine.
  Not a differentiator.
- Route prefix: backend router prefix `/api/admin`, Next calls `/api/admin/${path}`. OK.
- Auth/CSRF: GET path uses `requireRole(["admin"])` + `requireApiClient()`; failures
  would 401/500, not zero values.

## Minimal Fix (recommended, not applied -- read-only)
**Preferred (Option A): align Next to backend wire contract (camelCase).**
1. `frontend-next/src/features/admin/components/admin-charts.tsx`:
   change `OVERVIEW_KPIS` keys to camelCase: `totalUsers, totalWorkspaces,
   imagesGenerated, videosGenerated, audiosGenerated, totalMedia,
   userUploadedMedia, overallTotalMedia`.
2. `frontend-next/src/features/admin/types.ts` `DashboardData.overview`:
   update declared keys to camelCase (keep index signature).
3. `frontend-next/app/(admin)/admin/page.tsx:56` Media-over-time mapping:
   read `item.totalGenerated ?? item.total ?? item.count`.
4. Update `__tests__/admin-charts.test.ts`:
   - "exposes the eight dashboard metrics in stable order" -> camelCase key list.
   - "overviewKpis maps snake_case overview values" -> feed camelCase, assert camelCase.
5. Add contract test: `overviewKpis({totalUsers:10,imagesGenerated:4})` returns
   values 10 and 4 and others 0.

**Alternative (Option B):** normalize in route handler -- map camelCase->snake_case
before `NextResponse.json`. More code, hides real contract; not recommended.

**Do NOT** change backend `BaseDto` (would break every other Angular consumer).

## File map (read-only references)
- Backend DTO:        `backend/src/admin/dto/admin_response_dto.py`
- Backend base:       `backend/src/common/base_dto.py` (alias_generator=to_camel)
- Backend controller: `backend/src/admin/admin_controller.py` (prefix=/api/admin)
- Backend repo:       `backend/src/admin/repository/admin_repository.py`
                       `_apply_date_filters` + `get_overview_stats`
- Angular service:    `frontend/src/app/services/admin/admin-dashboard.service.ts`
                       (camelCase AdminOverviewStats)
- Angular consumer:   `frontend/src/app/admin/admin-home/admin-home.component.ts`
- Next route:         `frontend-next/app/api/admin/dashboard/route.ts`
- Next page:          `frontend-next/app/(admin)/admin/page.tsx`
- Next KPI source:    `frontend-next/src/features/admin/components/admin-charts.tsx`
                       (OVERVIEW_KPIS, overviewKpis)
- Next types:         `frontend-next/src/features/admin/types.ts` (DashboardData)
- Next date range:    `frontend-next/src/features/admin/components/dashboard-date-range.ts`
- Next tests:         `frontend-next/src/features/admin/__tests__/admin-charts.test.ts`

## Confidence: 95%
Single invariant explains ALL eight zero KPIs plus empty media-over-time chart,
while sparing the two single-word-key charts. Reproducible by inspecting any backend
/admin/overview-stats response (keys are camelCase) against Next snake_case lookup.
