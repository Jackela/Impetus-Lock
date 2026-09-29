# R22: Synchronize loaded editor content across initialization

Tier2. Ready. Finding V03-05 (main follow-up to V03-04). Baseline92e8efe. Existing R12 caller wiring remains separately held in client lane; do not copy/change it.

## Evidence and expected behavior

Actual App regression in R12-main-after-r13.log: after creating/selecting a task, the real editor shows the default story rather than loaded task content. EditorCore's content effect returns while editorRef is unavailable and does not rerun on readiness; lastContentVersion initialized to0 also hides a newly loaded task whose real backend create version is0. Initial loading must display the current task's supplied Markdown/locks, not a placeholder. This is existing content-loading correctness, not new UI/architecture.

## Allowed scope

client/src/components/Editor/EditorCore.tsx and focused real-editor tests for this boundary (new EditorCore.loading.test.tsx or existing relevant contract tests). No App, task-sync, API, dependency, config, module architecture or public prop change.

## Pre-approved test seam

Render actual EditorCore/Milkdown and inspect real ProseMirror document/view through public onReady callback/DOM. Exercise props arriving before editor readiness (controlled delayed initialization via public/library boundary if required) and after readiness; include version0 from actual create schema, nonzero version changes, locks and uncontrolled contentVersion=undefined behavior. Do not fabricate whole editor mocks/casts.

## Acceptance

1. Latest supplied controlled task Markdown/locks are reflected when editor becomes ready even if they arrived during initialization, including same initial version0.
2. Ordinary unrelated rerenders and unchanged controlled props do not overwrite actual local typing or remount/reset the editor; undefined contentVersion retains existing initial-only behavior.
3. Initial server-content reconciliation does not manufacture a user edit/save loop; genuine user/AI edits still notify through existing onChange. Existing native lock filters, plugin set, Markdown markers, selection safety and undo behavior remain valid.
4. Current actual App creation regression in the separate R12 lane must pass after this ticket is integrated without weakening its content/selection assertions. Main owns that integration check.

## Execution and gates

Fresh depth1 context, no delegation, no remote writes, no commits/branch switching. Main alone integrates/accepts. Test-writer writes meaningful RED with production unchanged then stops. Fresh implementer completes minimal fix and GREEN, preserving evidence; out-of-scope failures return to main. Read CLAUDE/OpenSpec and tdd skill. Effective client lint/format/type-check/test all required; targeted real-editor lock/persistence/contracts plus actual npm wrapper. No browser E2E/paid models/remoteCI. Do not relax strict flags, suppress diagnostics or drop assertions.
