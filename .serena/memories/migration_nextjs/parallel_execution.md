# Parallel execution schedule
No sub-agents. This is coordination plan for independent human/automation workers.
## Ownership rules
- Lane 0 Integration owns `frontend-next/src/app/layout*`, global styles/tokens, `src/lib/{api,auth,workspace}`, `src/components/ui`, config, package/lock files, Docker/CI/infra. Other lanes never edit these.
- Feature lane owns one `src/features/<domain>/`, its route leaf, tests, fixtures. Shared need becomes request to Lane 0; no duplicate primitive.
- Backend Contract lane may add OpenAPI contract fixtures/tests only; no feature logic changes unless parity exposes confirmed bug.
- Visual QA lane owns screenshots/baselines/test specs, not feature implementation.
## Wave 0 — sequential bootstrap
Lane 0: scaffold Next.js, token pipeline from theme JSON, design-system primitives, secure auth/session, typed OpenAPI client, workspace shell, Docker/CI. Exit: lint/typecheck/unit/build + theme visual fixture + auth security tests.
## Wave 1 — 4 concurrent lanes
- A Gallery read/detail + media card/lightbox.
- B Workspace create/invite/switch + brand guideline.
- C Templates catalog/use.
- D Visual QA/accessibility harness and Angular parity fixtures.
Dependencies: Wave 0 only. Integration merge order D harness, B workspace, A gallery, C templates.
## Wave 2 — 4 concurrent lanes
- A Gallery mutations/tags/copy/download/restore.
- B Image studio + shared generation form/media inputs.
- C Admin shell/dashboard/users.
- D Source-assets shared upload/crop/select primitives and admin source-assets.
Dependencies: gallery read, workspace, token primitives. Merge D before B because image consumes upload/select.
## Wave 3 — 4 concurrent lanes
- A Upscale using shared asset picker/job polling.
- B Audio studio/player.
- C VTO using shared media inputs.
- D Admin templates/tags/gallery moderation.
Dependencies: image/shared generation and source assets. Merge independently after shared API types fixed.
## Wave 4 — 3 concurrent lanes
- A Video core modes/generation.
- B Video advanced edit/extend/concatenate/Omni references.
- C Workflow list/history/details + workflow schema primitives.
A and B must have disjoint files: A owns form/generation route; B owns advanced action components/hooks. Integration merge A then B.
## Wave 5 — 3 concurrent lanes
- A Workflow editor form/steps/dependency graph.
- B Workflow run/single/batch CSV/media resolution.
- C Workbench pure timeline model/tests.
Dependencies: workflow schema primitives and media selectors. A/B coordinate typed schema but own disjoint editor vs execution trees.
## Wave 6 — 3 concurrent lanes
- A Workbench interactive UI/render integration.
- B Full cross-feature Playwright/a11y/security/performance parity.
- C Deployment/Cloud Run/Terraform/CSP/CORS/canary config.
Dependencies: all feature waves. C may prepare config earlier but merges after runtime behavior proven.
## Per-lane handoff
1. Sync exact integration SHA and record it.
2. Confirm write-set has no overlap.
3. Implement smallest vertical slice against generated API contracts and design mapping.
4. Run focused tests, lint, typecheck, production build; capture desktop/mobile light/dark evidence.
5. Rebase onto integration; rerun checks.
6. Integration owner reviews API contract, design checklist, security, accessibility, and parity; merges serially.
## Conflict prevention
- Lock package/lock/config/global token files to Lane 0.
- One route leaf owner at a time.
- Generated OpenAPI and token outputs updated centrally, then all lanes resync.
- Shared component change lands before dependent feature code.
- No lane creates alternate auth, API, toast, dialog, upload, media-card, or polling abstraction.
## Critical path
Wave 0 foundation -> workspace/source assets/media primitives -> image studio -> video/VTO -> workflow editor -> workbench/cutover. Gallery/admin/templates can fill parallel capacity without blocking critical path.