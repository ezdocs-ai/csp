# Creative Studio
- Google Cloud generative-media studio; monorepo with `backend/`, `frontend/`, `infra/`.
- Backend and frontend use feature-domain organization; keep changes inside owning feature.
- Local app and quality pipeline are Docker Compose based. Never run app Python or linters on host; never run local `gcloud` or modify cloud resources.
- Cloud targets: Cloud Run backend, Firebase Hosting frontend, Cloud SQL PostgreSQL; Terraform under `infra/`.
- Read backend structure and rules: `mem:backend/core`.
- Read frontend structure and rules: `mem:frontend/core`.
- Read versions/dependencies: `mem:tech_stack`.
- Read project coding rules: `mem:conventions`.
- Read runnable workflows: `mem:suggested_commands`; completion gate: `mem:task_completion`.