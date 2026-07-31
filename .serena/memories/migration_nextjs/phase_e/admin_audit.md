# Phase E read-only audit — Angular vs Next admin surfaces (CURRENT)

Scope: `csp/frontend/**` (Angular, source of truth) vs `csp/frontend-next/**` (port target).
Surfaces audited: layout/subnav, dashboard, users, source-assets, templates, tags, media-gallery, ai-providers, ai-models. Read-only. No edits made.
Supersedes `migration_nextjs/parity_routes/complex_admin` and the two `parity_impl/admin_*` logs (those items are reconciled below). Written 2026-07-29.

## 0. Status vs prior audits — what actually moved

CLOSED (verified in current code, no longer blockers):
1. `/api/admin/dashboard` route now forwards `workspace-stats` + `active-users-monthly` → `WorkspaceBarChart` / `MonthlyUsersChart` populate. (`app/api/admin/dashboard/route.ts` `paths` array.)
2. `/api/admin/media-gallery` GET repointed at backend `POST /api/gallery/search` (was hitting non-existent `/api/media-items`). 404 blocker closed.
3. `use-admin-users.ts` CSRF cookie fixed: now reads `csp_csrf` (was `csrf-token`). Multi-role select (`USER_ROLES = ["user","creator","admin","workflows"]`) and PATCH→PUT translation live in `app/api/admin/users/[id]/route.ts`.
4. Workflow role gate added to `src/middleware.ts`: `/workflows*` now requires `admin || workflows`.
5. Admin users (`users-table.tsx` + `user-edit-dialog.tsx`): avatar, email filter (debounced), include-deleted, paginator `[10,25,100]`, SortableHead on name/email/roles/createdAt/updatedAt, role chips via `roleTone`, multi-role `MultiSelect` with "At least one role must be selected" validation, `ConfirmDialog` for delete — all shipped.
6. Admin templates (`template-editor.tsx`): Thumbnail, mimeType Badge, description (truncate+title), industry, brand columns, debounced filter, SortableHead, Paginator `[10,25,100]`, `Dialog` form (lg), `ConfirmDialog` for delete, `JSON.parse(options)` wrapped in try/catch — all shipped.
7. Admin tags (`tag-manager.tsx`): color swatch + `ColorPicker` inline edit, Paginator `[5,10,20]`, edit/save/cancel per row — shipped.
8. Admin media-gallery (`media-gallery-admin.tsx`): Search/User email/Status/Type/Model/Tags(MultiSelect)/Date range filters, Preview/Workspace/User/Type-Model/Status/Created/Actions columns, `statusTone` Badge, `ConfirmDialog` for cleanup + delete, Paginator `[5,10,25,50]` — shipped.
9. Shared controls exist in `src/features/admin/components/admin-controls.tsx`: `MultiSelect`, `SortableHead`, `Paginator`, `ColorPicker`, `SlideToggle`, `useDebouncedCallback`, `toQuery`, `pageOffset`, `roleTone`. Net-new primitives from old audit no longer missing.

## 1. Blockers (prioritised)

### P0 — hard runtime blockers

**B1. Templates Create/Edit contract diverges from Angular — Create 100% broken.**
Evidence:
- `frontend-next/app/api/admin/templates/route.ts` POST: if `body.mediaItemId` absent, returns 400 with `"mediaItemId required (backend supports only from-media-item creation)"`. The Next `template-editor.tsx` "Create Template" button POSTs `{...form, options, tags}` (no `mediaItemId`). → every Create attempt 400s.
- `template-editor.tsx` PATCH body is **flat** `{name, description, mimeType, model, industry, brand, tags[], options, thumbnail_url, gcs_uri}`.
- Angular source of truth (`media-template-form.component.ts` + `media-templates.service.ts`) sends **nested** `{id, name, description, mimeType, industry, brand, tags[], gcsUris[], thumbnailUris[], generationParameters:{prompt, model, aspectRatio, style, lighting, colorAndTone, composition, negativePrompt}}`. Service posts the full body to `/media-templates` (NOT `/from-media-item/:id`).
- Backend accepts Angular's nested shape in production today; Next's flat shape + Next's `mediaItemId`-only branch both diverge.
Impact: admin cannot create templates; admin edits PUT a shape backend will reject or silently drop fields from. This is the single biggest parity hole in admin.
Fix set (disjoint): `app/api/admin/templates/route.ts` + `app/api/admin/templates/[id]/route.ts` + `src/features/admin/components/template-editor.tsx`. Also fold CSRF addition (B6) into the same owner.

