# Completion gate
1. Verify containers: `docker compose ps`; fix startup/health failures caused by task before proceeding.
2. Run focused tests for changed feature through Compose.
3. Run backend coverage gate when backend changed: `docker compose exec backend uv run pytest tests -v --cov=src --cov-fail-under=80`; requires >=80% across `src/`.
4. Run frontend tests and compile when frontend changed: `docker compose exec frontend npm test -- --watch=false` and `docker compose exec frontend npm run compile`.
5. Run repository quality pipeline: `docker compose run --rm pre-commit run --all-files`; fix task-caused failures until clean. It applies license headers, Black, pylint >=9.0, and GTS.
6. Review diff for scope, security, accidental duplication, generated artifacts, and undocumented behavior/workflow changes.
7. Never commit; leave diff for user review.