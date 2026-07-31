# React Flow full-screen workflow canvas — planning context

Date: 2026-07-30
Status: DISCOVERY

User request:
- Revamp workflow creation/editing into a node-based canvas inspired by the supplied reference image.
- Use React Flow (`@xyflow/react`).
- Workflow creation must use a full-screen canvas rather than the normal page/table shell.
- Write the implementation plan to Serena memory first; review before any code changes.

Planning constraints:
- Follow `frontend-next/tridorian-agent-instructions.md` and `tridorian-agent-theme-v3.json`.
- Preserve current backend workflow schema, execution behavior, auth, and API contracts unless a clearly identified migration is necessary.
- Existing Next.js/React workflow editor code must be audited before proposing architecture.
- No code edits, dependencies, cloud/infra changes, or commits in this planning task.
- Plan must cover routes/layout, React Flow architecture, node/edge model, palette, inspector, persistence/migration, validation, execution, accessibility, responsive behavior, tests, rollout, and risks.