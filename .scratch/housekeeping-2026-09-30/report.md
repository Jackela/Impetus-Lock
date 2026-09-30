# 2026-09-30 仓库配置与清理报告

本轮配置和文档维护已完成，上一轮已验收整改及本轮变更已合入本地 `main`。归档 4 个本轮工作区，删除 36 个已完成的临时分支，保留 3 个含独立未集成工作的 `round3c` 分支及其工作区。没有推送代码、创建或合并/关闭 PR，也没有实施待审批的 Tier 3 提案。

## 配置与文档

- `.gitignore` 补齐各环境配置文件、本地 `.zcode/plans/`、数据库旁路文件、JUnit 和覆盖率报告；保留环境模板、正式演示录像、源码和历史审查证据。13 个忽略/保留案例先红后绿；当前没有被忽略规则误覆盖的 tracked 文件。
- 增加 `.editorconfig`，在 `.gitattributes` 明确 Shell 与 Windows 批处理文件的换行；没有对全库重新格式化。
- Dependabot 增补根 npm 工具链，Docker 扫描改为实际 `/server`、`/client` 目录；修正重复的提交前缀。未升级任何产品依赖。
- 7 个活动工作流的 11 种外部 Action 引用均从原版本标签解析并固定为上游完整提交 SHA；显式声明权限、避免保留 checkout 凭据、设置 job 时限，补充 E2E 并发控制。
- 修复部署工作流在 `if` 中直接引用 secrets 的语法错误；CI/E2E 原有手动 `ref` 参数得到落实，默认检出固定的触发 SHA。现有部署触发方式和 Dependabot 自动合并策略未变。
- 修正 Issue 入口，简化 PR 模板与 CODEOWNERS 注释。`.github/PR_BODY_TEMP.md` 归档为 [历史 PR 草稿](../../docs/archive/2026-09/PR_BODY_STYLE_LEARNING_SNAPSHOT.md)，保留当时内容与状态。
- 新增 [贡献指南](../../CONTRIBUTING.md)、[安全报告指南](../../SECURITY.md)，更新 README、文档索引、依赖指南、PR 检查排查说明和本轮授权记录。根 AGENTS 托管块及 CLAUDE 宪法未改。

## GitHub 已生效设置

网站设置已更新并读回确认，详见 [设置快照](github-settings.json)：

| 项目                                            | 结果                            |
| ----------------------------------------------- | ------------------------------- |
| 合并后自动删除分支                              | 开启                            |
| 密钥扫描、推送保护                              | 开启                            |
| Dependabot 漏洞告警                             | 开启                            |
| 私密漏洞报告                                    | 开启                            |
| main 合并前解决审查讨论                         | 开启                            |
| main 原五项必需检查、要求更新分支、管理员受保护 | 保留                            |
| 强制推送、删除 main                             | 继续禁止                        |
| Actions 默认只读、禁止机器人自审批              | 保留                            |
| Dependabot security updates 自动建 PR           | 继续关闭，本轮不触发新的依赖 PR |

仓库描述和 README 主页链接已补齐。库内文件仍仅在本地 `main`，尚未发布到 GitHub；网站设置生效不表示远端已采用新文档或工作流。远端仍有 8 个原有 Dependabot PR，全部保留。

## 验证

[检查明细](checks.json) 和 [独立复核记录](review.md) 保存本轮验证范围。

| 检查                                              | 结果                                               |
| ------------------------------------------------- | -------------------------------------------------- |
| Ruff / format / import-linter / mypy / pydocstyle | 全部通过                                           |
| pytest（按既定范围排除 Redis 集成）               | 736 passed，6 skipped                              |
| 后端关键路径覆盖                                  | 16 个文件各自 ≥80%；关键集合聚合 95.29%            |
| ESLint / Prettier / 有效 TypeScript 检查          | 全部通过                                           |
| Vitest + coverage                                 | 707 passed，4 skipped；71 个测试文件通过           |
| 前端构建 / API schema 检查                        | 通过                                               |
| OpenSpec 0.23.0 严格检查                          | 23 passed，0 failed                                |
| actionlint 1.7.12                                 | 工作流语法与表达式通过；未运行 shellcheck/pyflakes |
| 忽略规则 / 相对文档链接                           | 13 个案例、最终 89 个改动文档链接通过              |
| 主工作区重建依赖后                                | 类型检查、生产构建通过；归档后 API 检查通过        |

后端第一次运行有 25 个 PostgreSQL fixture 准备错误，原因是本机 Colima 未启动；保存失败日志后恢复既有容器，重跑测试及关键覆盖率均通过。独立复核发现的 1 个 P2（检出可移动分支）已修正并复核关闭。未执行浏览器 E2E、真实付费模型调用、远端 Actions 或部署。

## 分支、工作区与恢复

- 本地 `main` 从 `31b0e3f` 快进到已验收代码与配置提交 `ce38e27`，随后仅提交本报告及清理证据。此前审查提交见 [9/29 报告](../audit-2026-09/runs/2026-09-29/report.md)。
- 本轮实现提交：`9c44f8c`（配置与草稿归档）、`acc2ba8`（贡献、安全及维护文档）、`ce38e27`（固定检出 SHA、复核与清理计划）。
- 删除前将 36 个分支头保存到可恢复 bundle，核对 [分支及 SHA 清单](retired-branches.json)，通过 Codex 托管归档保存 4 个工作区快照，再删除临时分支。详见 [清理结果](cleanup-result.json)。
- Git 忽略的 689 个审查/维护证据文件已复制回主工作区并逐一校验；`.zcode`、本地环境配置、数据库及 `scripts/ralph/.last-branch` 已保留。主工作区重新安装锁定依赖，已解除对被归档工作区的依赖。
- 保留 `integration/audit-followup-round3c`、`ticket/round3c-model-defaults`、`ticket/round3c-client-hygiene` 及其工作区：它们包含独立的模型默认值调整等历史工作，本轮没有重新验收或合入。
- 远端分支为 `main` 和 8 个开放 Dependabot PR 分支；没有可清理的失效远端跟踪引用，没有删除远端分支。

本机恢复目录：`/Users/jackela/Documents/GitHub/impetus-local-backups/2026-09-30-housekeeping`。其中 `repository-before.bundle`、`repository-pre-cleanup.bundle` 保存分支提交，`local-files-before.tar.gz` 和清单保存清理前 924 个本地文件（约 52 MB，未打包可重建依赖缓存），已逐个检查 SHA-256。忽略文件不会自动进入 Codex 归档；上述独立备份和主工作区副本补足了这一点。该恢复目录权限仅限本机用户。

## 仍需单独处理

新开启的 GitHub 告警针对**远端默认分支**列出 18 项依赖告警：8 high、5 medium、5 low，涉及后端清单与锁文件；当前开放密钥告警为 0。详见 [依赖告警清单](dependency-alerts.json)。这不是对未推送本地分支的漏洞扫描结果，本轮没有修改依赖版本或关闭告警；下一步应按包版本、修复版本及既有提案逐项判断。

已有 Tier 3 提案继续待审批。现有 main 推送会触发 staging 构建/部署工作流，与 CI 并行；本轮仅修复其语法，没有改变该部署策略，也没有推送或触发部署。

## 官方依据

- [忽略文件与共享规则](https://docs.github.com/en/get-started/getting-started-with-git/ignoring-files)
- [Actions 最小权限与完整 SHA 固定](https://docs.github.com/en/actions/reference/security/secure-use)
- [Dependabot 配置目录](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)
- [工作流触发和 GITHUB_TOKEN 例外](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