**B2. Tags `workspace_id` contract diverges — list empty / mutations mis-scoped.**
Evidence (Angular `tags.service.ts` vs Next `app/api/admin/tags/*`):
- Angular `getTags`: `POST /tags/search` body `{workspace_id, search, limit, offset, user_id?}` — `workspace_id` required.
- Next `tag-manager.tsx` `load()` POSTs `{action:"search", data:{limit, offset}}` — no `workspace_id`. `app/api/admin/tags/route.ts` forwards `body.data ?? {}` verbatim. Result: backend 400 or returns wrong-scope data.
- Angular `createTag`: `POST /tags` body `{name, workspace_id, color}` with `workspace_id` from `WorkspaceStateService.getActiveWorkspaceId()`.
- Next create form asks the admin to **type a workspace ID** into a number input — UI regression + easy footgun.
- Angular `updateTag`: `PUT /tags/:id?workspace_id=X` body `{name?, color?}`. Angular `deleteTag`: `DELETE /tags/:id?workspace_id=X`.
- Next `app/api/admin/tags/[id]/route.ts` PATCH → `PUT /api/tags/:id` (no query), DELETE → `DELETE /api/tags/:id` (no query). If backend enforces workspace_id query, every mutation 400s.
Impact: tag list renders empty for fresh admin (no workspace_id) or 400s silently (caught → empty); create requires admin to know workspace IDs by hand; PATCH/DELETE likely fail.
Fix set (disjoint): `app/api/admin/tags/route.ts` + `app/api/admin/tags/[id]/route.ts` + `src/features/admin/components/tag-manager.tsx` (consume `useWorkspace()` like `source-asset-admin.tsx` does). Also fold CSRF (B6) into this owner.

**B3. Admin `requireRole(["admin"])` not called on AI GET routes.**
- `app/api/admin/ai-models/route.ts` GET and `app/api/admin/ai-providers/route.ts` GET (and their `[id]/route.ts` GETs) call only `requireApiClient()` — never `requireRole(["admin"])`.
- Every other admin route (users, tags, templates, media-gallery, dashboard) DOES call `requireRole(["admin"])`. Backend still enforces admin via the bearer token, so this is defence-in-depth asymmetry rather than a live auth bypass — but it is inconsistent and worth closing while touching these files.
Fix set (disjoint): `app/api/admin/ai-models/route.ts` + `[id]/route.ts` + `app/api/admin/ai-providers/route.ts` + `[id]/route.ts` GET handlers. (CSRF already correct on mutation paths here.)

### P1 — UX/feature-parity blockers (runtime OK, journey diverges)

**B4. Source-assets admin journey fundamentally different.**
- Angular `source-assets-management.component.html`: platform-wide browse — Create Asset button (opens form modal), Filter by Scope, Filter by Type, Clear + Search, table columns thumbnail/originalFilename/assetType chip/createdAt/actions(edit+delete), SortableHead, Paginator `[10,25,100]` `showFirstLastButtons`.
- Next `source-asset-admin.tsx` + `source-asset-list.tsx`: workspace-scoped — `UploadDropzone` + table Name/Type/Size/Created/Delete only. No scope filter, no type filter, no Create form modal, no sort, no paginator, no thumbnail, no edit. Uses `window.confirm` (not `ConfirmDialog`). Active-workspace-scoped via `useWorkspace()`, NOT platform-wide.
- This is the largest journey delta still standing in admin.
Fix set (disjoint): `app/(admin)/admin/source-assets/page.tsx` + `src/features/source-assets/components/source-asset-admin.tsx` + `src/features/source-assets/components/source-asset-list.tsx`. Lead decision needed: extend `app/api/source-assets/route.ts` to support platform-wide browse for admins (currently workspace-scoped; shared with studio) — confirm before touching shared route.

