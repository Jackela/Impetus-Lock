# Impetus-Lock — 2026-09-29 审查与清偿报告

状态：实施中，尚未完成验收。已确认的 Tier 1/2 必须全部修复并验证后才可标记本轮完成。

## 边界与基点

- 基点：`main@31b0e3f011313e73cf56fc2756f3fb2be2e6b63e`。
- 本地集成：`codex/audit-2026-09-29`，managed worktree 为 `/Users/jackela/.codex/worktrees/impetus-audit-2026-09-29/Impetus-Lock`。
- 原 checkout、未跟踪 `.zcode/`、既有环境和截图证据保留。不合入 main，不 push，不写远端 Issue/PR/标签。
- Tier 3 仅提交未批准的提案。严格格式验证不代表批准、实现或发布。
- 不执行 Playwright 浏览器 E2E、付费模型调用或远端 CI；这些验证不能由本地门禁替代。

## Wave 1：配置核对

已有 Matt 初始化提交 `b14fdb1` 保留，不重复初始化。`ea0ff6e` 增补本轮仅本地票据的范围说明。继续采用 GitHub Issues、默认五标签和 single-context；OpenSpec 负责规格与审批权威。

## Wave 2—3：审查与裁决

五份只读报告位于 `reviews/`，统一发现追加至 `../../findings.md`。`1ce0602` 保存审查、去重裁决与 ready tickets。具体执行状态以 `tickets.json` 为准，证据位于 `logs/`。

审查严重度 P0/P1/P2 与宪法的功能 P1 分开记录。已完成的历史 seed 不重复开票；未复现疑点不当成确认缺陷。

## Wave 4：本地修复

实施已完成，待独立复核。各票使用独立分支；test-writer 记录 RED，主 agent 核对后由 fresh-context implementer 完成 GREEN。全部本地提交待 Wave 5 独立复核。

## Wave 5：独立复核与终验

四组独立复核已无问题返回；V03 确认 4 项原票缺口，R12/R13 正补修，V06 确认 3 项文档缺口，D-A 正补修。最终需覆盖 commit、staged、unstaged、untracked，核对每项验收条件并完成两端全量门禁、构建、实际 TypeScript 编译范围及逐文件关键覆盖率。

## 取证基线（非最终验收）

- 后端：649 passed、6 skipped；Ruff、格式、import-linter、声明的 mypy 与 pydocstyle 通过。
- 前端：558 passed、4 skipped；声明的 lint/format/type-check 通过，但根 type-check 空跑。实际 app 编译有248条诊断，工具配置有1条。
- 前端关键文件 ContentInjector 行覆盖54.21%；后端 base_provider 59.79%、PostgreSQLTaskRepository 51.95%。TaskService 96.05%，但未纳入原关键清单。
- 上述缺陷由 R11–R20 对应票据处理；不能用原有总覆盖率或空跑结果宣称质量门禁有效。

## 待审批架构债、依赖与限制

P-01/P-02 已形成6份未批准提案，见 [提案索引](proposal-index.md)。统计与成就草案明确保留 streak/Special 的独立审批缺项。只读 Dependabot 快照见 `dependabot.md`，交付前再核对开放清单。所有 major PR 只给处理建议，不合并、不关闭。

<!-- DISPOSITION:START -->
## 逐票处置（实施中）

当前21张 Tier2 票已全部本地集成；所有票据均等待独立复核和最终门禁。

