# /visual RSC Function-Prop Audit (read-only)

Date: 2026-07-30
Route: `frontend-next/app/visual/page.tsx`
Error: `Event handlers cannot be passed to Client Component props` — Next 16 RSC serialization guard. Surfaced shape: `open=true onClose=function title` (Dialog).

## Why
`VisualPage` is a **Server Component** (declared `async`, `await searchParams`, exports `metadata`). Per Next 16 `/vercel/next.js/v16.2.9` docs (`use-client.mdx`): props crossing the Server→Client boundary MUST be React-serializable. Functions are not serializable. No-op arrows (`() => undefined`) are still functions → rejected by RSC wire format regardless of body.

## Findings — all server→client function props in this route
Grepped `app/visual/page.tsx` for `on[A-Z]*=` and `=>`. Exactly **2** offenders:

| # | Line | Site | Prop | Receiver | Receiver `"use client"`? |
|---|------|------|------|----------|--------------------------|
| 1 | 74 | `<Toast id="fixture-toast" ... onDismiss={() => undefined}/>` | `onDismiss: (id: string) => void` | `src/components/ui/toast.tsx` `Toast` | **NO** (latent 2nd bug — see below) |
| 2 | 79 | `<Dialog open onClose={() => undefined} title="Dialog specimen">` | `onClose: () => void` | `src/components/ui/dialog.tsx` `Dialog` | YES |

No other function props in route. Verified components used in page and their client status:
- `"use client"`: `dialog`, `sidebar`, `tooltip` (+ `confirm-dialog`, `loading-bar`, `menu`, `toast-provider` not used here).
- NOT `"use client"`: `badge`, `button`, `card`, `empty-state`, `field`, `icon-button`, `input`, `table*`, `topbar`, `toast`.
- `Sidebar` (client) receives only serializable props (`brand`, `items[]`, `footer`) — OK.
- `Tooltip` (client) receives JSX child + string `content` — OK (ReactNode serializes).
- `EmptyState` receives `actions={<Button/>}` (ReactNode) — OK.

## Latent bug (not the reported one, but blocks build once Dialog fixed)
`src/components/ui/toast.tsx` has NO `"use client"` yet renders `<button onClick={() => onDismiss(id)}>`. Imported into a Server Component → Toast renders as Server Component → inline `onClick` illegal. Next would raise a separate `Event handlers cannot be passed to Client Component props` / server-onClick error after Dialog is fixed (or in different build order). Must add `"use client"` to `toast.tsx`.

## Smallest fix preserving visual fixture (NOT applied — read-only)
Goal: keep `VisualPage` a server component (needs `async searchParams` + `metadata`), keep Dialog/Toast visuals identical, satisfy RSC serialization.

**Recommended — single client island, no API changes to shared UI:**
1. `src/components/ui/toast.tsx`: add `"use client";` after license header (required regardless — fixes latent onClick bug).
2. New file `frontend-next/app/visual/_interactive-specimens.tsx`:
   ```tsx
   "use client";
   import { Dialog } from "@/src/components/ui/dialog";
   import { Toast } from "@/src/components/ui/toast";
   export function InteractiveSpecimens() {
     return (
       <>
         <Toast id="fixture-toast" tone="success" message="Media exported successfully." onDismiss={() => undefined} />
         <Dialog open onClose={() => undefined} title="Dialog specimen">
           <p className="mt-[var(--tri-space-3)] text-[var(--tri-text-secondary)]">Keyboard support: Escape closes interactive dialogs.</p>
           <div className="mt-[var(--tri-space-5)] flex gap-[var(--tri-space-3)]">
             {/* Confirm / Cancel buttons moved here verbatim from page.tsx lines 79 */}
           </div>
         </Dialog>
       </>
     );
   }
   ```
3. `app/visual/page.tsx`: remove the `<Toast .../>` (line 74) and entire `<Dialog>...</Dialog>` (line 79) from JSX; import + render `<InteractiveSpecimens/>` in their place. The no-op handlers now live in client scope → legal.

Why island over alternatives:
- Alternative A (make `onClose`/`onDismiss` optional + drop prop): changes shared `Dialog`/`Toast` API used elsewhere; riskier.
- Alternative B (Server Action via `'use server'`): overkill for a static no-op fixture; adds server roundtrip surface.
- Alternative C (mark whole page client): loses `async searchParams` + `metadata` robots export — page is intentionally server.

Island keeps diff local to `/visual` route, zero shared-API change, identical DOM.

## Docs cited
- Next.js v16.2.9 `docs/01-app/03-api-reference/01-directives/use-client.mdx` — "props passed to Client Components need to be serializable… Functions are not serializable."
- Next.js v16.2.9 `docs/01-app/01-getting-started/05-server-and-client-components.mdx` — Server→Client data must be React-serializable.
- Next.js v16.2.9 `docs/01-app/03-api-reference/01-directives/use-cache.mdx` + `07-mutating-data.mdx` — only Server Actions (`'use server'`, async) may cross boundary as callable props.

## Status
Audit only. No files edited per instruction. Apply recommended fix when unblocked.
