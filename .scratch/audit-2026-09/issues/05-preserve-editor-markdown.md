# 05: Preserve document structure and locks through editor save/reload

Status: accepted-locally (main integrator; 2026-09-14)

Blocked by: None

Source base: b14fdb175134d8b4edd928449346f3a5426e9343; dispatch pins actual worktree parent after ticket commit.

Write scope: client/src/components/Editor/EditorCore.tsx; focused real editor regression test; minimal serializer helper only if necessary

## Behavior and acceptance

A09; OpenSpec editor-agentic-ui hydration/autosave and lock protections. onChange must receive native Milkdown Markdown serialization of edited document, not textContent. Preserve existing marker format and lock IDs/sources. Prefer serializerCtx over custom Markdown generation; no dependency upgrade or state redesign.

- [x] Mount real EditorCore or real Milkdown editor wired through EditorCore onReady/onChange, edit a document containing heading/list/blockquote; emitted Markdown retains structure (baseline assertion fails). Do not mock editor/serializer/filter. Mock only browser missing APIs or peripheral media/network boundaries.
- [x] Inject provoke and rewrite locked content via production functions, persist onChange payload, remount/reparse saved document, restore returned lock IDs; user delete and undo against protected content are refused by actual filter, normal text remains editable.
- [x] Existing comment and source semantics survive roundtrip. First verify actual behavior; do not assume all markers were lost in baseline.
- [x] Public interfaces stay unchanged; lint/format/tsc/Vitest pass. No Playwright.
      Test seam: EditorCore public callbacks, real Milkdown serialization, LockManager + TransactionFilter behavior. Use new test `client/src/components/Editor/EditorCore.persistence.test.tsx`. RED first with heading structure test, then GREEN, then further roundtrip cases one at a time. If native serializer needs a small helper for existing lock marker encoding, allow it only with regression evidence.

## Dispatch contract

Fresh context, depth=1, no delegation. Read CLAUDE.md, AGENTS.md, relevant OpenSpec specs and installed implement/TDD skills. Tests precede production edits. Test-writer owns tests only; implementer receives reviewed RED evidence. Do not change acceptance criteria, weaken tests, expand scope, push, or mutate remote. Stop on unexpected failure and retain evidence. Main is sole integrator and acceptor.

Backend gates (server cwd): `poetry run ruff check .`, `poetry run ruff format --check .`, `poetry run lint-imports`, `poetry run mypy . --no-site-packages --ignore-missing-imports`, `poetry run pytest tests/ -n auto -k "not RedisIntegration and not redis_pubsub"`. Frontend gates (client cwd): `npm run lint`, `npm run format`, `npm run type-check`, `npm run test`. No Playwright. Existing environments are accepted; no migrations or external LLM calls. Logs outside tracked state; single final conventional commit after GREEN.

## Integrator clarification: version refresh consumer

App passes taskVersion as contentVersion. EditorCore's existing contentVersion effect compares textContent and inserts initialContent as literal text, so native Markdown saves would cause a second structure loss on version refresh. Include this existing consumer in the same ticket: compare native serialized persisted content, no-op for identical roundtrip value, parse changed external Markdown with the same marker hydration handling. Add public rerender/contentVersion regression; preserve current lock protection and avoid broader sync redesign.

## Review correction R05

Independent review found marker escaping also changes inline, fenced and indented code text. The reviewed RED test uses the real editor/parser and asserts code-node text and DOM content, not just serialized output. Repair remains within Markdown preservation: native code content (including literal escapes) must round-trip unchanged while actual lock markers retain existing enforcement. RED evidence: git common dir `audit-2026-09/red-05-review.log` (2 targeted failures, 4 existing cases pass).
