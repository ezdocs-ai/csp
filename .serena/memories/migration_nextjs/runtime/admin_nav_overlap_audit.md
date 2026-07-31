# Admin Nav ↔ WorkspaceSwitcher Overlap Audit (READ-ONLY)

Scope: Next admin shell only. Studio shell (Sidebar + WorkspaceSwitcher) untouched per request.

## Files inspected (no edits)
- `frontend-next/app/(admin)/admin/layout.tsx`
- `frontend-next/app/(admin)/admin/admin-subnav.tsx`
- `frontend-next/src/features/workspaces/components/workspace-switcher.tsx`
- `frontend-next/src/components/ui/sidebar.tsx`
- `frontend-next/src/styles/tokens.css` (`--tri-layout-gutter: clamp(20px,4vw,56px)`, `--tri-space-8: 32px`)

## Root cause (1–2 of 5–7 candidates distilled)
Candidates considered: (1) switcher z-index paints over nav; (2) AdminSubnav left padding too small; (3) container `pl` too small; (4) switcher width unbounded; (5) vertical range overlap; (6) Angular shell parity drift; (7) gutter token too small.

Distilled → **#3 + #4 + #5**:
- `WorkspaceSwitcher` (studio shell, DO NOT TOUCH): `fixed left-[5vw] top-[3vh] z-[101] xl:left-[3vw]`. Width unbounded = `px-4(32) + gap-2(8) + 2×size-4(32) + truncated name(max 180)` ≈ **252px worst case**.
- Admin layout container `pl` (`layout.tsx` L60): `md:pl-[calc(5vw+5.5rem)] xl:pl-[calc(3vw+6rem)]` = `5vw+88px` / `3vw+96px`.
- `<main>` adds `px-[--tri-layout-gutter]` = clamp(20,4vw,56). First AdminSubnav link x ≈ `5vw + 88 + 56 = 5vw + 144px` (at 1440w: 72+144 = **216px**).
- Switcher right edge ≈ `5vw + 252px` (at 1440w: 72+252 = **324px**).
- **Horizontal overlap ≈ 108px** worst case (long workspace name).
- Vertical: switcher `top-[3vh]` (~27–43px) height ~40px = y∈[27,67]; subnav at `main py-8`(32px) link h~40 = y∈[32,72]. **Vertical overlap y∈[32,67]**.
- Switcher `z-[101]` paints over nav → visible occlusion of first link ("Dashboard").

## Proposed minimal responsive fix (DO NOT EDIT — proposal only)
Constraint: studio shell unchanged. Push AdminSubnav right only on md+ (mobile switcher is `bottom-[10vh]`, no conflict).

Single-line change to `admin-subnav.tsx` `<nav>` className — add left offset that clears switcher max width:

```diff
- className="mb-[var(--tri-space-6)] flex flex-wrap gap-2 border-b border-[var(--tri-border-default)] pb-[var(--tri-space-4)]"
+ className="mb-[var(--tri-space-6)] flex flex-wrap gap-2 border-b border-[var(--tri-border-default)] pb-[var(--tri-space-4)] md:ml-[7.5rem] xl:ml-[7rem]"
```

Rationale:
- Existing container `pl` already pushes content past sidebar pill (72px wide at `5vw`/`3vw`).
- Additional `ml-[7.5rem]`(120px md) / `ml-[7rem]`(112px xl) on nav only → subnav first link x ≈ `5vw+144+120 = 5vw+264px` > switcher right `5vw+252px`. Clears by ~12px.
- Affects only AdminSubnav row; page cards/tables keep current alignment (no asymmetric admin layout).
- Mobile (`<768px`) untouched — switcher is bottom-anchored.

## Alternatives considered (rejected)
- Bump container `pl` in `layout.tsx`: shifts all admin content right → asymmetric vs Angular parity, larger blast radius.
- Constrain switcher width: violates "studio shell unchanged" constraint.
- Push subnav down with `mt`: doesn't address horizontal overlap, wastes vertical space.
- Add `z-[102]` to nav: hides symptom, switcher still visually crowds nav.

## Validation hooks (when edit is approved)
1. `cd frontend-next && bun run dev` → `/admin` at 1440×900 + 768×1024 + 375×812.
2. Long workspace name ("My Extremely Long Private Workspace Name…") → confirm no overlap on "Dashboard" link.
3. Playwright: `frontend-next/tests/admin` snapshot if exists.
4. `bun run lint` + `bun run typecheck`.

## Status
READ-ONLY audit. No files modified. Awaiting approval to apply the one-line `admin-subnav.tsx` change.
