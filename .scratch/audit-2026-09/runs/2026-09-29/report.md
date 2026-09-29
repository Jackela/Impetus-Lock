# Impetus-Lock — 2026-09-29 审查与清偿报告

修复与独立复审仍在进行；R13 的首次加载失败路径需补修，暂不标记清偿完成。

## 范围与保存位置

- 基点：`main@31b0e3f011313e73cf56fc2756f3fb2be2e6b63e`。交付分支为本地 `codex/audit-2026-09-29`，工作区 `/Users/jackela/.codex/worktrees/impetus-audit-2026-09-29/Impetus-Lock`。
- 原 checkout 的 main、未跟踪 `.zcode/`、既有环境和数据保留；没有 push、合入 main 或写远端 Issue、PR、标签。
- 主代理负责裁决和集成。子任务为 fresh context、depth1、禁止再委派；审查只读，最多并发3个子任务。运行中内置代理生命周期额度用尽后，改用相同型号/推理等级的临时 CLI 子代理，证据连续保留。
- [findings](../../findings.md)保留历史并追加本轮结果；[tickets.json](tickets.json)记录逐票状态；[RED/GREEN 索引](evidence.md)链接原始证据。日志在本工作区 `logs/` 本地保留且按仓库规则忽略，未伪装成已提交或远端证据。

## 按 wave 的结果

1. Matt init 核对：已有 `b14fdb1` 不重复初始化。继续 GitHub Issues、默认五标签、single-context；本轮仅本地票据。宪法和根 OpenSpec 管理块保持不变，不创建空领域文档。
2. 五个只读 charter 在同一逻辑 wave 分两批完成，覆盖文档、后端、前端、卫生依赖、协作配置；全部结束后才汇总。已完成的历史 seed 不重复开票。
3. 主代理合并裁决：3批 Tier1、初始21张 Tier2；复审发现编辑器加载遗漏，新增R22。Tier3整理成6份未批准提案。
4. 单票独立分支实施；测试代理先保存真实 RED，主代理核对后由新实现代理接手。实现不修改验收条件，越界和失败先保存证据。
5. 六组独立审查覆盖 commit、staged、unstaged、untracked。V03发现4项原票缺口，V06发现3项文档缺口；修复时另复现R22，并在文档再次复审中修正1处JSON遗漏。后续修复均保留单独提交和复审证据。

## 每项发现的处置

审查严重度与宪法的功能 P1 分开记录。下表覆盖本轮确认的 Tier1/2，包括全部P2；Tier3行仅表示草案交付。

