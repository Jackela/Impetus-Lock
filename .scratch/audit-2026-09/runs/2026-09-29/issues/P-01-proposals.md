# P-01: Draft remaining architecture and major-migration proposals

Tier3, drafting only. Ready. Read current OpenSpec instructions/specs and all run audit reports/dependabot snapshot. Never implement or mark tasks approved/completed.

## Allowed files

Only new openspec/changes/<id>/{proposal.md,tasks.md,design.md,specs/**/spec.md} and run proposal-index.md. No current spec changes, code, dependency metadata, archived changes or ADR marked accepted.

## Drafts required

1. complete-collaboration-authorization: existing tasks as persisted collaborative documents; explicit owner/read/write/admin checks and permission persistence with migration, or alternative to withdraw unsupported endpoints. Recommend reusing task identity with explicit sharing records over a parallel document entity; no implementation. Explain current false-success permission endpoint and absent schema.
2. refactor-remaining-route-service-boundaries: only current style/profile/history/stats/achievements and relevant collaboration domain operations; characterize current public contracts and extract just necessary service/repository seams. Compare against leaving simple HTTP mapping in routes; avoid generic framework.
3. complete-authenticated-editor-entry: current active App has no AuthProvider/login entry despite protected backend. Propose using existing auth components/client contract, explicit loading/login/logout/session expiry and locally cached draft handling. Do not couple this proposal to restoring existing cookie/CSRF transport bug.
4. migrate-client-development-toolchain: coordinate Vite8+plugin-react6, ESLint10+Hooks7 flat config, lint-staged17 root/client ownership and runtime intersection, Node types26 support choice. Separate task groups and rollback; link all six client Dependabot PRs, explain green CI vs functional evidence. Recommend coordinated Vite pair and separately validated lint/typing changes, not one blind upgrade.
5. migrate-backend-test-and-redis-dependencies: pytest9 collection_path migration and redis-py8 lifecycle changes as independent task groups; Python3.11/3.12 and realRedis tests required before future approval/implementation. Link PR172/185.

Every draft must have concrete problem, recommended scope, meaningful alternatives, affected specs/interfaces, acceptance scenarios, migration/rollback and explicitly proposed/not approved status. Use existing spec capability names where appropriate and add new focused ones only when needed. Use CLI0.23.0: npm exec --yes --package=@fission-ai/openspec@0.23.0 -- openspec validate <change-id> --strict --no-interactive. Validate each and fix syntax until strict passes. Report semantic open decisions as proposal approval choices, never invent approvals. No network writes or installation into repo; npm CLI cache permitted. Depth1 no delegation, no commit; main integrates.
