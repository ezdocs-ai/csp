# Conventions
- Architecture: feature-driven, hexagonal-inspired; modules interact through services and DTOs. Prefer high cohesion and low coupling.
- Python follows Google Python Style Guide; Black line length 80; pylint score must remain >=9.0.
- TypeScript follows Angular and Google TypeScript guides; strict compiler and template checks enabled; GTS controls TS style.
- Angular state uses Signals. Async/stream operations require `try/catch` and useful error logging. HTTP calls live in services.
- Add Apache 2.0 Google LLC license headers to `.py`, `.ts`, `.scss`, `.html`, `.css`, `.js`, `.sh` files; pre-commit enforces this.
- Prefer minimal feature-local edits. Do not change unrelated files, commit changes, run host linters, run local gcloud, or modify cloud resources.
- Update existing relevant documentation when behavior or workflow changes; do not create explanation-only files.