| 票据 / 对应发现 | 处理结果 | 本地提交 |
|---|---|---|
| [R01](issues/r01-expire-unvisited-idempotency-cache-entries.md) / B04 | 清理未再次访问的过期缓存项 | `3cd8625` |
| [R02](issues/r02-make-debug-action-identities-persistable.md) / B08 | 生成可持久化的唯一调试动作 ID | `79ed45a` |
| [R03](issues/r03-restore-task-sync-request-bodies.md) / F04 | 按真实 API 对象参数发送任务内容和版本 | `eddbe65` |
| [R04](issues/r04-restore-mounted-authentication-and-client-csrf-contract.md) / B07, F09 | 统一 JWT、Cookie、CSRF 的签发、校验与请求契约 | `8fbf6cf` |
| [R05](issues/r05-enforce-intervention-task-ownership.md) / B02 | 在生成、缓存和历史写入前校验任务所有权 | `2a0be77` |
| [R06](issues/r06-scope-and-serialize-idempotent-interventions.md) / B01, B03 | 按用户和任务隔离幂等请求；并发合并、取消清理、提交后缓存 | `5b030ad` |
| [R07](issues/r07-make-task-version-updates-atomic.md) / B05 | 真实 PostgreSQL 独立 session 的原子版本冲突；内存仓库快照隔离 | `700b36e` |
| [R08](issues/r08-keep-synchronous-model-generation-off-event-loop.md) / B06 | 同步模型调用移出事件循环，取消时保留正确资源生命周期 | `ff0d92a` |
| [R09](issues/r09-enforce-style-profile-and-history-ownership.md) / B10, B11 | 风格档案和历史操作验证所有权，删除返回实际结果 | `a024c9b` |
| [R10](issues/r10-unify-collaboration-room-manager-dependency.md) / B09 | 复用现有协作房间 manager；未新增权限持久化 | `893148e` |
| [R11](issues/r11-restore-authoritative-client-type-sources.md) / F02, F03 | 移除遮蔽声明，从权威 OpenAPI 生成并核验客户端类型 | `a8a62ee` |
| [R12](issues/r12-preserve-task-mutation-callbacks.md) / F05 | 保留 mutation 回调，实际 App 创建后选择并打开新任务 | `d663fa6`、`d528e0e` |
| [R13](issues/r13-preserve-drafts-through-task-synchronization-races.md) / F06, F07, F08 | 串行保存，保留加载中、切换、离线恢复和冲突草稿 | `380c9bc`、`92e8efe` |
| [R14](issues/r14-repair-react-component-strict-type-contracts.md) / F13 | 按 React19 真实公共类型修正组件与 ref；保留动画行为 | `bdfda4b` |
| [R15](issues/r15-repair-editor-library-contracts-without-architecture-migration.md) / F14 | 修复编辑器插件契约，保留原生锁过滤、多步位置和撤销语义 | `1c58e4d` |
| [R16](issues/r16-repair-domain-and-service-strict-type-contracts.md) / F15 | 修正严格类型与可擦除语法，保留枚举值及日志反向映射 | `3b778c6` |
| [R17](issues/r17-reconcile-client-dependency-and-supported-runtime-metadata.md) / F11, F12 | 声明实际兼容的 Node22/24 与已锁定依赖；未升级现有锁版本 | `fc928bc` |
| [R18](issues/r18-enable-complete-client-type-checking.md) / F01, F16, F17 | 实际检查应用、测试、工具配置；无源码排除、严格选项放宽或伪造全局 | `632886b` |
| [R19](issues/r19-enforce-per-file-backend-critical-coverage.md) / B12 | 后端16个关键文件各自80%，包含 TaskService，遗漏即失败 | `7e255be` |
| [R20](issues/r20-enforce-per-file-client-critical-coverage.md) / F10 | 前端6个关键文件各自80%，以真实 ProseMirror 操作补测 | `b30d805` |
| [R21](issues/r21-keep-e2e-runtime-screenshots-outside-tracked-evidence.md) / H01 | 运行截图写入 test-results，保留全部已跟踪历史图片 | `96b583c` |
| [D-A](issues/d-a.md) / D01, D02, D03, D04, D05, D07, C05 | 修正有效指南、API 示例、验证命令和实际认证前提 | `882017e`、`5d66b3a`、`666a3fb`、`60eb094` |
| [D-B](issues/d-b.md) / D04, D06, H02, H03, H04 | 归档历史锁指南，精确取消跟踪生成状态，保留本地字节 | `590638e` |
| [D-C](issues/d-c.md) / C01, C02, C03, C04 | 明确 Matt/OpenSpec/宪法与本地授权职责；保持宪法和管理块 | `de76d15`、`e6acabc` |
| [P-01](issues/P-01-proposals.md) / B13, B14, H05, H06, H07, F12-boundary | 5份架构/依赖草案；仅文档通过检查，未批准或实施 | `e8bc6d4` |
| [P-02](issues/P-02-activity-tracking.md) / B15, B16 | 1份写作活动/成就草案；未知历史和待决政策保持明确 | `4bfbf69` |
| [R22](issues/r22-synchronize-editor-content-after-initialization.md) / V03-05 | 编辑器就绪时加载最新受控内容，支持版本0并避免重复保存通知 | `5d5d6b8` |

复核补充的 V03-01/02/03 由R13处理，V03-04由R12处理，V03-05由R22处理；V06-01/02/03及其JSON修复遗漏由D-A处理。文档归档和卫生操作没有删除用户环境、数据库或图片；本轮仅取消跟踪已确认的 `scripts/ralph/.last-branch`，操作前保存了精确清单与字节证据。

## 独立复核

| 批次 | 范围 | 最终记录 |
|---|---|---|
| V01 | R01/R02/R05/R06/R08 | [初审0项](reviews/v01-initial.md) |
| V02 | R04/R07/R09/R10/R19 | [初审0项](reviews/v02-initial.md) |
| V03 | R03/R12/R13 | [初审](reviews/v03-initial.md)；复审待返回 |
| V04 | R11/R14/R15/R16/R22 | [原批次初审0项](reviews/v04-initial.md)；新增R22复审待返回 |
| V05 | R17/R18/R20/R21 | [初审0项](reviews/v05-initial.md) |
| V06 | 文档、配置、提案 | [初审](reviews/v06-initial.md)、[再次复审](reviews/v06-recheck.md)、[最终0项](reviews/v06-final.md) |

