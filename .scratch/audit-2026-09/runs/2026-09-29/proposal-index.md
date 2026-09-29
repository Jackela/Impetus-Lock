# P-01 提案索引

五份 Tier 3 草案已起草，状态均为 **Proposed / not approved**；所有未来实施任务保持未勾选。本票仅完成来源、链接、格式与范围检查，没有修改生产代码、依赖、当前规范或既有验收条件；不代表主代理已集成、接受或发布。

## 草案与审批选择

| Change | 推荐范围 | 待审批选择 |
| --- | --- | --- |
| [complete-collaboration-authorization](../../../../openspec/changes/complete-collaboration-authorization/proposal.md) | 复用 Task 身份、持久化共享及显式 owner/read/write/admin、事务提交后确认 | 共享还是撤回不支持端点；admin 提升权限；WS 持久化协议；旧房间处置 |
| [refactor-remaining-route-service-boundaries](../../../../openspec/changes/refactor-remaining-route-service-boundaries/proposal.md) | 仅 style/profile/history/stats/achievements 与协作业务；保留简单 HTTP/静态映射 | 最小服务/仓储组合、事务归属、与共享提案先后；不顺带补时期聚合/成就授予 |
| [complete-authenticated-editor-entry](../../../../openspec/changes/complete-authenticated-editor-entry/proposal.md) | 现有 auth 组件与当前 App 的 loading/login/logout/expiry、账户草稿隔离 | 注册可见性、过期本地写作、旧未归属缓存导入及保留 |
| [migrate-client-development-toolchain](../../../../openspec/changes/migrate-client-development-toolchain/proposal.md) | Vite8/plugin6 配对；lint、root hook/runtime、typing 独立验证回退 | 精确 peers/patch、flat compiler 规则、root/client 所有者、Node交集及 types26政策 |
| [migrate-backend-test-and-redis-dependencies](../../../../openspec/changes/migrate-backend-test-and-redis-dependencies/proposal.md) | pytest9 collection_path 与 redis-py8 生命周期分组 | 隔离兼容实验、Python3.11/3.12及真实Redis7证据、协议/超时/重试/插件版本 |

每份目录包含 proposal、design、未勾选 tasks 与 delta specs。规范草案使用既有 task、editor-agentic-ui、stats、achievements、dev-environment-bootstrap；缺失的 focused capabilities 为 collaboration-authorization、style-profile、style-history。新增要求均在 changes 内，不改 openspec/specs。

## 依赖与证据边界

- 路由抽取以 R09/R10 后的安全合同为基线，不能保留越权、假删除结果或把假权限成功包装成已修复；已归档 tasks/templates/streaks 不重做。
- 登录入口与 R04 cookie/CSRF、R13 同步竞态修复分开；前端 major 以 R11–R18/R20 后有效类型/覆盖检查为基线。
- 两份协作 delta 的 requirement 名称不同：授权提案拥有角色/schema/持久化政策，抽取提案拥有服务与 transport 边界；主代理未来需在集成时核对联合行为。
- 后端两组在未来批准及项目实施前需要 Python3.11/3.12 与真实Redis7；本票未安装或运行其测试。浏览器E2E、真实LLM、远端CI均未执行。

## 来源和检查

读取 [READY ticket](issues/P-01-proposals.md)、[backend](reviews/backend-audit.md)、[frontend](reviews/frontend-audit.md)、[hygiene](reviews/hygiene-audit.md)、[docs](reviews/docs-audit.md)、[workflow](reviews/workflow-audit.md) 五份报告及 [Dependabot日期快照](dependabot.md)，并对照本worktree实际代码、模型/迁移、配置、当前规范和相关归档提案。代码取样基点为 `de76d15407d43caa020e61e0dde664bf49d99b03`；审批/实施前须重新核对主代理集成结果。

各提案已用固定 CLI **0.23.0** 通过 `openspec validate <change-id> --strict --no-interactive`。格式通过只表示语法有效；未产生运行时TDD证据，也未批准任何提案。新增文件的相对链接、空白和允许路径一并检查；八个 Dependabot PR 的链接通过只读元数据核对，CI状态仍只引用日期快照。外部迁移依据直接链接在各 design 中。

独立记录位于主代理run的 `logs/P-01-docs-writer-*` 前缀：sources、registry、pr-links、各份 GREEN strict validation、最终 QA。日志以独占新文件保存，不覆盖旧证据。GREEN 指文档检查通过，不是生产功能通过；本次初始格式校验即通过，没有伪造RED日志。

首次 final-QA 将 `git diff --no-index --check` 的差异退出码1误判为空白失败，实际没有空白诊断。该 RED 记录保留，修正为同时判断退出码与诊断输出后另存 GREEN；这属于检查脚本判定修正，不是生产代码的RED/GREEN。

主代理负责后续集成、独立复核和接受。本索引不更新 tickets/progress、不提交、不推送、不切换分支，也不写远端服务。
