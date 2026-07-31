# Commands
Run from repository root unless stated.
- Start local stack: `docker compose up --build`
- Start backend only: `docker compose up backend`
- Check running services: `docker compose ps`
- Seed fresh DB: `docker exec -t creative-studio-backend sh -c "PYTHONPATH=/app uv run python -m bootstrap.bootstrap"`
- Backend full test/coverage gate: `docker compose exec backend uv run pytest tests -v --cov=src --cov-fail-under=80`
- Backend focused tests: `docker compose exec backend uv run pytest tests/<feature> -v`
- Frontend tests: `docker compose exec frontend npm test -- --watch=false`
- Frontend compile: `docker compose exec frontend npm run compile`
- Frontend build: `docker compose exec frontend npm run build`
- Full formatting/lint/license pipeline: `docker compose run --rm pre-commit run --all-files`
- Install Git hook: `cp pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit`
- Serena memory reference check: `serena memories check`