# Documentation Index

**Last Updated**: 2025-11-07

This directory contains archived process documents, reports, and session summaries for the Impetus Lock project.

## Directory Structure

```
docs/
├── INDEX.md (this file)
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
- **act-full-run.log** - Full Act CLI execution log

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
- **ARCHITECTURE_SAFETY_NET_STATUS.md** - Architecture safety net status
- **DEPENDENCY_MANAGEMENT.md** - Dependency security and management
- **PROJECT_SUMMARY.md** - High-level project summary
- **QUICKSTART_TESTING.md** - Quick testing guide
- **READY_FOR_TESTING.md** - Testing readiness checklist

## Feature Specifications (../specs/)

Feature planning and task breakdown:

- **specs/001-impetus-core/** - Core un-deletable lock system (P1)
- **specs/002-vibe-enhancements/** - Vibe enhancements (manual trigger + sensory feedback)

## Asset Organization

Audio assets have been moved to their correct location:

- **client/src/assets/audio/** - Audio files for sensory feedback
  - ✅ clank.mp3 (28.8 KB) - Provoke action sound
  - ✅ whoosh.mp3 (18.4 KB) - Delete action sound
  - ⚠️ bonk.mp3 - Still needed for REJECT action

## Archive Purpose

These documents have been archived to keep the root directory clean and focused on active development documentation. They provide historical context and detailed tracking of the implementation process.

## Navigation Tips

- **For current status**: See root-level README.md and READY_FOR_TESTING.md
- **For implementation details**: Check process/ subdirectory
- **For validation results**: Check reports/ subdirectory
- **For historical context**: Check sessions/ subdirectory
- **For feature specs**: See ../specs/ directory
