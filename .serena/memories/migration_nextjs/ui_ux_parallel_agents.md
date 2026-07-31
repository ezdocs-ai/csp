# Multi-agent execution for UI/UX parity recovery

Read `mem:migration_nextjs/ui_ux_parity_recovery` first. This plan supersedes the prior no-sub-agent note and design-system-first feature schedule for parity work.

## Coordination rules
- Lead agent owns sequencing, Serena matrix synthesis, shared-file integration, validation, and final decisions.
- Each agent receives a self-contained prompt: exact routes, authenticated-tab constraints, expected artifacts, relevant known paths, and explicit write set.
- Discovery agents are read-only: browser, screenshots, code inspection, Serena findings. They do not edit product code.
- Implementation agents get disjoint write sets. Never let two agents edit the same route, component, global CSS, shared primitive, package/config, or generated file concurrently.
- Shared needs are reported to the lead; only Shared UI agent edits shared components/styles. Feature agents consume them after the shared change lands.
- No branches/commits unless user explicitly requests them. Agents edit the same workspace only in strictly disjoint directories; lead serializes shared changes.
- Reuse each agent session for follow-ups. Do not spawn duplicate agents for unresolved work.

## Serena communication
Each agent reads this memory plus parity recovery. Findings are returned to lead and persisted under one route memory namespace, e.g. `migration_nextjs/parity_routes/video`, containing screenshots names, interactions, file mapping, mismatches, blockers, and confidence. Only lead writes the consolidated matrix to avoid concurrent memory overwrite. Agents may be instructed to write uniquely named route memories when write ownership is unambiguous.

## Phase A — parallel read-only discovery
Spawn 5 agents in parallel; no overlapping browser tabs. Because browser state is shared/risky, assign one Browser Operator and make the other agents code-only.

1. Browser Operator (all routes, Playwright)
   - Owns both existing tabs during run.
   - Navigates Angular only via visible UI/router interactions; never direct reload.
   - Captures paired screenshots and interactive states at 1440x1000 and critical mobile paths.
   - Records redirects/data-state invalidations; does not claim invalid pairs.

2. Shell/Workspace Code Analyst
   - Angular header, workspace switcher, profile, menus, navigation, footer, responsive behavior.
   - Next layouts, sidebar/topbar/workspace provider/switcher/UI primitives.
   - Produces exact behavioral/file gap map.

3. Generation Code Analyst
   - Image, Video, Audio, VTO, Upscale templates/SCSS/components/services versus Next routes/features/hooks.
   - Identifies reusable Angular interaction patterns and retained Next logic.

4. Content Code Analyst
   - Gallery, templates, media detail, cards, overlays/lightbox, filters, bulk actions versus Next.

5. Complex/Admin Code Analyst
   - Workbench, workflows, admin routes, role guards, dashboards/tables/dialogs versus Next.

Lead synthesizes these outputs into the route matrix and dependency graph. This is divide-and-conquer without duplicate browser work.

## Phase B — shared implementation (mostly sequential)
One Shared UI agent owns only:
- `frontend-next/app/(studio)/layout.tsx` and relevant admin/root layouts approved by lead
- shared global shell styles approved by lead
- `frontend-next/src/components/ui/**`
- workspace switcher/menu shared files

Scope: Angular-faithful shell, header, workspace/profile menus, nav/sidebar/toggle behavior, Tooltip, Popover/Menu/Dialog/Toggle interactions, focus/hover states. Lead validates with Browser Operator before feature agents begin. Package/config changes remain lead-only.

## Phase C — parallel feature implementation
After shared contracts stabilize, spawn disjoint lanes:

- Agent Image: `frontend-next/src/features/image-studio/**`, image route leaf, focused tests.
- Agent Video: `frontend-next/src/features/video/**`, video route leaf, focused tests.
- Agent Audio/VTO/Upscale: only those three feature directories/routes; split into separate agents if large.
- Agent Gallery/Templates: gallery/templates/detail feature directories/routes.
- Agent Workflows: workflow feature/routes only.
- Agent Workbench: workbench feature/route only.
- Agent Admin: admin feature/routes only after role access works.

Feature agents must not alter shared UI/global styles. If a shared primitive is insufficient, they report a minimal API change; lead assigns it to Shared UI agent, validates, then resumes feature work.

## Phase D — independent review
Spawn fresh read-only reviewers in parallel:
1. Visual reviewer: paired screenshot/layout hierarchy and responsive parity.
2. Interaction/a11y reviewer: hover tooltips, keyboard/focus, menus/dialogs/toggles, 44px targets.
3. Code/runtime reviewer: hydration loops, state carry, API behavior, errors/security.

Lead fixes only verified regressions, then reruns focused and broad validation.

## Agent handoff template
Each agent returns:
- Scope and exact files inspected/changed.
- Angular behavior and Next behavior.
- Screenshot artifact names or code evidence.
- Mismatches fixed and intentionally deferred.
- Tests/diagnostics run with results.
- Remaining blocker/shared dependency.
- Confidence and reasons; never claim parity without paired evidence.

## Merge/integration order
1. Runtime/auth/admin blockers.
2. Shared shell/workspace/interactions.
3. Shared generation workspace primitives.
4. Image and Video.
5. Audio/VTO/Upscale and Gallery/Templates in parallel.
6. Workflows/Workbench/Admin in parallel.
7. Independent review and full Playwright parity run.

## Conflict prevention
- Lead keeps a write-set ledger before spawning each implementation agent.
- One owner per route leaf and feature directory.
- Global CSS, shared UI, auth/workspace core, package/lock/config are exclusive.
- Browser Operator is the only agent using live shared tabs during discovery/review.
- Agents never add alternative tooltip/menu/dialog/workspace abstractions inside feature folders.
- Lead integrates and validates serially after each shared contract change.