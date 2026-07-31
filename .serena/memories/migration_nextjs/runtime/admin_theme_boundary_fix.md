# Admin dark-theme surface fix

Date: 2026-07-30

Root cause: component aliases such as `--tri-card-bg` and `--tri-input-bg` were computed on light root and inherited as resolved white values into nested dark layouts. Button's ambiguous font-size utility compiled as an invalid color declaration and forced inherited white text.

Fix: `[data-theme]` now recomputes theme-dependent component aliases and sets native light/dark color-scheme; Button uses explicit Tailwind `length:` and `color:` type hints; theme regression tests added.

Browser computed styles after fix: dark cards/inputs `rgb(8,42,34)`, `color-scheme: dark`, correct primary/secondary/ghost/danger foregrounds. Light fixture unchanged.

Validation: build/lint pass; 281 tests pass, 0 fail; scoped pre-commit and diff check pass. No cloud changes or commits.
