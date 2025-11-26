# Change: Refactor lock visibility and chaos throttle

## Why
- Locked blocks currently expose debug prefixes/HTML 注释，导致用户看到调试信息，体验混乱。
- Loki 手动/定时触发会刷屏，缺少节流与去重，远超预期的“偶发混沌”体验。
- Telemetry/模式切换反馈不清晰，用户难以理解当前状态。

## What Changes
- 去掉用户可见的调试前缀/注释，锁定信息仅通过装饰与样式呈现。
- 为 Muse/Loki 响应生成正式文案与唯一 lock_id，前端隐藏注释、仅显示锁定样式。
- 为 Loki 触发增加冷却/去重保护，防止连续刷屏。
- 提升 UI 反馈：Telemetry 状态可见，Muse/Loki 手动触发逻辑更清晰。

## Impact
- Specs: `locked-content-styling`, `editor-agentic-ui`, `agentic-interventions`.
- Code: frontend (ContentInjector, LockDecorations, EditorCore, TelemetryToggle), backend debug provider (content/lock_id).
