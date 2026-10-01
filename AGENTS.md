<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Repository agent workflow

GitHub Issues in `tiqloo/TimTracker-Web` are the source of truth for new web work. Before implementation, read the complete issue and acceptance criteria, this file, `README.md`, and relevant documentation. Check `git status`, the current branch and latest `master`; inspect the implementation, tests, and—when it clarifies earlier decisions—Git history. Determine what is already implemented and check linked dependencies before changing anything.

Never assume an issue starts at zero. Preserve working code and other agents' changes; do not reset, overwrite, or broadly reformat unrelated work. Coordinate overlapping files and process dependent issues sequentially. If product information or an external prerequisite is missing, record `BLOCKED / OPEN DECISION` on the issue instead of inventing a decision.

Use one issue per branch: `feature/<issue>-short-name`, `bugfix/<issue>-short-name`, or `technical/<issue>-short-name`. Do not develop features directly on `master`. Before merge, incorporate the current `master`, run `npm run lint`, `npm test`, and `npm run build`, and verify the issue acceptance criteria. Every PR uses `Closes #<issue>`, states decisions and risks, and reports exact commands/results. Keep secrets in ignored environment files or repository/environment secrets.
