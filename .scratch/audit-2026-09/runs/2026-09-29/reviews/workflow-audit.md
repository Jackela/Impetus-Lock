已完成只读核查，当前为 `ea0ff6e`（基线 `31b0e3f`）。确认 5 项 P2 文档问题；未发现需要新增治理机制的冲突。未修改文件、委派、安装或访问远端。

```text
C01|P2|CLAUDE.md:455|仍要求按 .specify/templates/ 开发，但该目录不存在；687行及 docs/agents 明确 OpenSpec 拥有规格权威|删除失效的 Speckit 强制入口，改为指向现有 OpenSpec 指南；保留适用的宪法和 TDD 要求|Tier1
C02|P2|CLAUDE.md:122|声称 Act 与 CI 100% 一致；.actrc:5 使用替代镜像，e2e.yml:50、75、172 在 ACT 下跳过 checkout、迁移和报告上传|改为本地模拟说明，列明已知差异，删除完全一致及跨平台行为相同的保证|Tier1
C03|P2|CLAUDE.md:473|2025-11-09 记录仍标题为 Current Project Status，477行仍写 Current Branch；只有后面的 Phase6 明确标注历史|将整段统一标为历史记录，保留日期和原验证结果，撤去当前状态措辞|Tier1
C04|P2|CLAUDE.md:607|PHASE5_COMPLETE.md、PHASE3_COMPLETE.md 均不存在；现有 Phase5 文件为 docs/process/PHASE_5_INTEGRATION_COMPLETE.md，未找到同名 Phase3 文件|修正 Phase5 指针；删除或明确标注无法定位的 Phase3 指针，不补造文件|Tier1
C05|P2|DEVELOPMENT.md:416|声称日志自动复制到 test-results/act-e2e.log；scripts/act-sync.sh:32仅 tee 到 LOG_PATH，没有复制操作|按实现修正文档，说明默认路径及 ACT_LOG_PATH；无需增加脚本行为|Tier1
```

C02–C05 与根文档审查重叠，应合并到同一修复票，避免重复实施。

共存规则：

- GitHub 是长期任务跟踪器；本次以 `docs/agents/issue-tracker.md:51–55` 的本地例外为准，票据与证据归入日期目录，不发布、认领或关闭远端事项。
- OpenSpec 拥有规格、提案和审批权。Matt `to-spec` 输出用于协调，`to-tickets` 用于拆票与依赖；摘要、标签和票据完成不构成 OpenSpec 批准或归档。
- 已确认 Tier1/2（含 P2）进入后续修复；Tier3 仅提案。主代理独立集成和验收，每票使用新上下文，子代理不得再委派。
- 保留根 `AGENTS.md` 的管理块与 `CLAUDE.md` 中唯一的 Agent skills 节。领域文档按需创建；缺少 `CONTEXT.md`、ADR 本身不是缺陷。

上述修复的**精确文件白名单**：`CLAUDE.md`、`DEVELOPMENT.md`。限定修改对应段落；不修改 `AGENTS.md`、`openspec/AGENTS.md`、`docs/agents/*`、Act 脚本、工作流或已安装 Matt 技能，不新建 `.specify/` 或 PHASE 文件。

结论来自当前文件与脚本静态核查，未运行 Act、Playwright 或发布验证。
