# Documentation Index

**Last Updated**: 2025-11-07

This directory contains active guides and archived process documents, reports, and session summaries for the Impetus Lock project.

## Directory Structure

```
docs/
├── INDEX.md (this file)
├── archive/2026-09/ # Root historical reports and session records
├── process/          # Feature implementation process documents
├── reports/          # Validation, review, and analysis reports
└── sessions/         # Session summaries and status updates
```

## Process Documents (process/)

Implementation tracking and phase completion documents:

- **checkpoint.md** - Latest implementation checkpoint (Phase 5)
- **PHASE_4_COMPLETE.md** - Phase 4 (Sensory Feedback) completion summary
- **PHASE_5_INTEGRATION_COMPLETE.md** - Phase 5 (Integration & Polish) completion summary
- **US2_IMPLEMENTATION_COMPLETE.md** - User Story 2 implementation complete
- **US2_PROGRESS_SUMMARY.md** - User Story 2 progress tracking

## Validation Reports (reports/)

CI/CD validation and code quality reports:

- **ACT_CLI_VALIDATION_REPORT.md** - Act CLI local CI validation results
- **ACT_VS_GITHUB_ACTIONS_COMPARISON.md** - Comparison between Act and GitHub Actions
- **GITHUB_ACTIONS_ANALYSIS.md** - GitHub Actions workflow analysis
- **COMPREHENSIVE_REVIEW_REPORT.md** - Comprehensive code review and quality analysis
- **P0_CRITICAL_FIXES_SUMMARY.md** - Critical fixes summary (P0 priority)

## Session Summaries (sessions/)

Historical session progress and completion summaries:

- **COMPLETION_SUMMARY.md** - Overall feature completion summary
- **FINAL_SESSION_SUMMARY.md** - Final implementation session summary
- **IMPLEMENTATION_COMPLETE_SUMMARY.md** - Implementation completion details
- **IMPLEMENTATION_STATUS.md** - Implementation status tracking
- **SESSION_CONTINUATION_SUMMARY.md** - Session continuation context
- **PROJECT_STATUS_REPORT.md** - Project-wide status report

## Root Documentation (../)

Core project documentation remains in the root directory:

- **README.md** - Project overview and quickstart
- **CLAUDE.md** - Claude Code configuration and guidelines
- **DEVELOPMENT.md** - Development workflow and guidelines
- **TESTING.md** - Testing strategy and commands
- **API_CONTRACT.md** - API endpoint specifications
- **ARCHITECTURE_GUARDS.md** - Architecture enforcement rules
- **DEPENDENCY_MANAGEMENT.md** - Dependency security and management

Historical root reports are in [archive/2026-09/](archive/2026-09/).

## Historical Root Reports (archive/2026-09/)

The following reports retain their original facts and status as dated process records:

- [AI_INTEGRATION_STATUS.md](archive/2026-09/AI_INTEGRATION_STATUS.md) - AI integration status
- [ARCHITECTURE_SAFETY_NET_STATUS.md](archive/2026-09/ARCHITECTURE_SAFETY_NET_STATUS.md) - Architecture safety net status
- [E2E_FIX_SUMMARY.md](archive/2026-09/E2E_FIX_SUMMARY.md) - E2E debugging and fix summary
- [E2E_STABILITY_FIX.md](archive/2026-09/E2E_STABILITY_FIX.md) - E2E stability fix plan
- [E2E_TEST_STATUS.md](archive/2026-09/E2E_TEST_STATUS.md) - E2E execution status
- [FIX_PLAN.md](archive/2026-09/FIX_PLAN.md) - CI fix plan
- [READY_FOR_TESTING.md](archive/2026-09/READY_FOR_TESTING.md) - Historical testing readiness record
- [RESEARCH_FINDINGS.md](archive/2026-09/RESEARCH_FINDINGS.md) - CI and Poetry research findings
- [SESSION_SUMMARY.md](archive/2026-09/SESSION_SUMMARY.md) - Historical session summary
- [TEST_SUITE_EXAMPLES.md](archive/2026-09/TEST_SUITE_EXAMPLES.md) - Lock storage test examples
- [TEST_SUITE_SUMMARY.md](archive/2026-09/TEST_SUITE_SUMMARY.md) - Lock storage test suite summary

## Component Documentation (components/)

UI component reference and usage documentation:

- **catalog.md** - Complete component catalog with props, examples, and accessibility notes

## Developer Guides (guides/)

Developer-facing guides for common workflows:

- **troubleshooting.md** - Common issues and solutions for development and deployment
- **deployment.md** - Production deployment instructions with Docker and environment setup

## Feature Specifications (../specs/)

Feature planning and task breakdown:

- **specs/001-impetus-core/** - Core un-deletable lock system (P1)
- **specs/002-vibe-enhancements/** - Vibe enhancements (manual trigger + sensory feedback)

## Asset Organization

Audio assets have been moved to their correct location:

- **client/src/assets/audio/** - Audio files for sensory feedback
  - ✅ clank.mp3 (28.8 KB) - Provoke action sound
  - ✅ whoosh.mp3 (18.4 KB) - Delete action sound
  - ✅ bonk.mp3 - REJECT/lock block action sound

## Archive Purpose

These documents have been archived to keep the root directory clean and focused on active development documentation. They provide historical context and detailed tracking of the implementation process.

## Navigation Tips

- **For current status**: See root-level README.md, DEVELOPMENT.md, and TESTING.md
- **For implementation details**: Check process/ subdirectory
- **For validation results**: Check reports/ subdirectory
- **For historical context**: Check sessions/ subdirectory
- **For feature specs**: See ../specs/ directory
