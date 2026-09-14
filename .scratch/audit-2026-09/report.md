# Impetus-Lock — September 2026 local audit report

2026-09-14。本轮在 `codex/audit-2026-09` 完成 Matt 项目配置、五项并行审查、六张代码修复票、三个文档/卫生批次和三个 Tier3 提案草稿。所有实施批次经独立审查和主 agent 验收；适用本地门禁全绿。

起点及保留的本地 `main`：`156eba1412bcf73852ab15c7fcd61b773f33242a`。没有 push、远端 Issue/PR/label 写入、迁移重跑、Playwright 或外部付费 LLM 调用。Tier3 未实施、未获批；本地结果不代表远端 CI 或发布。

## Delivered changes

- Matt：CLAUDE 唯一 Agent skills 节；GitHub 任务跟踪、五个标签映射、single-context 惰性领域文档；OpenSpec 仍拥有规格与审批权威。本轮票据保存在本地，未创建空 CONTEXT/ADR。
- 后端：锁定 greenlet 3.5.5 并提交 Poetry 生成锁；debug lock ID 不再依赖毫秒时钟；Loki 短上下文 rewrite 使用现有安全转换；成功提交后才发布幂等缓存。
- 前端：保存和版本回载使用原生 Markdown serializer/parser；锁注释保存回载和过滤保留；代码文本及字面反斜线不受标记转义影响。
- 覆盖率：固定后端15文件、前端7模块的聚合可执行行覆盖率门禁为80%；原后端全局25%保留。新增公开行为及真实编辑器测试。
- 文档/卫生：当前入口、CI、版本和API说明纠错；11份历史过程记录归档至 `docs/archive/2026-09/`；精确63项生成物停止跟踪，本地内容逐字节保留并被ignore。

完整证据导航：[findings](findings.md)、[六张 ready tickets](issues/)、[批次范围](batches.md)、[独立审查记录](reviews.md)、[垃圾精确清单](junk-manifest.txt)。审查分级与宪法功能P1是两套独立标记。

## Local commits by wave

Wave2为只读审查，五份 charter 按3+2调度，无实现提交。各任务和审查均fresh context，禁止子代理再委派；主agent唯一集成者。常规执行Luna，复杂判断与独立审查Astra。

### Wave 1 — Matt init

| Commit    | Change                                                                    |
| --------- | ------------------------------------------------------------------------- |
| `b14fdb1` | chore: init matt skills repo config (tracker, triage labels, domain docs) |

### Wave 3 — ledger 与 ready tickets

| Commit    | Change                                               |
| --------- | ---------------------------------------------------- |
| `aad9a2a` | docs: record audit findings and ready repair tickets |

### Wave 4 — 实施批次（集成后的提交）

| Commit    | Change                                                         |
| --------- | -------------------------------------------------------------- |
| `8faf1e5` | fix(server): install greenlet on arm64                         |
| `6a5429b` | fix: issue unique debug intervention locks                     |
| `2fa0263` | fix: guard short-context Loki rewrites                         |
| `8580701` | fix: cache interventions only after successful commit          |
| `4ff99ad` | fix: preserve markdown and locks when saving editor changes    |
| `26e4a43` | test: enforce lock-critical coverage gates                     |
| `3443ec0` | docs: align current guides with repository behavior            |
| `5b5412f` | docs: archive historical process reports and repair navigation |
| `7d6be78` | chore: stop tracking generated environments and local database |
| `9db77d6` | docs: propose deferred SDK and boundary improvements           |

### Wave 5 — 审查修复

| Commit    | Change                                                         |
| --------- | -------------------------------------------------------------- |
| `3453e39` | fix(editor): preserve code literals when encoding lock markers |
| `add8364` | docs: correct review findings                                  |
| `fad659a` | docs(ci): correct frontend workflow documentation              |
| `ed872ab` | docs: remove missing report index entry                        |
| `29d2515` | docs: clarify Gemini response error characterization           |

Wave5审计归档提交为本报告所在的 `docs: record audit validation and deferred work`，包含findings、tickets、review ledger及Dependabot清单。集成分支保留逐票与审查修复提交，不压缩原始证据历史；源提交与审查区间见reviews.md。

## Gates and evidence

所有命令在集成分支执行。测试沿用指定全量选择，仅附加coverage采集参数以同时完成覆盖率验收；没有删除测试、扩大排除或降低阈值。

