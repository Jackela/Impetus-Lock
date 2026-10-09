<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# Current AI working agreement

Read [CONTEXT.md](CONTEXT.md), [DEVELOPMENT.md](DEVELOPMENT.md), and the applicable OpenSpec requirement before changing behavior. This file is the shared entry for all coding agents; CLAUDE.md points here. Historical sprint reports are evidence, not current status.

- Work from the triggering commit on an isolated branch; preserve other worktrees and uncommitted work.
- Restore specified behavior directly for bugs. New behavior or architecture needs an approved OpenSpec proposal; existing approval remains valid within its scope.
- Keep changes simple and framework native. Reserve P1 for lock enforcement; write a failing test before changing critical behavior.
- Preserve component → hook → service boundaries and backend API → application → domain contracts. Keep public JSDoc and Python docstrings. Never commit credentials or local investigation records.
- AI-first maintenance means executable checks and structured source are authoritative; use reproducible scripts and APIs for repeatable work. Human review still owns significant product decisions and release approval.
- Run frontend lint, formatting, full type checks, tests/critical coverage and build; run backend Ruff, pydocstyle, mypy, import contracts and tests/critical coverage as defined by current package files and CI. Do not disable gates to obtain green results. Validate changed workflow syntax with actionlint.
- Authentication acceptance uses real cookies/CSRF and a normal browser against isolated data. Test bypasses or disabled browser security cannot prove acceptance. Stub paid model requests at the test boundary.
- Report source/base/head SHAs, executed checks, observed failures and specific unverified environments. A local pass or merged PR is not deployment or user acceptance.

The original constitutional requirements and sprint notes are retained in [the historical guide](docs/archive/CLAUDE-2025.md). Their simplicity, critical-path testing, architecture and documentation constraints remain effective; the five-day schedule and dated status sections do not describe the current project.