**B5. AI Models / AI Providers inline enable toggle + provider filter missing.**
- Angular `ai-providers-management.component.html` + `ai-models-management.component.html`: inline `<mat-slide-toggle>` mutates `enabled` immediately via `toggle(...)`. AI Models page also has a Provider `<mat-select>` filter at top.
- Next `ai-models-admin.tsx` + `ai-providers-admin.tsx`: render `Yes/No` text; toggling `enabled` requires opening the dialog. AI Models page never wires a provider filter select (the `useAiModels(providerId?)` arg exists but the component never passes one).
- Cheap fix: `SlideToggle` primitive already lives in `admin-controls.tsx`; `useAiModels().update` already supports partial PATCH.
Fix set (disjoint): `src/features/admin/components/ai-models-admin.tsx` + `src/features/admin/components/ai-providers-admin.tsx`.

**B6. AI Providers/Models subnav feature-flag gate missing.**
- Angular `admin-layout.component.html` wraps both nav entries in `*ngIf="featureFlags.isEnabled('aiProviderRegistryAdmin')()"`. `feature-flags.service.ts` ships with `aiProviderRegistryAdmin: false` by default — so Angular hides these pages unless an operator opts in.
- Next has NO feature-flag system at all (`grep FeatureFlag|feature_flag|isEnabled frontend-next` → no matches). `admin-subnav.tsx` renders AI Providers + AI Models unconditionally.
- Runtime OK (admin-gated), but platform may expose UI for an unfinished subsystem Angular hides by default.
Fix set (disjoint): `app/(admin)/admin/admin-subnav.tsx`. Smallest option: `process.env.NEXT_PUBLIC_AI_PROVIDER_REGISTRY_ADMIN === "true"` gate. If a runtime flag system is desired later, add `src/lib/feature-flags.ts` (new file, separate decision).

**B7. Dashboard superAdmin "Restricted View" gate — confirmed PHANTOM, do not implement.**
- Angular `admin-home.component.html` gates content on `isSuperAdmin$ | async`. `admin-home.component.ts` defines `isSuperAdmin$ = of(authService.isUserAdmin())` — i.e. the same `ADMIN` role check Angular uses everywhere.
- Next `Role` union has no superAdmin tier; `app/api/auth/login/route.ts` pulls roles from backend `/api/users/me` filtering to `{admin,user,creator,workflows}`, env fallback via `ADMIN_EMAILS`. So Next `admin` ≡ Angular `superAdmin`. The "Restricted View" fallback has no real audience.
- Decision: keep current `requireRole(["admin"])` gate, do NOT invent a superAdmin role. Document and move on.

### P2 — cosmetic / responsive / cleanup

**B8. Admin shell anatomy divergence (accepted).** Angular = its own right-side `mat-sidenav position="end"` (250px) with icon+label list + `.active-link` gradient; content padded `!m-0 !p-10`. Next = reuses the global studio `Sidebar` (left) + adds a secondary `AdminSubnav` pill row inside `main`, content padded `px-[var(--tri-layout-gutter)] py-[var(--tri-space-8)]`. Two different anatomies. Next's is arguably cleaner and consistent with the rest of the app. Cosmetic only — left as-is unless lead asks otherwise.

**B9. Dashboard KPI cards text-only.** Angular = 8 named cards with material icons + per-card tooltip (`Total Users / Workspaces / Images Gen. / Videos Gen. / Audios Gen. / AI Media Total / Uploaded / Overall Total`). Next `admin/page.tsx` renders arbitrary `data.overview` entries as `label.replaceAll("_"," ")` text cards — depends on backend overview keys mapping cleanly. Field mapping unverified. Fix set: `app/(admin)/admin/page.tsx` only.

