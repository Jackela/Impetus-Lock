## 1. Lock rendering cleanup
- [x] Update lock extraction to surface comment ranges without rendering them.
- [x] Adjust decorations to hide lock comments while keeping lock attrs/data-lock-id.
- [x] Remove debug prefixes/注释注入路径，确保前端只渲染正文+样式。

## 2. Chaos throttling and UX
- [x] Add Loki cooldown/duplicate suppression for manual+timer triggers.
- [x] Ensure Muse/Loki manual按钮状态明确，可触发预期模式。
- [x] Make Telemetry toggle visibly reflect On/Off state.

## 3. Backend debug outputs
- [x] Make debug provider emit human-friendly content and unique lock_ids (no `[debug:*]`).

## 4. Validation
- [x] Update/extend unit/integration tests for extraction, decorations, triggers, and debug provider output.
- [x] Run `npm run test` (frontend) and relevant backend tests if touched.
- [x] Verify via MCP/manual pass that locked blocks show only styled text, no注释/debug，Loki 不刷屏。
