# Feature Specifications

> **Frozen legacy specs.** These 001–007 specifications document completed features and are kept for history. Do not update them as current requirements. Current specifications and change proposals live in [`openspec/`](../openspec/).

This directory contains feature specifications following the Spec-Driven Development (SDD) workflow.

## Specification Index

| ID  | Feature                                             | Status      | Priority | Description                             |
| --- | --------------------------------------------------- | ----------- | -------- | --------------------------------------- |
| 001 | [Impetus Core](001-impetus-core/)                   | ✅ Complete | P1       | Core un-deletable constraint system     |
| 002 | [Vibe Enhancements](002-vibe-enhancements/)         | ✅ Complete | P2       | Manual trigger, sensory feedback        |
| 003 | [Vibe Completion](003-vibe-completion/)             | ✅ Complete | P3       | API error feedback, animation queue     |
| 004 | [E2E Workflow Fix](004-fix-e2e-workflow/)           | ✅ Complete | -        | CI/CD pipeline fixes                    |
| 005 | [Markdown Toolbar](005-markdown-toolbar/)           | ✅ Complete | P4       | Floating formatting toolbar             |
| 006 | [Responsive Design](006-responsive-design/)         | ✅ Complete | P4       | Mobile-friendly layout                  |
| 007 | [Chrome DevTools Audit](007-chrome-devtools-audit/) | ✅ Complete | -        | Performance audit（见 `COMPLETION.md`） |

## Specification Structure

Each feature directory contains:

```
NNN-feature-name/
├── spec.md          # User requirements and acceptance criteria
├── plan.md          # Implementation plan with constitutional check
├── tasks.md         # Task breakdown with TDD requirements
├── quickstart.md    # Developer guide to get started
├── research.md      # (optional) Technical research notes
└── COMPLETION.md    # (optional) Final implementation summary
```

## Priority Levels

- **P1**: Un-deletable constraint (core vibe) - TDD mandatory
- **P2**: UX enhancements - TDD recommended
- **P3**: Polish and completion - TDD optional
- **P4**: Foundational/auxiliary features - TDD optional

## Related Documentation

- [Constitution](../CLAUDE.md#constitutional-requirements-️) - Project governance (5 articles)
- [CLAUDE.md](../CLAUDE.md) - AI assistant operational guide
- [DEVELOPMENT.md](../DEVELOPMENT.md) - Development workflow
