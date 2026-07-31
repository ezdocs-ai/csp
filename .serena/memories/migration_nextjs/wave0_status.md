# Wave 0 status
## Done
- Scaffold: Next 16.2.11 + React 19.2.4 + Tailwind v4 + TS strict (pre-existing).
- Tokens pipeline: `frontend-next/src/styles/tokens.css` (`--tri-*` vars, `[data-theme="light|dark"]`, default light in `:root`). `app/globals.css` rewritten with `@theme inline` Tailwind bindings, focus-visible rule, reduced-motion block. `app/layout.tsx` loads Space Grotesk/Inter/Readex Pro/JetBrains Mono via next/font, sets metadata, inline theme-init script (no FOUC). NO providers in layout yet.
- OpenAPI client: `frontend-next/openapi.json` (live export, 62 paths, 140 schemas). `frontend-next/scripts/gen-api.ts` (bunx openapi-typescript). `frontend-next/src/lib/api/{types,client,errors,index}.ts`. Native fetch wrapper, `createApiClient({ baseUrl, fetchImpl, getHeaders })`, blob helper, normalized `ApiError`. Server `BACKEND_URL` + public `NEXT_PUBLIC_API_BASE_URL`. No new runtime deps.
- Parity matrix: `mem:migration_nextjs/parity_matrix` (22 routes, 48 journeys).
- package.json: added `openapi-typescript ^7` devDep, `gen:api` script.
- `bun install`, `bun run lint`, `bun run build` all pass.

## Wave 0 COMPLETE + INTEGRATION DONE
Root layout wires ToastProvider + WorkspaceProvider. Route groups scaffolded: `app/(public)/login`, `app/(studio)`, `app/(admin)/admin`. Session extended with `idToken` for BFF forwarding. `src/lib/api/server.ts` exports `getServerApiClient()` + `requireApiClient()`. Login page (GIS + FedCM), studio shell (Sidebar + Topbar), admin role gate all wired.

Routes live: `/`, `/_not-found`, `/admin`, `/login`. Middleware protects all except `/login`, `/api/*`, `/_next/*`.

Bug fixed: auth routes were in `src/app/api/` (wrong — Next uses `app/`). Moved to `app/api/`. `src/app/` deleted.

Playwright devDep + chromium installed for Wave 1 Lane D.

All foundation lanes landed and integrated:
- Auth: `src/lib/auth/{session,verify,server,gis}.ts`, `app/api/auth/{login,logout,csrf}/route.ts`, `middleware.ts`, session test. Deps added: `jose@6`, `google-auth-library@10`. HttpOnly Secure SameSite=Lax cookie, HS256 15min TTL, jti rotation, CSRF double-submit. Middleware protects (studio)/(admin) groups; full session verify server-side.
- UI primitives: `src/components/ui/{button,icon-button,card,input,field,badge,table,dialog,toast,toast-provider,tooltip,sidebar,topbar,empty-state,index,_smoke}.tsx`. All consume `--tri-*` tokens; native dialog element; ToastProvider Context; 44px targets; license headers added.
- Workspace: `src/lib/workspace/{active,api,context,index}.ts` + active.test.ts. URL > localStorage(`activeWorkspaceId`) > default precedence. Provider is Client Component, accepts SSR initial props.
- Docker/CI: `frontend-next/Dockerfile` (Node 20 alpine non-root, PORT=8080, `next start` — standalone TODO), `Dockerfile.dev` (bun dev, port 3000), `.dockerignore`, `.github/workflows/frontend-next.yml` (bun install/gen:api/lint/test/build), docker-compose.yml `frontend-next` service, `.pre-commit-config.yaml` addlicense now covers .tsx.
- next.config.ts: `output: "standalone"` added (Dockerfile runner stage still uses `next start` — switch to `.next/standalone` copy + `node server.js` in cutover).
- Token gap fixed: `--tri-toast-placement: top right` added to both schemes.
- Login route type fix: `const roles: Role[]` explicit annotation.

## Validation (all green)
- `bun install`, `bun run lint`, `bun run build`, `bun test` (8 pass / 0 fail).
- `docker compose run --rm pre-commit run addlicense` — Passed (headers added).

## Unresolved decisions
- Backend contract work needed for session assertion vs forwarded Google ID token (see `gcp_auth` step 6). Defer until auth lane implements server-side; pick smallest change first.
- Feature flags/traffic split/rollback to Angular not yet defined (Phase 0.4).
