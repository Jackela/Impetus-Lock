# Domain Docs

This repo uses **single-context** domain documentation: root `CONTEXT.md` and `docs/adr/`.

## Before exploring

Read `CONTEXT.md` and ADRs in `docs/adr/` that touch the area being changed. If they do not exist, proceed silently. The `domain-modeling` skill creates them lazily when terms or consequential decisions are resolved; setup does not create empty domain documents.

## Vocabulary and decisions

Use the glossary's domain terms in tickets, proposals, tests, and code. Flag a missing term for `domain-modeling` when it represents a real gap. If an intended change conflicts with an ADR, identify the ADR and explain the conflict before choosing a new direction.

## Relationship to OpenSpec

`CONTEXT.md` defines vocabulary; ADRs record decisions. `openspec/specs/` owns current specifications and `openspec/changes/` owns proposed changes. Follow `openspec/AGENTS.md` for proposals and approval. Domain documentation and ticket readiness do not replace approval.
