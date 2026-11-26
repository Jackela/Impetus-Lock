# Documentation Index

**Last updated**: 2026-11-26

`AGENTS.md` is the authority for working rules and quality gates. The listed references lead to their governing configuration or implementation. Dated reports, session notes, archives and prior phase records are historical evidence.

## Start here

- [`README.md`](../README.md) — product overview and quick start
- [产品定义](../PRODUCT.md) · [首局功能设计](product/first-story.md) · [功能路线图](../ROADMAP.md) — agreed direction, example playthrough and milestone acceptance
- [产品研究 Wiki](../wiki/README.md) · [口述校正与挑战改写 ADR](adr/0001-voice-correction-and-challenge-permissions.md) — research sources and the rationale for separate permissions
- [`CONTEXT.md`](../CONTEXT.md) — current product and architecture context
- [`AGENTS.md`](../AGENTS.md) — precedence, protected files, quality gates, task routing
- [`DEVELOPMENT.md`](../DEVELOPMENT.md) — local development workflow
- [`TESTING.md`](../TESTING.md) — test setup, workflow coverage and revision-specific evidence
- [Branch protection](BRANCH-PROTECTION-SETUP.md) — required merge checks and GitHub source
- [Handoff instructions](../AGENTS.md#delivery-evidence-and-stop-conditions) — evidence and location for blocked work
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — contribution workflow
- [`SECURITY.md`](../SECURITY.md) — vulnerability reporting and security scope

## Reference

| Document                                                      | Purpose                                                         |
| ------------------------------------------------------------- | --------------------------------------------------------------- |
| [`API_CONTRACT.md`](../API_CONTRACT.md)                       | HTTP API contract                                               |
| [`ARCHITECTURE_GUARDS.md`](../ARCHITECTURE_GUARDS.md)         | Layering and architecture constraints                           |
| [`DEPENDENCY_MANAGEMENT.md`](../DEPENDENCY_MANAGEMENT.md)     | Dependency and upgrade policy                                   |
| [`openspec/`](../openspec/)                                   | Current specifications and change proposals                     |
| [`specs/README.md`](../specs/README.md)                       | Frozen legacy feature specs (001–007); OpenSpec supersedes them |
| [`docs/architecture-deep-dive.md`](architecture-deep-dive.md) | Architecture walkthrough                                        |
| [`docs/observability.md`](observability.md)                   | Logging, metrics, health checks                                 |
| [`docs/prompts.md`](prompts.md)                               | Prompt templates and evaluation entry points                    |

## Guides

- [`docs/guides/deployment.md`](guides/deployment.md) — current deployment guide
- [`docs/guides/troubleshooting.md`](guides/troubleshooting.md) — common development/deployment issues
- [`client/e2e/README.md`](../client/e2e/README.md) — E2E suites and failure evidence

## Components

- [`docs/components/catalog.md`](components/catalog.md) — component catalog, props, accessibility
- [`docs/components/audio-feedback.md`](components/audio-feedback.md) — audio feedback reference

## Security

- [`docs/security/byok-storage.md`](security/byok-storage.md) — BYOK storage and threat model
- [`docs/security/SECRETS_MANAGEMENT.md`](security/SECRETS_MANAGEMENT.md) — secret handling and rotation
- [`docs/process/qa-privacy-checklist.md`](process/qa-privacy-checklist.md) — privacy review checklist

## Maintenance

- [`docs/maintenance/authenticated-editor.md`](maintenance/authenticated-editor.md) — authenticated editor runbook
- [`docs/maintenance/muse-loki-stories.md`](maintenance/muse-loki-stories.md) — Muse/Loki story evaluation

## Agent notes

- [`docs/agents/domain.md`](agents/domain.md) — domain vocabulary
- [`docs/agents/issue-tracker.md`](agents/issue-tracker.md) — issue routing and local evidence rules
- [`docs/agents/triage-labels.md`](agents/triage-labels.md) — label conventions

## Technical designs

- [`docs/technical-designs/P1_FIX_DESIGN_01_provider_registry.md`](technical-designs/P1_FIX_DESIGN_01_provider_registry.md)
- [`docs/technical-designs/P1_FIX_DESIGN_02_transaction_filter.md`](technical-designs/P1_FIX_DESIGN_02_transaction_filter.md)

## Dated reports and migration records

- [`docs/MIGRATION_v1_to_v2.md`](MIGRATION_v1_to_v2.md) — v1 to v2 migration record
- [`docs/investigation-report.md`](investigation-report.md) — investigation record
- [`docs/reports/20261111-test-suite-optimization.md`](reports/20261111-test-suite-optimization.md) — PR #249
- [`docs/reports/20261109-quality-roadmap.md`](reports/20261109-quality-roadmap.md) — PR #246
- [`docs/reports/COMPREHENSIVE_REVIEW_REPORT.md`](reports/COMPREHENSIVE_REVIEW_REPORT.md)
- [`docs/reports/P0_CRITICAL_FIXES_SUMMARY.md`](reports/P0_CRITICAL_FIXES_SUMMARY.md)
- [`docs/reports/ACT_CLI_VALIDATION_REPORT.md`](reports/ACT_CLI_VALIDATION_REPORT.md)
- [`docs/reports/ACT_VS_GITHUB_ACTIONS_COMPARISON.md`](reports/ACT_VS_GITHUB_ACTIONS_COMPARISON.md)
- [`docs/reports/GITHUB_ACTIONS_ANALYSIS.md`](reports/GITHUB_ACTIONS_ANALYSIS.md)

## Historical (not current status)

### 2026-11 archive

- [`docs/archive/2026-11/README.md`](archive/2026-11/README.md) — manifest of root docs retired in 2026-11
- `prd.json`, `CLAUDE-2025.md`, and the retired guides listed there

### 2026-09 archive

- [`docs/archive/2026-09/`](archive/2026-09/) — root reports, E2E snapshots, CI research, test summaries

### Dated process and session notes

- [`docs/process/`](process/) — phase completion and checkpoint notes
- [`docs/sessions/`](sessions/) — historical session summaries and status reports

## Navigation rules

1. Product direction and milestones: [PRODUCT.md](../PRODUCT.md) and [ROADMAP.md](../ROADMAP.md). Use dated reports as evidence for the recorded revision.
2. Agreed behavior: `openspec/specs/`. Check implementation and runtime evidence separately.
3. Historical context: `docs/archive/`, `docs/reports/`, `docs/sessions/`, and dated `docs/process/` notes.
4. Do not cite archived material as a current requirement.
