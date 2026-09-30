# 贡献指南

欢迎提交问题、改进和修复。请先阅读 [开发指南](DEVELOPMENT.md) 了解项目结构与开发流程，再按改动类型查阅 [测试指南](TESTING.md) 和 [OpenSpec 指南](openspec/AGENTS.md)。新能力、破坏性变化或架构调整先提出 OpenSpec 变更并取得批准。

## 开发约定

- 从 `main` 创建用途明确的分支，保持每个改动聚焦。
- 使用 Conventional Commits，例如 `feat: add task history`、`fix: preserve locked content`、`docs: clarify setup`。
- 行为改动按 TDD 编写能区分正确与错误结果的测试，再实现并重构。锁定等关键路径须满足逐文件至少 80% 覆盖率；详细范围和命令见 [测试指南](TESTING.md)。
- 本地配置放在 `.env`，以对应 `.env.example` 为模板。不要提交密钥、令牌、个人数据或 `.env` 文件；示例配置只使用虚构值。

## 提交审查

提交前检查改动范围与 `git diff --check`，并运行与改动相关的检查。Pull request 应说明变更目的、重要实现、实际运行的验证及结果，以及尚未解决的问题。CI 结果以 GitHub Actions 中对应提交的检查为准；本地检查不代表远端 CI 已通过。
