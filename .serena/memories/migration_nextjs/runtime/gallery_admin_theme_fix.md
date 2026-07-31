# Runtime/UI fix — Gallery Router hook crash, dark button contrast, admin date parity

Date: 2026-07-30

## Gallery
Observed browser stack: `Rendered more hooks than during the previous render` in Next internal `Router` while entering `/gallery`, immediately as URL changed to `?workspaceId=1`. Static audit found no Rules-of-Hooks violation in Gallery components.

Root cause addressed: `app/(studio)/gallery/page.tsx` performed a server `redirect()` to add the first workspace while the shell `WorkspaceSwitcher` also owns client-side `router.replace()` workspace URL synchronization. The competing transition during hydration triggered the internal Router hook mismatch.

Fix: when `workspaceId` is absent, Gallery validates and renders the first workspace directly; `WorkspaceSwitcher` remains the single URL-sync owner. Invalid/missing workspace IDs still fail explicitly.

Authenticated browser re-verification was attempted, but the 15-minute session had expired and Google account chooser remained loading under browser automation. Build/lint/unit/static review pass; authenticated manual confirmation remains recommended. Backend logs also show local Google ADC reauthentication/IAM signer errors for signed media URLs, which are environment credentials and were not changed (no gcloud commands allowed).

## Dark-mode button contrast
`src/styles/tokens.css` now overrides dark `--tri-button-danger-fg` with `--tri-brand-on-primary` (#02231C) rather than inherited literal white. Dark danger contrast on coral is approximately 6.6:1 (AA), while light theme remains unchanged.

## Admin date-range Angular parity
Angular behavior verified: initial range is local current month first day through last day; stats load with both dates together. Next now:
- resolves missing/incomplete date params to current local month;
- displays those selected values immediately;
- sends both dates together or neither;
- uses `range=all` to preserve explicit clearing instead of reapplying defaults;
- prevents future selections with input max=today;
- remounts controlled filters when server range changes.

New pure helpers in `src/features/admin/components/dashboard-date-range.ts` cover local date formatting, default current month, complete selected range, explicit all-time, and incomplete range normalization.

## Validation
- targeted admin tests: 4 pass.
- production Next build: pass.
- lint: pass.
- full unit suite: 279 pass, 0 fail, 614 assertions, 44 files.
- Playwright unauthenticated smoke: 3 pass; 3 authenticated skipped without fresh state.
- scoped containerized pre-commit: pass.
- `git diff --check`: pass.
- independent final review: no blockers (`mem:migration_nextjs/runtime/gallery_admin_theme_final_review`).

No cloud changes or commits performed.
