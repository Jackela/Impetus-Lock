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


## P-02: 写作活动统计与成就授予草案

[complete-writing-activity-tracking — proposal](<../../../../openspec/changes/complete-writing-activity-tracking/proposal.md>) 状态为 **Proposed / not approved**。P-02 仅完成 Tier 3 文档；不改生产代码、依赖、当前或归档规范、既有验收条件。主代理负责后续集成、独立复核和接受；本节链接指向本地集成分支中的提案文件。

| 文件 | 内容 |
| --- | --- |
| [proposal.md](<../../../../openspec/changes/complete-writing-activity-tracking/proposal.md>) | 实际缺口、推荐路径、现存记录/每日汇总/经批准撤回的替代路径、审批选择 |
| [design.md](<../../../../openspec/changes/complete-writing-activity-tracking/design.md>) | 来源定位；固定种类活动记录、UserStats派生汇总、UTC日/周/月、写作区间、删除/修正、持久化重试身份、owner与唯一授予、有限重建及保数据回退 |
| [tasks.md](<../../../../openspec/changes/complete-writing-activity-tracking/tasks.md>) | 16项未来审批/逐个公共边界RED与GREEN/迁移/复核任务，全部未勾选 |
| [stats delta](<../../../../openspec/changes/complete-writing-activity-tracking/specs/stats/spec.md>) | 仅ADDED，5项窄要求；区分完整零、partial、unavailable，提出显式v2 nullable schema及旧合同迁移 |
| [achievements delta](<../../../../openspec/changes/complete-writing-activity-tracking/specs/achievements/spec.md>) | 仅ADDED，3项窄要求；同用户同类型唯一，事务授予、历史保留、streak资格依赖 |

来源以 [READY ticket](issues/P-02-activity-tracking.md) 与 worktree代码基点 `7e255bed593cad28f0b4022cc04c822875e1e088` 为准。已确认 period固定零、UserStats无生产writer、Achievement无授予路径与非唯一类型索引；任务删除级联干预，历史时长不能从任务日期、字数或LLM耗时推算。推荐新增一张限定用途的带日期活动表，复用现有框架/事务，不引入事件总线、泛化游戏化框架或无证据的daily缓存。

尚待批准：数据路径与范围、UTC/账户时区、累计和删除语义、签发干预/持久化锁口径、写作区间与覆盖、v2 null及旧合同409/弃用政策、创建/AI的永久去重身份、唯一授予/旧重复合并/历史补发、streak与Special独立缺项。缺失历史时长保持unknown；不伪造回填或历史earned_at。

与 [剩余路由抽取](../../../../openspec/changes/refactor-remaining-route-service-boundaries/proposal.md) 分开：结构抽取不批准新采集/聚合/授予/schema，也不弱化正式规范。旧streak的任意后续日期加一不证明连续天数/宽限资格，相关授予依赖独立行为方案；当前八项定义不代表Special类别缺项已补齐。

固定 **@fission-ai/openspec@0.23.0** 的 `validate complete-writing-activity-tracking --strict --no-interactive` 通过；parsed-deltas检查为stats 5项、achievements 3项。31个新增相对/绝对链接与锚点、5个文件空白/允许路径和39份既有来源hash检查通过。只检查本批新增链接；本票不重复全历史审计。

独立证据前缀：`logs/P-02-docs-writer-20260929T110358480548Z`。包括 sources、GREEN-registry/spec-registry、[GREEN-strict](logs/P-02-docs-writer-20260929T110358480548Z-GREEN-strict.json)、GREEN-parsed-deltas、[GREEN-document-QA](logs/P-02-docs-writer-20260929T110358480548Z-GREEN-document-QA.json)。保留 [RED-draft-consistency](logs/P-02-docs-writer-20260929T110358480548Z-RED-draft-consistency.json)：最初30秒候选上限与35/40/60秒例子不一致，已统一为待批准60秒上限，GREEN QA核对修正。RED/GREEN均属文档检查，不是运行时TDD；无生产功能测试、数据库迁移、真实provider、浏览器E2E或远端CI证据。格式通过不代表批准、实现或发布；集成与复核状态见本轮报告。
