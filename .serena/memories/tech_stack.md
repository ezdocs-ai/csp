# Toolchain
- Backend: Python >=3.12, uv, FastAPI >=0.118, Pydantic >=2.11.10, SQLAlchemy async >=2, asyncpg, Alembic, pytest/pytest-cov. AI/cloud: Google Gen AI, Vertex AI, Firebase Admin, GCS, Cloud Tasks/Workflows.
- Frontend: Angular 18.2, TypeScript ~5.5.2, RxJS 7.8, Angular Material/CDK, AngularFire, Tailwind CSS 3.4, Karma/Jasmine, GTS 6.
- Database: PostgreSQL 15 Alpine locally; Google Cloud SQL deployment.
- Infra: Terraform >=1.13.0, modules for platform, Cloud Run, Firebase Hosting, PostgreSQL, Secret Manager.
- Runtime/orchestration: Docker Compose; backend Uvicorn, frontend Angular CLI dev server.
- Formatting/lint: Black line length 80, pylint >=9.0 score, GTS, Prettier, addlicense.