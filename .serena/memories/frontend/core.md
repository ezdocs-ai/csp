# Frontend
- Angular app source: `frontend/src/`; feature UI under `frontend/src/app/`; static assets in `frontend/public/` and `frontend/src/assets/`.
- NgModule-based app: generated components/directives/pipes are not standalone; component styles use SCSS; selector prefix `app`.
- State and computed values must use Angular Signals.
- API calls belong in services; components must not call `fetch` or `HttpClient` directly.
- Strict TypeScript and strict Angular templates enabled.
- Development config replaces `environment.ts` with `environment.development.ts`; local server uses `frontend/proxy.conf.json`.
- SSR/prerender enabled for builds but disabled in development.