# Phase D — Hydration / Persistence / DTO-stripping Review (read-only)

Files: `frontend-next/src/features/image-studio/hooks/use-image-state.ts`,
`frontend-next/src/features/video-studio/hooks/use-video-state.ts`,
`frontend-next/app/api/images/route.ts`.

Backend contract: `src/common/base_dto.py` `BaseDto` → `ConfigDict(alias_generator=to_camel, extra="forbid", populate_by_name=True, from_attributes=True)`. So DTO accepts camelCase aliases AND rejects unknown keys. `CreateImagenDto` (src/images/dto) has NO `mode` / `referenceImages` fields.

## Verdict per check

1. **Server vs first client render match — PASS.** `useState` initializer builds state from `defaultImageState`/`fallbackState` + `initial` only. `localStorage` touched solely inside `useEffect` (post-mount). No `localStorage is not defined` on SSR; deterministic const => SSR HTML == client first render. rAF restore is a *post-hydration* update, not a mismatch.

2. **Saved localStorage restores after mount — PASS.** Restore effect reads `getItem` + `JSON.parse` synchronously, schedules `setState(restoredState)` via `requestAnimationFrame` (use-image-state L25-28; use-video-state L33-36).

3. **Explicit initial props win — PASS.** Restore merge order `{ ...defaultImageState, ...JSON.parse(saved), ...initial }` — `initial` spread last (use-image-state L23; use-video-state L31). Server-derived `workspaceId`/props override persisted blob. `initial` captured in `[]`-effect closure (restored once, intentional).

4. **Persistence can't overwrite saved before capture/restore — PASS.**
   - Capture (`getItem`) runs synchronously in mount effect BEFORE rAF-deferred `setState`.
   - Persistence effect gated on `restored.current` (L40, L48) — `false` until rAF fires, so the persistence write on mount + any interleaving mount-effect setState (e.g. workspace sync) bail.
   - After rAF sets `restored.current=true` and `setState`, persistence re-runs on state change and writes — capture already done, so no clobber.
   - StrictMode double-mount safe: cleanup cancels pending rAF before 2nd run; `getItem` re-captures same value; only one restore fires.

5. **Cleanup correct — PASS.** Restore effect cleanup `cancelAnimationFrame(frame)` with `frame` defaulting `undefined` (no-op if getItem/parse threw before scheduling). Persistence effect fire-and-forget write, no cleanup needed.

6. **No unknown UI-only fields reach strict image DTO — PASS.** `ImageGenerationRequest` (image-studio/types.ts) has 18 fields. Payload = `{ ...state, referenceImages }` (image-studio.tsx L148-157). Route strips `mode` + `referenceImages` (route.ts L24-26). Remaining 16 fields all map to valid `CreateImagenDto` camelCase aliases (extra="forbid" would 422 otherwise). Strip is *necessary*, not cosmetic.

## Observations (NOT blockers)

- **Route strip = denylist, not allowlist.** Currently exhaustive for the field set, but fragile: any future UI-only field added to `ImageGenerationRequest`/payload without updating the strip list => backend 422. Allowlist (pick known DTO keys) is safer. Current state correct.
- **use-video-state L59 `useMemo(() => state, [state])`** is a no-op (returns same identity). Harmless; delete candidate.
- **rAF-deferred restore interleaves with other mount effects' setState.** Final committed state = `restoredState` (initial wins); workspace-sync effect in image-studio.tsx won't refire after restore, but `initial.workspaceId` and `activeWorkspace.id` are both server-derived so consistent. No data corruption thanks to the `restored.current` gate.
- Video hook has no backend DTO in scope (task scoped to image DTO). Structure mirrors image hook; same hydration/persistence guarantees hold.

## Blocker: NONE
All six verification points pass. Code is correct as-is.