**B10. Dashboard date-range filter divergence.** Angular `<studio-date-range-filter>` calendar picker. Next `DashboardFilters` renders two bare `<input type=date>`. Responsive OK, parity approximation. Document.

**B11. Media-gallery include-deleted checkbox deferred (intentional).** `app/api/admin/media-gallery/route.ts` hardcodes `include_deleted: true`; the component has a `ponytail:` comment explaining a toggle would be a silent no-op until the route is edited. Re-enable in the same change that parameterises the route. Document.

**B12. Tag bulk-assign form still exposed in Next.** Angular hides `bulk-assign` on the tags page; Next keeps it folded in a `<details>` disclosure. Removing working logic is out of scope; cosmetic divergence.

**B13. `template-editor.tsx` lint smell.** `load` not wrapped in `useCallback`; `useEffect(() => { load(); }, [])` triggers `react-hooks/exhaustive-deps` warning. Harmless at runtime. Already noted in `parity_impl/admin_templates_dashboard`. Fix during B1.

## 2. CSRF coverage matrix (current code)

Mutation route → server-side `verifyCsrf` → client sends `x-csrf-token`:
| Surface | Server verifyCsrf | Client header |
|---|---|---|
| users/[id] (PATCH/POST/DELETE) | ✅ | ✅ `use-admin-users.ts` reads `csp_csrf` |
| ai-models (POST/PATCH/DELETE) | ✅ | ✅ `use-ai-models.ts` via `/api/auth/csrf` |
| ai-providers (POST/PATCH/DELETE/test) | ✅ | ✅ `use-ai-providers.ts` via `/api/auth/csrf` |
| templates (POST/PATCH/DELETE) | ❌ | ❌ `template-editor.tsx` sends none |
| tags (POST all actions + PATCH + DELETE) | ❌ | ❌ `tag-manager.tsx` sends none |
| media-gallery (POST cleanup/delete/restore) | ❌ | ❌ `media-gallery-admin.tsx` sends none |
Recommendation: add `verifyCsrf` to all admin mutation routes uniformly; client-side, route the three laggards through `getCsrf()` like `use-ai-models.ts` does. Backend may not enforce on these today (tags evidently worked in prior audit), but the asymmetry is a security smell.

## 3. Role / auth / feature gating (current truth)

- Session shape (`src/lib/auth/session.ts`): `Role = "admin" | "user" | "creator" | "workflows"`. **No superAdmin tier.** Verified.
- Role source (`app/api/auth/login/route.ts`): backend `GET /api/users/me` → filter to known roles → env `ADMIN_EMAILS` fallback. End-to-end confirmed.
- Middleware (`src/middleware.ts`): `/admin*` requires `roles.includes("admin")`; `/workflows*` requires `admin || workflows`. Both redirects to `/` on failure.
- Admin layout (`app/(admin)/admin/layout.tsx`) calls `requireRole(["admin"])`. Sub-pages: tags/templates/media-gallery/source-assets also re-call `requireRole(["admin"])`; users/ai-models/ai-providers rely on layout (acceptable).
- Feature-flag system: **none in Next.** `aiProviderRegistryAdmin` (Angular default false) has no Next equivalent → AI Providers/Models always visible in subnav (B6).

## 4. Responsive table behaviour

- `src/components/ui/table.tsx`: wrapper is `w-full overflow-x-auto`, table `min-w-max`. Narrow viewports get horizontal scroll, columns do not collapse or hide. Same model as Angular (`overflow-auto` rounded container). Sticky header opt-in via `sticky` prop. No priority-plus / hidden-at-breakpoint behaviour on either side — symmetric.
- `Paginator` (`admin-controls.tsx`): wraps `flex-wrap` so controls reflow on narrow widths. Symmetric.

## 5. Concrete runtime / contract risks (top hits)

