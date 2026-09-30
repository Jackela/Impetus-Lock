# 依赖管理

依赖声明和锁文件共同决定可安装版本：`server/poetry.lock` 与 `client/package-lock.json` 固定解析结果。更新依赖时检查清单、锁文件及受影响的镜像或工作流，并根据变更范围运行相应验证。

## Dependabot

[`.github/dependabot.yml`](.github/dependabot.yml) 是更新时间、分组、忽略规则和 PR 上限的权威配置。当前覆盖：

- Python：`/server`，每周一。
- npm：`/` 与 `/client`，分别维护根工具依赖和前端依赖；具体目录按仓库配置。
- GitHub Actions：`/`，每月。
- Docker：`/.github/workflows`、`/server` 和 `/client`，每月检查工作流及服务/前端容器声明的镜像。

检查 `dependabot.yml` 以获取准确的时区、时间、分组、标签和 PR 上限；不要在本文另行维护一份可能过期的副本。

## 自动合并边界

`.github/workflows/dependabot-auto-merge.yml` 在 Dependabot PR 打开或更新时等待配置的 CI 检查。对 patch 和 minor 更新，工作流会尝试启用 GitHub 自动合并；GitHub 仅在仓库保护规则要求的检查满足后执行合并。major 更新不启用自动合并，工作流会提示人工审查。配置尝试启用自动合并不表示 PR 已合并，也不替代对依赖影响的审查。

## 更新审查

- 阅读上游变更记录，确认破坏性改动、弃用项和迁移要求。
- 核对锁文件变化，并检查相关构建、类型检查、测试及运行时镜像是否需要同步。
- Playwright 包版本和容器镜像标签要一起核对；E2E 工作流中的版本比较不能单独证明镜像标签匹配。更新后运行适用的浏览器 E2E 检查。
- 重大版本迁移按 [OpenSpec 指南](openspec/AGENTS.md) 提案并获批后实施。
- 安全更新按漏洞影响、可利用条件和受影响范围评估优先级，并及时记录处置；本文不承诺固定修复时限。