## 最终本地门禁

后端/OpenSpec检查在 `de4dbe5` 通过，之后对应源码、配置和规格未变化；前端在最终产品快照 `d528e0e` 重新全量验证。环境为 Poetry Python3.12、Node24.19.0/npm11.17.0。

| 检查 | 结果 |
|---|---|
| Ruff check、Ruff format、import-linter、mypy、pydocstyle | 全部通过，保留3项依赖方向约束 |
| pytest tests/ -n auto，排除 RedisIntegration/redis_pubsub | **736 passed、6 skipped** |
| ESLint、Prettier、有效 TypeScript 检查 | 全部通过；**241个 TS/TSX 文件，0遗漏、0诊断** |
| Vitest（实际 npm wrapper / vmThreads） | **696 passed、4 skipped，70个测试文件** |
| 六个既有顺序种子5/12/25/29/32/41 | 每次完整套件均696通过、4跳过；6/6通过 |
| 客户端生产构建、API生成漂移检查 | 全部通过 |
| API类型、运行环境、截图路径 Node检查 | 4项通过 |
| 固定 OpenSpec0.23.0严格验证 | **23项通过、0失败**，包含6份新草案 |

权限回归关闭了 TESTING 绕过；版本并发使用真实 PostgreSQL 的独立 session；请求体验证保留真实 API 客户端；编辑器用真实 Milkdown/ProseMirror 状态。顺序验证使用实际 npm wrapper 和既有复现 seeds，只做有限轮验证。

后端16个、前端6个关键文件分别达到行覆盖率≥80%，未执行或缺失文件不能消失。后端整体79.42%是另一统计口径，未将它表述成≥80%。

| 后端关键文件（相对 server/） | 行覆盖率 |
| --- | ---: |
| `server/application/services/intervention_service.py` | 87.91% |
| `server/domain/models/intervention.py` | 88.89% |
| `server/domain/models/anchor.py` | 100.00% |
| `server/domain/text_window.py` | 90.48% |
| `server/infrastructure/llm/base_provider.py` | 96.91% |
| `server/infrastructure/llm/debug_provider.py` | 100.00% |
| `server/api/routes/intervention.py` | 95.19% |
| `server/infrastructure/cache/idempotency_cache.py` | 100.00% |
| `server/domain/entities/task.py` | 100.00% |
| `server/domain/entities/intervention_action.py` | 95.45% |
| `server/infrastructure/persistence/postgresql_task_repository.py` | 100.00% |
| `server/infrastructure/persistence/in_memory_task_repository.py` | 93.44% |
| `server/infrastructure/persistence/models.py` | 100.00% |
| `server/models/task.py` | 96.00% |
| `server/api/routes/tasks.py` | 92.00% |
| `server/application/services/task_service.py` | 96.23% |

| 前端关键文件（相对 client/） | 行覆盖率 |
| --- | ---: |
| `src/components/Editor/TransactionFilter.ts` | 90.90% |
| `src/services/ContentInjector.ts` | 98.95% |
| `src/services/LockManager.ts` | 96.00% |
| `src/utils/editorMarkdown.ts` | 100.00% |
| `src/utils/prosemirror-helpers.ts` | 97.87% |
| `src/utils/textRange.ts` | 89.28% |


证据：[后端命令/退出码](logs/final-server-initial.json)、[前端命令/退出码](logs/final-client-accepted.json)、[实际编译输入](logs/final-client-accepted-inputs.json)、[逐文件前端行数](logs/final-client-accepted-lines.json)、[6种子结果](logs/final-client-accepted-seeds.json)、[OpenSpec](logs/final-openspec-initial.json)。每个JSON均指向同目录的完整命令日志。

## 剩余架构债、依赖与验证边界

本轮确认的 Tier1/2 是否已完成，以报告首段及tickets状态为准。未批准的架构债继续开放，不等同未修复代码票被改名为待办：

