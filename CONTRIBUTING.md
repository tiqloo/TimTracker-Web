# Contributing

New work starts in a GitHub Issue. Search first, use the appropriate Issue Form, and provide acceptance criteria, edge cases, dependencies, and out-of-scope notes that let another coding agent work independently.

Use one branch per issue from current `master`: `feature/<issue>-short-name`, `bugfix/<issue>-short-name`, or `technical/<issue>-short-name`. Run `npm run lint`, `npm test`, and `npm run build`, then open a focused PR with `Closes #<issue>`. Merge only after review and required checks pass.

An issue is Done only when acceptance criteria are met, tests and build pass, documentation is current, no secrets or known regressions were introduced, and the reviewed PR is merged. Otherwise apply `status:blocked` with the concrete reason. Coding agents must follow `AGENTS.md`.
