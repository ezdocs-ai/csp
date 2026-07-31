# Admin Server Component HTML-as-JSON fix

Date: 2026-07-30

## Root cause
`/admin/users`, `/admin/ai-models`, and `/admin/ai-providers` Server Components made absolute same-origin fetches to their own `/api/admin/*` Route Handlers without forwarding the incoming session cookie. `requireRole` redirected the unauthenticated internal request to `/login`; fetch followed the redirect and returned login HTML with HTTP 200. `response.ok` was true and `response.json()` threw `Unexpected token '<'`.

## Fix
Removed the unnecessary self-fetches. All three Server Components now use the existing server-only `requireApiClient()` and call the backend directly with the session ID token in the server-side Authorization header:
- users → `/api/users?...`
- AI models → `/api/admin/ai-models`
- AI providers → `/api/admin/ai-providers`

This matches Next.js guidance to call data sources directly from Server Components, removes the extra HTTP hop, cannot follow a login redirect to HTML, and never exposes tokens to client components. Existing BFF Route Handlers remain for browser/client mutations.

The dashboard self-fetch remains intentionally because it already forwards the cookie and aggregates six routes correctly.

## Validation
- production build: pass
- lint: pass
- unit suite: 282 pass, 0 fail, 624 assertions, 45 files
- diagnostics: clean for all changed pages
- scoped pre-commit: pass
- diff check: pass
- final security review: no blockers (`mem:migration_nextjs/runtime/admin_server_fetch_final_review`)

No cloud changes or commits performed.
