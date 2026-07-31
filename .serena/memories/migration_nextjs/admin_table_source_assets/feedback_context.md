# Admin UI feedback context

Date: 2026-07-30

User feedback:
1. AI Models/AI Providers table view still looks poor. Revise table and related controls according to `frontend-next/tridorian-agent-instructions.md`, whose source of truth is `tridorian-agent-theme-v3.json`.
2. `/admin/source-assets` shows no loaded data; investigate and fix root cause.

Constraints:
- Semantic tokens only, no raw palette values.
- Accessibility, hierarchy, responsiveness, brand consistency before polish.
- Dark data-console canvas is acceptable; luminous green scarce, violet for AI/info, coral only destructive.
- 44px targets, focus-visible tokens, sentence case, one dominant primary action.
- Preserve API contracts and CRUD behavior unless contract mismatch is the root bug.
- Use authenticated browser/network evidence for source-assets before fixing.
- No new dependencies, cloud/infra changes, or commits.