- `complete-collaboration-authorization`：权限持久化和读写授权。
- `refactor-remaining-route-service-boundaries`：剩余路由职责划分。
- `complete-authenticated-editor-entry`：真实认证入口与编辑器衔接。
- `migrate-client-development-toolchain`：前端主要依赖协调迁移。
- `migrate-backend-test-and-redis-dependencies`：pytest/Redis主要版本迁移。
- `complete-writing-activity-tracking`：活动采集、统计和成就授予，保留streak/Special及历史未知项。

每份提案的推荐方案、实质替代方案、迁移影响与待决项见[提案索引](proposal-index.md)。格式通过不代表批准；生产实现和正式规格均未提前修改。

交付前只读核对仍有8个开放 Dependabot PR，完整风险与验证建议见[Dependabot清单](dependabot.md)：#181/#176/#172高风险，#190/#185/#180/#177中风险，#189低至中风险。Vite8与plugin-react6协调验证；Hooks7修平面配置；pytest9先处理移除的hook。未合并、关闭、评论或触发更新。

Playwright浏览器E2E、真实付费模型及远端CI未执行；仅对相关Playwright文件做收集检查，旧浏览器辅助接口通过编译不证明运行可用。Node22仅核对元数据，本地执行使用Node24。后端6项跳过包括2项真实Redis和4项旧安全占位；前端4项既有音频跳过。新增关闭TESTING的权限测试提供本轮实际权限证据。

构建仍提示入口chunk超过默认500kB建议值；没有将警告当作已复现性能故障。过去的Python矩阵差异、已修复greenlet/SDK问题和未复现疑点没有重新包装成缺陷。本次结论仅覆盖本轮确认的Tier1/2，不声称仓库不存在任何技术债。

## 本地提交清单（按 wave）

### Wave1

- `ea0ff6e` chore: align matt skills local audit scope

### Wave2—3

- `1ce0602` docs: record five-charter audit and ready remediation tickets

### Wave4

- `3cd8625` fix: reclaim expired idempotency cache entries
- `eddbe65` fix: restore task sync request bodies
- `882017e` docs: align active guides with runtime contracts and gates
- `79ed45a` fix: issue unique debug intervention action identities
- `590638e` docs: archive lock guide and preserve generated local state
- `de76d15` docs: clarify current collaboration and historical guidance
- `a8a62ee` fix: generate client types from authoritative response schemas
- `8fbf6cf` fix: align authenticated cookie and CSRF request contracts
- `e8bc6d4` docs: propose remaining architecture and major dependency work
- `380c9bc` fix: preserve drafts through task synchronization races
- `700b36e` fix: reject concurrent task version updates atomically
- `2a0be77` fix: enforce task ownership before interventions
- `d663fa6` fix: preserve public task mutation callbacks
- `5b030ad` fix: scope and serialize idempotent interventions
- `ff0d92a` fix: offload synchronous intervention generation safely
- `bdfda4b` fix: repair React component and ref type contracts
- `893148e` fix: share collaboration room manager dependencies
- `a024c9b` fix: enforce style profile and history ownership
- `71cfb56` docs: preserve remediation evidence and integration decisions
- `1c58e4d` fix: repair editor library and transaction contracts
- `7e255be` test: enforce backend critical coverage per file
- `3b778c6` fix: preserve domain and service runtime type contracts
- `fc928bc` fix: reconcile client dependencies and supported runtimes
- `4bfbf69` docs: propose evidence-based writing activity and awards
- `96b583c` test: isolate runtime screenshots from tracked evidence
- `b30d805` test: enforce client critical coverage per file
- `92f7481` docs: checkpoint coverage and remaining type-check evidence
- `632886b` fix: enforce complete client type checking
- `5d66b3a` docs: describe effective validation and coverage gates
- `e6acabc` docs: synchronize active agent validation guidance
- `de4dbe5` docs: checkpoint completed implementation for independent review

### Wave5

- `75cb75b` docs: record independent review findings and repair scope
- `92e8efe` fix: retain drafts through loading and recovery
- `666a3fb` docs: correct intervention and browser validation prerequisites
- `60eb094` docs: align delete response with verified example range
- `5d5d6b8` fix: reconcile loaded editor content after initialization
- `d528e0e` fix: open newly created tasks in the actual editor flow

报告与证据索引的最后收尾提交以交付分支HEAD为准。所有产品改动均已按票/批次独立提交，最终diff可由 `git diff 31b0e3f..codex/audit-2026-09-29` 审阅。