| 票据 | 发现 | Tier | 处理 | 本地提交 |
| --- | --- | --- | --- | --- |
| [R01](issues/r01-expire-unvisited-idempotency-cache-entries.md) Expire unvisited idempotency cache entries | B04 | 2 | 已集成，待复核 | 3cd8625 |
| [R02](issues/r02-make-debug-action-identities-persistable.md) Make debug action identities persistable | B08 | 2 | 已集成，待复核 | 79ed45a |
| [R03](issues/r03-restore-task-sync-request-bodies.md) Restore task sync request bodies | F04 | 2 | 已集成，待复核 | eddbe65 |
| [R04](issues/r04-restore-mounted-authentication-and-client-csrf-contract.md) Restore mounted authentication and client CSRF contract | B07, F09 | 2 | 已集成，待复核 | 8fbf6cf |
| [R05](issues/r05-enforce-intervention-task-ownership.md) Enforce intervention task ownership | B02 | 2 | 已集成，待复核 | 2a0be77 |
| [R06](issues/r06-scope-and-serialize-idempotent-interventions.md) Scope and serialize idempotent interventions | B01, B03 | 2 | 已集成，待复核 | 5b030ad |
| [R07](issues/r07-make-task-version-updates-atomic.md) Make task version updates atomic | B05 | 2 | 已集成，待复核 | 700b36e |
| [R08](issues/r08-keep-synchronous-model-generation-off-event-loop.md) Keep synchronous model generation off event loop | B06 | 2 | 已集成，待复核 | ff0d92a |
| [R09](issues/r09-enforce-style-profile-and-history-ownership.md) Enforce style profile and history ownership | B10, B11 | 2 | 已集成，待复核 | a024c9b |
| [R10](issues/r10-unify-collaboration-room-manager-dependency.md) Unify collaboration room manager dependency | B09 | 2 | 已集成，待复核 | 893148e |
| [R11](issues/r11-restore-authoritative-client-type-sources.md) Restore authoritative client type sources | F02, F03 | 2 | 已集成，待复核 | a8a62ee |
| [R12](issues/r12-preserve-task-mutation-callbacks.md) Preserve task mutation callbacks | F05 | 2 | 已集成，待复核 | d663fa6 |
| [R13](issues/r13-preserve-drafts-through-task-synchronization-races.md) Preserve drafts through task synchronization races | F06, F07, F08 | 2 | 已集成，待复核 | 380c9bc |
| [R14](issues/r14-repair-react-component-strict-type-contracts.md) Repair React component strict type contracts | F13 | 2 | 已集成，待复核 | bdfda4b |
| [R15](issues/r15-repair-editor-library-contracts-without-architecture-migration.md) Repair editor library contracts without architecture migration | F14 | 2 | 已集成，待复核 | 1c58e4d |
| [R16](issues/r16-repair-domain-and-service-strict-type-contracts.md) Repair domain and service strict type contracts | F15 | 2 | 已集成，待复核 | 3b778c6 |
| [R17](issues/r17-reconcile-client-dependency-and-supported-runtime-metadata.md) Reconcile client dependency and supported-runtime metadata | F11, F12 | 2 | 已集成，待复核 | fc928bc |
| [R18](issues/r18-enable-complete-client-type-checking.md) Enable complete client type checking | F01, F16, F17 | 2 | 已集成，待复核 | 632886b |
| [R19](issues/r19-enforce-per-file-backend-critical-coverage.md) Enforce per-file backend critical coverage | B12 | 2 | 已集成，待复核 | 7e255be |
| [R20](issues/r20-enforce-per-file-client-critical-coverage.md) Enforce per-file client critical coverage | F10 | 2 | 已集成，待复核 | b30d805 |
| [R21](issues/r21-keep-e2e-runtime-screenshots-outside-tracked-evidence.md) Keep E2E runtime screenshots outside tracked evidence | H01 | 2 | 已集成，待复核 | 96b583c |
| [D-A](issues/d-a.md) Correct active API and testing documentation | D01, D02, D03, D04, D05, D07, C05 | 1 | 已集成，待复核 | 882017e |
| [D-B](issues/d-b.md) Preserve evidence and clean generated-state tracking | D04, D06, H02, H03, H04 | 1 | 已集成，待复核 | 590638e |
| [D-C](issues/d-c.md) Clarify active collaboration instructions | C01, C02, C03, C04 | 1 | 已集成，待复核 | de76d15 |
| [P-01](issues/P-01-proposals.md) Tier3 proposals | B13, B14, H05, H06, H07, F12-boundary | 3 | 已集成，待复核 | e8bc6d4 |
| [P-02](issues/P-02-activity-tracking.md) Draft missing writing activity statistics and milestone tracking | B15, B16 | 3 | 已集成，待复核 | 4bfbf69 |
<!-- DISPOSITION:END -->

## 集成门禁首轮结果（独立审查尚未结束）

代码快照 `de4dbe5`，本地 Node 24.19.0 / npm 11.17.0、Poetry Python 3.12。下列检查全部退出 0；后续若审查导致代码变化，将重新验证受影响层。

| 检查 | 实际结果 |
| --- | --- |
| 后端 Ruff、format、import-linter、mypy、pydocstyle | 全部通过；3 项依赖方向约束保留 |
| 后端 pytest（按用户选择排除两组 Redis） | 736 passed，6 skipped |
| 前端 ESLint、Prettier、实际 TypeScript 检查 | 全部通过；238 个 TS/TSX 文件，0 遗漏、0 诊断 |
| Vitest，实际 npm wrapper | 680 passed，4 skipped |
| 前端生产构建、生成 API 漂移检查 | 全部通过 |
| API 类型、运行环境、截图输出 Node 检查 | 4 项通过 |
| OpenSpec 0.23.0 严格验证 | 23 项通过，0 失败；含全部 6 份新草案 |

后端锁关键清单 16 个文件、前端 6 个文件均分别达到行覆盖率 ≥80%；缺失或未执行文件不能从门禁消失。后端整体覆盖率 79.42% 与关键文件规则是不同口径，未将前者写成 ≥80%。

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

完整命令、退出码和输出见 `logs/final-{server,client,openspec}-initial-*.log`；编译输入见 `logs/final-client-inputs.json`。生产构建仍提示入口 chunk 超过默认 500 kB 建议值；构建成功，该提示不等于已复现的性能缺陷。
