# Angular-to-Next.js migration analysis
- Goal: deep-dive every existing feature's logic, then produce migration plan into Next.js project.
- Source project: Creative Studio monorepo. Preserve FastAPI backend unless evidence supports replacement; user asked migration "into Next.js project", currently interpreted as frontend migration pending architecture findings.
- Analysis must cover frontend routes/components/services/state, backend APIs/domain workflows/data/auth/cloud integrations, and infra/runtime constraints.
- Deliver plan in chat and durable Serena memories; no explanation `.md` files.
- Mandatory design references: `frontend-next/tridorian-design-system.html`, `frontend-next/tridorian-agent-theme-v3.json`, `frontend-next/tridorian-agent-instructions.md`.
- User prohibited sub-agent use. Parallel plan describes human/worker lanes only; do not spawn sub-agents.
- Current stack/index details: `mem:core`, `mem:backend/core`, `mem:frontend/core`, `mem:tech_stack`.