| Layer      | Actual command                                                                                                                                         | Final result                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| server     | `poetry run ruff check .`                                                                                                                              | PASS                                                        |
| server     | `poetry run ruff format --check .`                                                                                                                     | PASS                                                        |
| server     | `poetry run lint-imports`                                                                                                                              | PASS，3 contracts kept                                      |
| server     | `poetry run mypy . --no-site-packages --ignore-missing-imports`                                                                                        | PASS                                                        |
| server     | `poetry run pytest tests/ -n auto -k "not RedisIntegration and not redis_pubsub" --cov=server --cov-report=term --cov-report=json:coverage-final.json` | **479 passed, 4 skipped**                                   |
| server     | `poetry run coverage report --rcfile=coverage-critical.ini`                                                                                            | **82.19%**（586/713行），PASS                               |
| client     | `npm run lint`                                                                                                                                         | PASS                                                        |
| client     | `npm run format`                                                                                                                                       | PASS                                                        |
| client     | `npm run type-check`                                                                                                                                   | PASS                                                        |
| client     | `npm run test -- --coverage`                                                                                                                           | **545 passed, 4 skipped**，55 files；**81.73% lines**，PASS |
| OpenSpec   | pinned0.23.0，每项 `validate <id> --strict --no-interactive` 及 `validate --all --strict --no-interactive`                                             | PASS，3份草稿逐项通过；全量19 passed / 0 failed             |
| Repository | `git diff --check`，保护块、归档链接、精确垃圾清单/ignore验证                                                                                          | PASS；两条原有缺失链接列A24待办                             |

固定关键集合由ticket06定义，未因分数调整；前端另外报告statements82.01%、branches78.77%、functions88.23%。后端全包行覆盖率72.23%，不用于替代关键门禁；本次coverage.py配置未采集分支/函数指标。各层原有4个skip保留，未运行Playwright。

较低的单文件覆盖仍可见：后端base_provider59.79%、PostgreSQL repository51.95%；前端ContentInjector54.21%。门槛为预先固定集合的聚合行覆盖率，不能表述成每个文件都达80%。EditorCore整个UI/计时器组件另次测量为60.29%（06实施基准，05代码文本修复前）；真实保存/回载回归属于05，组件整体不计入纯锁模块门禁，也不宣称整体达到80%。

原始日志及coverage JSON位于本地git common directory的 `audit-2026-09/`，不纳入提交。最终执行清单是 `final-server-results.json`、`final-client-results.json`、`final-openspec-results.json`；相应log记录命令和退出码。最终测试之后只集成文档/提案，没有再修改运行代码或测试配置。

## Review closure and verification limits

- 初审及修复后独立审查逐批覆盖commit、staged、unstaged、untracked，并分别评估Spec与Standards。所有发现闭环后才接受集成。D1两轮漏项、D2缺失日志索引、05代码文本回归、SDK错误码歧义均修复后重审；详见reviews.md。
- 01在全新临时目录创建独立Poetry环境，重新生成锁与提交版逐字节一致；从锁安装125项依赖、greenlet3.5.5及SQLAlchemy asyncio导入成功，禁用系统site-packages。日志 `01-clean-install.log` 记录过程及解释器，原手工安装环境未用作此项证明；无无关包版本或artifact hash升级。
- 04原RED日志被GREEN输出覆盖。主agent用原提交测试在基准aad9a2a的临时副本重新复现 `[500,200]` 失败（2failed/2passed）；`04-red-reproduced.log` 是后补复现，不能冒充遗失的原始时序日志。最终GREEN由本次集成测试重新证明。
- 05真实测试覆盖provoke/rewrite注入、保存、remount、实际删除过滤、逆向事务过滤与普通文本编辑。逆向事务不是history-stack undo集成；本轮未新增history插件行为。
- 执行异常如实保留：05第一次全量有无关telemetry mock错误，后续修复回归全量又有4项超时；均未改相关测试，原命令重跑通过。主agent最终前端首次误传重复 `run` 导致没有匹配测试，修正调用参数后545项通过；错误日志没有改名为PASS。
- 本地commit使用 `HUSKY=0` 或禁用hooks路径，避免根目录缺少依赖时钩子隐式下载，以及整份历史CLAUDE格式重写；显式运行了所有适用门禁。原有Markdown整体格式问题不作全仓格式迁移。

## Remaining P2

