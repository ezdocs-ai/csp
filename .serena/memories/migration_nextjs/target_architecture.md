# Target architecture
## Mandatory design sources
- Visual reference: `frontend-next/tridorian-design-system.html`; use as composition and interaction specimen, not source to copy raw styles from.
- Machine-readable source of truth: `frontend-next/tridorian-agent-theme-v3.json`.
- UI implementation contract: `frontend-next/tridorian-agent-instructions.md`.
- Priority: accessibility > information hierarchy > responsiveness > brand consistency > polish.
- Components consume semantic CSS variables generated from theme JSON; never embed raw palette values. Prefix variables per theme implementation policy.
- Required fonts: Space Grotesk headings, Inter product UI, Readex Pro editorial, JetBrains Mono technical metadata.
- Default calm light workspace + deep-forest navigation. Focused AI workspaces/data consoles may use full dark canvas. Luminous green stays scarce primary-action signal; violet marks AI/automation/info; coral only destructive/error/urgent.
- Desktop uses 12-column asymmetric bento composition; mobile collapses to one column without horizontal scroll.
- Borders/tonal separation before shadows; one strong elevation level per viewport. One ambient gradient maximum per section. Cards only where hierarchy needs containers.
- Interactive targets >=44px; visible tokenized focus states; status never color-only; motion 140–320ms and disabled/reduced under `prefers-reduced-motion`.
- Copy uses sentence case and one primary action per section.

Assumption: migrate Angular frontend only; retain FastAPI domain API, PostgreSQL, GCS, Google Workflows, generation workers. Rewriting backend in Next.js duplicates mature Python/Google SDK logic and risks long-running serverless limits.
- Create sibling `nextjs/` app for parallel strangler migration; do not mutate Angular feature-by-feature in place.
- Use current stable Next.js App Router, TypeScript strict, React. Route groups: `app/(public)/login`, `app/(studio)/{page}`, `app/(admin)/admin/...`; dynamic `[id]`, `[workflowId]` segments. Shared layouts own header/workspace/nav.
- Server Components for shells, metadata, initial read-only data where authenticated server session exists. Client Components only for interactive editors, uploads, media players, polling, drag/drop, canvas/cropper, timeline, dialogs.
- Keep FastAPI canonical API. Add typed `lib/api/` fetch client. Do not mirror every FastAPI endpoint as Route Handler. Use Route Handlers only for auth session exchange/logout and rare BFF needs (cookie-bound proxy/download header mediation).
- Auth migration prerequisite: remove Firebase/AngularFire from new frontend. Use Google Identity Services with FedCM to obtain Google OIDC credential, exchange server-side for HttpOnly, Secure, SameSite app session, and fetch `/users/me`. Never retain raw bearer token in localStorage. Backend remains authorization source; Next layout guards improve UX only. Role/workspace checks remain FastAPI-side. Details: `mem:migration_nextjs/gcp_auth`.
- Client data: native `fetch` + small feature hooks first. Use URL search params for shareable filters/pagination/workspace. Local component state for forms; Context only auth/workspace/toasts. Add server-state library only if polling/cache invalidation code becomes duplicated across >=3 features.
- Polling: one generic `useMediaJob(id, interval)` hook; stop on completed/failed/stopped and pause when hidden. Separate workflow execution polling hook. Preserve existing 5s image and 15s video/VTO/audio cadence initially.
- Forms: native React forms + server/client validation mirroring FastAPI DTOs. Keep complex workflow editor client-side. Generate TS API models from FastAPI OpenAPI when migration scaffolding begins; avoid hand-maintained snake/camel drift.
- Styling: preserve visual CSS/SCSS tokens first; choose component replacement strategy before feature work. Angular Material cannot migrate directly. Prefer accessible native/headless primitives plus existing Tailwind; avoid recreating MatDialog/Table/Snackbar ad hoc.
- Media: retain direct signed GCS PDF upload and multipart source uploads. Browser-only crop/canvas/player/timeline modules use `use client` and dynamic import where SSR unsafe. Signed URLs remain short-lived backend output.
- Deployment: replace Firebase Angular hosting with Next-capable runtime (Cloud Run recommended, matching GCP estate) unless static export required. Static export is incompatible with server session/BFF/SSR design. Update Terraform/Cloud Build only during cutover phase.
- Next.js official docs basis: App Router Server/Client boundaries, dynamic segments, Server Actions/forms, external server-side fetch. Pin actual Next version only when project is created.