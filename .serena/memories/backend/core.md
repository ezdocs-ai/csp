# Backend
- Python source: `backend/src/`; tests: `backend/tests/`; entrypoint: `backend/main.py`; migrations: `backend/alembic/`.
- Modular feature domains (`admin`, `audios`, `auth`, `brand_guidelines`, etc.). Feature folders co-locate controllers, services, DTOs, repositories, schemas.
- Shared primitives live in `backend/src/common/`; do not move feature behavior there without cross-feature need.
- FastAPI + Pydantic; async SQLAlchemy/asyncpg; PostgreSQL locally via Compose and Cloud SQL in deployment.
- Package/dependency source: `backend/pyproject.toml`; lockfile managed by uv.
- Async tests use `@pytest.mark.anyio`; global API/DB fixtures live in `backend/tests/conftest.py`.
- Run all Python/app commands through Docker Compose or `docker exec`; first verify containers are healthy.