| Finding | Remaining work                                                                     | Tier / decision                        |
| ------- | ---------------------------------------------------------------------------------- | -------------------------------------- |
| A11     | 清理CI中Poetry安装前无版本的独立SDK pip安装；先验证隔离导入                        | Tier2独立票                            |
| A13     | 公共docstring缺口及presence门禁治理，保留宪法要求                                  | Tier2，需逐点TDD/范围界定              |
| A15     | Milkdown不同minor嵌套版本风险；当前无peer-invalid或回归证据，结合PR141分组验证     | 依赖升级按Tier3审批                    |
| A16     | 确定Node支持区间与engines；文档已与CI Node24对齐，legacy-peer-deps不单凭存在就删除 | 支持政策先决策，相关迁移Tier3          |
| A18     | 用实际TransactionFilter行为替换既有手工调用onReject的伪集成断言                    | Tier2测试改进                          |
| A22     | 历史OpenSpec状态/审批证据不一致，保留原记录并待人工来源核实                        | Tier1记录治理，不补造审批              |
| A23     | dev-start使用--no-root尚未证明启动失败；先复现再定修复                             | 待核假设，不直接改脚本                 |
| A24     | openspec/project.md原有CONTRIBUTING/SECURITY两个链接目标不存在                     | Tier1后续纠错；本轮新增/改动链接均有效 |

## Tier 3 proposals

| Draft                                                                                                     | Decision held for approval                                                |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [migrate-gemini-sdk](../../openspec/changes/migrate-gemini-sdk/proposal.md)                               | Legacy SDK迁移到google-genai；保持BYOK隔离、重试、token与现有错误状态语义 |
| [refactor-route-service-boundaries](../../openspec/changes/refactor-route-service-boundaries/proposal.md) | task/template/streak端点向service委托，保留鉴权、用户隔离、版本和状态     |
| [refactor-unused-client-state](../../openspec/changes/refactor-unused-client-state/proposal.md)           | 审计并处置未使用的云同步与锁hook API，不先改变生产行为                    |

三份proposal仅为待审批草稿，实施任务全部未勾选。上游SDK生命周期依据见proposal中的官方来源；开始迁移时需重新核对SDK/模型支持与兼容性。

## Dependabot recommendations

2026-09-14只读查询：14个开放PR，其中13个Dependabot，#115为人工PR而排除。逐项标题、状态与建议保存在 [dependabot.md](dependabot.md)。以下为处理顺序建议，未合并、重放、评论或修改远端。

| PR                                                      | Risk and recommendation                                      |
| ------------------------------------------------------- | ------------------------------------------------------------ |
| [117](https://github.com/Jackela/Impetus-Lock/pull/117) | 低；mypy同major，验证Python3.11/3.12类型检查                 |
| [118](https://github.com/Jackela/Impetus-Lock/pull/118) | 中；import-linter同major，验证三条架构contract               |
| [119](https://github.com/Jackela/Impetus-Lock/pull/119) | 中；OpenTelemetry API/SDK/exporter协调验证                   |
| [120](https://github.com/Jackela/Impetus-Lock/pull/120) | 低；xdist同major，验证并行测试资源隔离                       |
| [126](https://github.com/Jackela/Impetus-Lock/pull/126) | 高/Tier3；jsdom27→29，单独验证Node和真实编辑器DOM            |
| [127](https://github.com/Jackela/Impetus-Lock/pull/127) | 高/Tier3；JSDoc插件61→62，核规则默认值与lint                 |
| [128](https://github.com/Jackela/Impetus-Lock/pull/128) | 高/Tier3；globals16→17，核全局集合                           |
| [129](https://github.com/Jackela/Impetus-Lock/pull/129) | 高/Tier3；Node类型24→25，先明确实际运行时支持                |
| [134](https://github.com/Jackela/Impetus-Lock/pull/134) | 高/Tier3；redis放宽到<8且未配套lock，先定版本并覆盖Redis集成 |
| [135](https://github.com/Jackela/Impetus-Lock/pull/135) | 中；两项CI action组合，审release/权限/输入输出               |
| [136](https://github.com/Jackela/Impetus-Lock/pull/136) | 高/Tier3；fetch-metadata2→3，独立核输出与权限                |
| [137](https://github.com/Jackela/Impetus-Lock/pull/137) | 高/Tier3；buildx3→4，核runner与构建行为                      |
| [141](https://github.com/Jackela/Impetus-Lock/pull/141) | 高；23项前端组合，先拆编辑器与测试工具链，再分别验证         |

建议先处理同major开发工具，随后协调telemetry/CI变更；major和组合迁移先拆分、审批与测试。此处风险评级不表示PR当前已通过或可直接合并。
