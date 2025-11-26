## Context
- Users currently看到调试前缀 `[debug:mode]` 与 `<!-- lock:... -->` 注释，违背“UI 负责 vibes”的设计。
- Loki 触发无节流，手动+定时可连续注入同一句，刷屏破坏体验。
- Telemetry 按钮无清晰状态反馈。

## Goals
- 用户只看到正式文案 + 锁定样式，不暴露注释/调试标记。
- Loki 触发有冷却/去重，符合“偶发混沌”而非 flood。
- 维持持久化（lock_id）与测试可见性（data-lock-id），不破坏事务/防删逻辑。

## Decisions
- **注释隐藏**：继续在文档中存储 `<!-- lock:... -->` 作为持久化后备，但用 decorations 隐藏注释区间，仅渲染正文；lock_id/source 存 attrs/data-*。
- **内容格式**：后端 debug_provider 返回正式文案 + 唯一 lock_id；前端不再拼注释到用户文本。
- **Loki 冷却**：共享冷却计时（手动+timer），防连发；可加入“最近内容”去重避免同一句重复。
- **Telemetry 反馈**：按钮切换文案/样式，立即反映状态。

## Risks / Mitigations
- **遗留注释查找**：确保 extraction 仍能从注释/attrs 识别 lock_id，隐藏层不影响持久化。→ 单测覆盖 commentRange + decoration 隐藏。
- **冷却影响体验**：过严冷却降低“混沌”感。→ 采用短冷却（如 3-4s），仍允许随机定时触发但不堆叠。
- **样式退化**：隐藏注释可能影响测试基线。→ 保留 data-lock-id / source，调整测试预期。

## Open Questions
- 是否需要服务端节流或 action 去重？当前计划先在客户端做冷却/去重，若不足再拓展后端策略。