1. **Templates Create always 400s** (B1) — primary journey dead.
2. **Templates PATCH sends flat shape** to a backend that expects Angular's nested `generationParameters` + `gcsUris[]` + `thumbnailUris[]` — fields silently dropped or 422.
3. **Tags list returns empty** when backend enforces `workspace_id` on `/tags/search` — admin sees "No tags found for this workspace" indefinitely.
4. **Tags PATCH/DELETE drop `?workspace_id=`** query — backend may 400 or mutate wrong scope.
5. **AI Models/Providers GET routes skip `requireRole`** — relying solely on backend authorisation. Defence-in-depth gap (B3).
6. **CSRF unenforced on templates/tags/media-gallery mutations** (matrix §2) — cross-site mutation risk if backend CSRF middleware ever narrows.
7. **`template-editor.tsx` `load()` not in `useCallback`** — `exhaustive-deps` lint warning; behaviour OK but pre-commit may flag (B13).
8. **Source-assets admin workspace-scoped, not platform-wide** like Angular's — admins get a single-workspace view, not the platform browse Angular ships (B4).
9. **Dashboard overview card mapping assumes backend keys** — `label.replaceAll("_"," ")` will produce odd labels if backend ships PascalCase or camelCase keys (B9).

## 6. Proposed disjoint write sets (one owner each, no shared files)

| Set | Scope | Files | Blocker |
|---|---|---|---|
| S1 | Templates contract + CSRF + lint | `app/api/admin/templates/route.ts`, `app/api/admin/templates/[id]/route.ts`, `src/features/admin/components/template-editor.tsx` (+ optional test) | B1, B6-partial, B13 |
| S2 | Tags workspace_id + CSRF | `app/api/admin/tags/route.ts`, `app/api/admin/tags/[id]/route.ts`, `src/features/admin/components/tag-manager.tsx` | B2, B6-partial |
| S3 | Source-assets admin journey | `app/(admin)/admin/source-assets/page.tsx`, `src/features/source-assets/components/source-asset-admin.tsx`, `src/features/source-assets/components/source-asset-list.tsx` (lead decision if `app/api/source-assets/route.ts` needs platform-admin browse — shared with studio) | B4 |
| S4 | AI Models + Providers inline toggle + provider filter | `src/features/admin/components/ai-models-admin.tsx`, `src/features/admin/components/ai-providers-admin.tsx` | B5 |
| S5 | AI subnav feature-flag gate | `app/(admin)/admin/admin-subnav.tsx` | B6 |
| S6 | AI routes `requireRole` on GET | `app/api/admin/ai-models/route.ts`, `app/api/admin/ai-models/[id]/route.ts`, `app/api/admin/ai-providers/route.ts`, `app/api/admin/ai-providers/[id]/route.ts` | B3 |
| S7 | Media-gallery CSRF + include-deleted toggle | `app/api/admin/media-gallery/route.ts` POST branch, `src/features/admin/components/media-gallery-admin.tsx` (add x-csrf-token + include-deleted checkbox) | B6-partial, B11 |
| S8 | Dashboard KPI named cards | `app/(admin)/admin/page.tsx` | B9 |

Disjointness: S1–S8 share no source files. S6 touches AI route files not touched by S4 (component-only). S7 is the only set that touches `media-gallery` files. Merge CSRF work into S1/S2/S7 (the three laggard surfaces) to avoid revisiting them.

## 7. Things deliberately NOT verified

- Backend `/api/media-templates` POST schema (inferred from Angular service + form shape; the divergence verdict does not depend on backend internals — Angular works in prod, Next does not).
- Backend `/api/tags` workspace_id enforcement (inferred from Angular service always sending it; verdict robust either way — if backend does not enforce, Next simply shows cross-workspace tags, which is also wrong).
- Backend `/api/admin/ai-models` authorisation when no `requireRole` is called (assumed enforced server-side via bearer token; B3 is hardening, not a live bypass).
- `frontend-next/app/api/source-assets/route.ts` body (S3 lead-decision item).
- Visual / browser run — code-only audit, per task scope.
