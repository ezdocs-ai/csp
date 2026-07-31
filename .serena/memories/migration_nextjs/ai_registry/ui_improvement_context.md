# AI registry UI improvement context

User feedback (2026-07-30):
- `/admin/ai-models` currently renders a large centered `LoadingState` above an already-populated raw table; screenshot shows excessive empty vertical space and redundant waiting feedback.
- User requests improved table UI for both `/admin/ai-models` and `/admin/ai-providers`.

Scope:
- Inspect and improve only AI Models/AI Providers Admin client UI and directly shared primitives if essential.
- Preserve API contracts and existing CRUD behavior.
- Prefer existing Admin Table/Button/Badge/EmptyState patterns and design tokens.
- Loading UX should be compact when stale/initial rows are already available; an empty initial load may use a shaped table skeleton or compact state.
- No dependencies, cloud, infra, or commits.

Review the live files rather than assuming implementation details.