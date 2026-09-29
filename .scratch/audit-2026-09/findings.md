# Findings — September 2026 audit

Base: `156eba1412bcf73852ab15c7fcd61b773f33242a`; Wave 1: `b14fdb175134d8b4edd928449346f3a5426e9343`. 五份只读审查完成，主 agent 复核合并。严重度与宪法功能优先级独立。P2 中 A07/A08 是范围小且已证实的数据完整性修复，纳入本轮。其余独立 P2 留待办。

| 编号 | 严重度 | 文件:行（审查基准）                                                              | 事实                                                                                                              | 建议动作                                         | Tier | 去向                              | 原发现                        |
| ---- | ------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---- | --------------------------------- | ----------------------------- |
| A01  | P1     | README.md:80; CLAUDE.md:240; DEVELOPMENT.md:128                                  | 当前启动示例仍使用不存在的 server.main:app                                                                        | 统一入口和安装说明                               | 1    | D1                                | DOC1/CFG1                     |
| A19  | P1     | .gitignore:61; server/impetus_lock.db                                            | 63个虚拟环境/数据库生成物仍被跟踪                                                                                 | 精确清单移出索引，保留本地内容并补ignore         | 1    | D3                                | HYG1                          |
| A05  | P1     | server/poetry.lock:1472                                                          | greenlet包级marker不含arm64，新Poetry环境漏装异步SQLAlchemy必需依赖                                               | Poetry生成一致锁，干净环境验收                   | 2    | 01                                | BE3                           |
| A06  | P1     | server/server/infrastructure/llm/debug_provider.py:40                            | 同毫秒同mode调用生成重复lock_id，违背唯一性规格                                                                   | UUID及冻结时钟回归                               | 2    | 02                                | BE4                           |
| A09  | P1     | client/src/components/Editor/EditorCore.tsx:645                                  | onChange约定Markdown却收到doc.textContent，丢失标题/列表/块结构；现有字面量锁注释可能仍存，不能断言所有锁必然丢失 | 使用原生serializer，真实编辑保存重载验证格式与锁 | 2    | 05                                | FE1（主agent收窄）            |
| A10  | P1     | server/pyproject.toml:155; client/vitest.config.ts:7                             | 后端总体25%与前端无阈值不能执行宪法锁关键路径80%门槛                                                              | 固定关键路径集合、补行为测试并加独立门禁         | 2    | 06                                | BE5/FE2                       |
| A02  | P2     | README.md:139; CLAUDE.md:301,381                                                 | 当前指南混入旧失败状态和已过时的架构门禁/CI描述                                                                   | 现状引用配置，历史数据注明日期或归档             | 1    | D1/D2                             | DOC3-7/CFG2                   |
| A03  | P2     | API_CONTRACT.md:99                                                               | client_meta 文档标可选，运行时模型必填                                                                            | 修正文档，不改API                                | 1    | D1                                | DOC8                          |
| A04  | P2     | README.md:14; docs/INDEX.md:31                                                   | 当前入口存在指向缺失视频与文档的链接                                                                              | 修复已有来源的指针，删除无来源链接               | 1    | D1/D2                             | DOC9/HYG2                     |
| A20  | P2     | docs/agents/issue-tracker.md:42                                                  | frontier说明需要逐issue读取依赖信息，当前列表字段不足以直接判断                                                   | 明确只读gh api逐项读取与摘要/权威边界            | 1    | D1                                | CFG3/4                        |
| A21  | P2     | docs/agents/issue-tracker.md:47                                                  | 本轮本地例外应明确优先于generic skill发布路线                                                                     | 收紧例外到固定目录和只读操作                     | 1    | D1                                | CFG5                          |
| A22  | P2     | openspec/changes/archive/2025-11-09-execute-devtools-audit/proposal.md:1         | 历史草稿与completion状态文本不同，缺乏当时审批依据                                                                | 保留历史记录，不伪造审批或补勾验收               | 1    | 待办                              | CFG7/8                        |
| A16  | P2     | client/README.md:9; client/package.json:67                                       | README写Vite6与Node20+，实际Vite7有更具体engine条件                                                               | 修正文档；engines支持范围决策留待后续            | 1/2  | D1/待办                           | FE4                           |
| A07  | P2     | server/server/application/services/intervention_service.py:201                   | Loki短上下文guard只拦delete，未拦现行规格要求的rewrite                                                            | 保留Muse语义，覆盖49/50边界                      | 2    | 03                                | BE1                           |
| A08  | P2     | server/server/api/routes/intervention.py:193                                     | DB commit之前缓存成功响应，commit失败后同key重试会命中未持久化结果                                                | 提交成功再缓存，保留无session分支                | 2    | 04                                | BE2                           |
| A11  | P2     | .github/workflows/ci.yml:194; ci-server.yml:132                                  | Poetry安装前有无版本的独立pip SDK安装，项目已声明且锁定SDK                                                        | 后续移除冗余安装并验证隔离Poetry导入             | 2    | 待办                              | BE6                           |
| A13  | P2     | server/server/infrastructure/llm/base_provider.py:51; client/eslint.config.js:62 | 部分公共API缺docstring，实际CI未全面启用文档规则                                                                  | 保留宪法要求；实际缺口待单票治理                 | 2    | 待办                              | BE8/CFG补充                   |
| A18  | P2     | client/tests/unit/LockManager.test.ts:244                                        | onReject测试手工调用回调而不执行过滤器                                                                            | 后续以真实TransactionFilter行为替代伪集成断言    | 2    | 待办                              | FE7（测试不是Tier1文档）      |
| A23  | P2     | scripts/dev-start.sh:147                                                         | 脚本使用--no-root但从server目录启动，尚未证实因此失败                                                             | 文档采用完整安装；脚本变更需行为证据后另票       | 2    | 待办                              | DOC2（主agent排除未证实归因） |
| A12  | P2     | server/server/api/routes/tasks.py:188; templates.py:81; streaks.py:67            | 部分端点含ORM与业务规则，现有TaskService不具用户隔离接口                                                          | 提出保持鉴权及用户隔离的服务委托方案             | 3    | refactor-route-service-boundaries | BE7                           |
| A14  | P2     | server/pyproject.toml:17; gemini_provider.py:164                                 | Google legacy SDK已终止支持，当前依赖和调用仍使用旧API                                                            | 起草google-genai迁移方案                         | 3    | migrate-gemini-sdk                | BE9                           |
| A15  | P2     | client/package-lock.json:2224                                                    | Milkdown存在不同minor的嵌套内核，当前没有peer invalid或回归失败证据                                               | 记录依赖风险，结合PR141分组验证；本轮不升级      | 3    | 待办                              | FE3（不将风险等同缺陷）       |
| A17  | P2     | client/src/hooks/useTaskSyncCloud.ts:68; useLockEnforcement.ts:105               | 未使用的云同步路径硬编码version0，锁hook未订阅外部manager变更                                                     | 提出遗留API处置方案，不直接架构重构              | 3    | refactor-unused-client-state      | FE5/6                         |

| A24 | P2 | openspec/project.md:242-243 | 原有CONTRIBUTING.md和SECURITY.md本地链接目标不存在，非本轮新增 | 待真实文档建立后修指针，或单独删除无依据条目 | 1 | 收尾已关闭 | Wave5文档复核 |

## 审查范围与裁决

根目录24个Markdown全部审阅；后端抽查宪法五条、依赖与CI；前端检查编辑器、API/state、依赖和测试；卫生审查63个生成物及全部开放PR；协作审查Matt/OpenSpec职责。历史带日期测试快照不是新的失败证据。Python ^3.11 与3.11/3.12矩阵并存合理。CONTEXT/ADR缺失符合惰性创建，不是缺陷。根AGENTS保持不变。

## 补采覆盖率

基准467 passed/4 skipped；534 passed/4 skipped。后端全包71.87%，关键路径集合573/707=81.05%。前端已加载源中TransactionFilter statements81.82%，ContentInjector54.22%，LockManager96.15%，EditorCore43.62%；useLockEnforcement未被加载。测量不代表80%门禁已存在。原始日志位于git common dir的audit-2026-09/，不提交。

## 官方来源

Legacy SDK生命周期见 https://github.com/google-gemini/deprecated-generative-ai-python/blob/main/README.md 和 https://ai.google.dev/gemini-api/docs/libraries 。上游终止支持不等同当前调用必然失败。

## Wave 4 复核补充

A05: `server/.gitignore:30` 忽略 poetry.lock，HEAD未跟踪该文件。worktree没有本机ignored文件导致首轮环境性失败，不算RED。主agent拷贝本机原锁用于平台marker RED，01票补入server/.gitignore移除规则和锁文件版本控制；基准依赖版本保留。

## Final disposition

| Records                      | Outcome                                                                                                     | Local review record                                                                                                                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A01, A02, A03, A04, A20, A21 | Current docs corrected; historical status retained as history; missing MP4 pointer changed to existing WEBM | D1/D2, [batches](batches.md), [reviews](reviews.md)                                                                                                                                                                                        |
| A19                          | Exact63 artifacts no longer tracked; local bytes preserved and ignored                                      | D3, [manifest](junk-manifest.txt)                                                                                                                                                                                                          |
| A05, A06, A07, A08, A09, A10 | Six isolated TDD tickets implemented, independently reviewed, integrated and accepted by main               | [01](issues/01-arm64-greenlet.md), [02](issues/02-unique-debug-locks.md), [03](issues/03-short-loki-rewrite.md), [04](issues/04-commit-before-cache.md), [05](issues/05-preserve-editor-markdown.md), [06](issues/06-critical-coverage.md) |
| A12, A14, A17                | Tier3 proposal drafts only; implementation awaits separate approval                                         | [report proposal index](report.md#tier-3-proposals)                                                                                                                                                                                        |
| A16                          | Outdated version docs corrected; engines support-policy decision deferred                                   | D1; P2 backlog                                                                                                                                                                                                                             |
| A11, A13, A15, A18, A22, A23 | Deferred P2; A15/A23 remain risks or unproved failure hypotheses                                            | [report backlog](report.md#remaining-p2)                                                                                                                                                                                                   |

Independent reviews also found and closed regressions in newly written docs and code: marker escaping in code literals, stale CI/JSDoc/mypy descriptions, a missing archived log index, and ambiguous Gemini error status wording. These are recorded in reviews.md instead of duplicating their parent findings.

## Closeout follow-up

A24 closed during the user-authorized README/merge cleanup: removed the two nonexistent CONTRIBUTING/SECURITY targets from openspec/project.md. Existing Development and Testing guide links remain the actionable project entry points. No replacement security policy was invented.

## 2026-09-15 followup disposition

All remaining P2 findings and the three Tier3 proposals were completed on 2026-09-15 under the user-approved followup plan (multi-agent protocol preserved: fresh-context implementers, independent reviews, ff-only integration; local-only, no push). Details: [followup report](../audit-2026-09-followup/report.md), [followup tickets](../audit-2026-09-followup/issues/), [Dependabot dispositions](../audit-2026-09-followup/dependabot-followup.md).

| Records | Followup outcome | Local commits |
| --- | --- | --- |
| A11 | Folded into the gemini migration: 5 unversioned CI `pip install google-generativeai` lines removed | `d2f7dd0` |
| A13 | pydocstyle 91→0 with comment-only fixes, gated in both CI lint jobs; client JSDoc 320→0 with presence rules enabled | `82f9897`, `3be2f42` |
| A15 | Unused `@milkdown/plugin-listener` removed; single `@milkdown/prose` 7.18.0 restored | `6aafde0` |
| A16 | Engines `>=20.19 <25` declared; Docker builders unified on node:24-alpine; `.nvmrc` 24 | `f26fd16` |
| A18 | Pseudo-integration onReject tests replaced with real LockManager+TransactionFilter integration | `7543f60` |
| A22 | Archive reconciliation index added; originals untouched, no approvals fabricated | `e8895a3`, `36d564f` |
| A23 | Reproduced: full `poetry install` works and boots; `--no-root` removed from 3 dev scripts | `ef0f4c4` |
| A12 (Tier3) | refactor-route-service-boundaries implemented, characterized, reviewed, archived | `ead4d46` |
| A14 (Tier3) | migrate-gemini-sdk implemented (google-genai 2.23, retry parity measured & pinned), archived | `d2f7dd0` |
| A17 (Tier3) | refactor-unused-client-state implemented (unused hooks deleted), archived | `dc1aaf4` |
| Dependabot | 5 same-major/coordinated PRs landed locally; 8 majors/group verify-only records with recommendations | `2167c18`..`109a2ec` |


## 2026-09-29 audit — base 31b0e3f

Current run: [progress](runs/2026-09-29/progress.md), [ready tickets](runs/2026-09-29/tickets.json). Audit severity is independent of constitutional feature priority. All confirmed Tier1/2 including P2 must close; Tier3 proposal only.

### docs

| ID | Severity | Location | Verified fact | Action | Tier |
|---|---|---|---|---|---|
| D01 | P2 | API_CONTRACT.md:391,424,459,519 | curl examples omit required contract version/client_meta; response examples omit anchor; version fallback contradicts 422 | Align current examples and field/version descriptions with runtime schema, retain dated history | 1 |
| D02 | P2 | ARCHITECTURE_GUARDS.md:118,152,287,373 | Four contracts/no docstring guard claims conflict with three enforced contracts and pydocstyle/JSDoc | Correct active enforcement descriptions | 1 |
| D03 | P2 | TESTING.md:191,203,380; DEVELOPMENT.md:48,93 | Example test/entrypoint paths do not exist | Use actual runnable paths or label hypothetical examples | 1 |
| D04 | P2 | TESTING.md:559; LOCK_REFACTORING_TESTS_README.md:99,161; DEPENDENCY_MANAGEMENT.md:133,159 | Playwright --slow-mo, Vitest --grep, Poetry audit/lock --no-update are unsupported | Correct current command guidance | 1 |
| D05 | P2 | DEVELOPMENT.md:300; MANUAL_TESTING_GUIDE.md:375,378 | frontend-tests runs only Vitest, not Playwright/all frontend gates | Separate lint/type/unit/E2E job descriptions | 1 |
| D06 | P2 | DEPENDENCY_MANAGEMENT.md:22,38,39 | ^1.56.1 allows 1.57.0; documented schedule/PR limits drift | Correct semver and refer to current Dependabot config | 1 |
| D07 | P2 | AUDIO_FEEDBACK_GUIDE.md:64,66; BROWSER_TEST_GUIDE.md:160,164 | SensoryFeedbackDemo is not rendered and ENABLE_LOKI_MODE has no production consumer | Replace obsolete manual instructions with current entrypoints | 1 |

### backend

| ID | Severity | Location | Fact | Action | Tier |
|---|---|---|---|---|---|
| B01 | P1 | server/server/api/routes/intervention.py:145 | Shared cache key omits authenticated user and task; cross-user response disclosure reproduced | Scope keys to identity and task; preserve same-key retry | 2 |
| B02 | P1 | server/server/application/services/intervention_service.py:289 | X-Task-Id writes history without owner check; cross-user action write reproduced | Check ownership before generate/cache/history using existing 404 | 2 |
| B03 | P1 | server/server/api/routes/intervention.py:146 | Concurrent same-key misses generate and persist twice | Single-flight per effective key, release on failure/cancel, cache after commit | 2 |
| B04 | P2 | server/server/infrastructure/cache/idempotency_cache.py:50 | Unvisited expired entries accumulate during new writes | Automatically purge expired entries in existing cache lifecycle | 2 |
| B05 | P1 | server/server/infrastructure/persistence/postgresql_task_repository.py:102 | Version check and update are not atomic; stale snapshots both write version1 | Atomic compare-and-swap and existing conflict mapping | 2 |
| B06 | P1 | server/server/application/services/intervention_service.py:286 | Sync provider blocks async event loop;150ms call delays heartbeat161ms | Offload synchronous generation, preserve cleanup and error behavior | 2 |
| B07 | P1 | server/server/auth/router.py:74 | Mounted auth router omits CSRF cookie required by middleware | Repair issuer/middleware/client cookie contract; test config loading | 2 |
| B08 | P1 | server/server/infrastructure/llm/debug_provider.py:61 | Fixed act_debug conflicts with unique persisted action_id | Issue unique action ids, preserve idempotent retries | 2 |
| B09 | P2 | server/server/api/routes/collaboration.py:45 | DI creates fresh managers separate from shared collaboration service | Share existing application manager across route/service consumers | 2 |
| B10 | P1 | server/server/api/routes/style.py:337; server/server/api/routes/style_history.py:66 | Profile/history trust caller user_id/record_id without authenticated owner check | Enforce existing identity on all reads/mutations | 2 |
| B11 | P2 | server/server/infrastructure/persistence/style_history_repository.py:110 | Delete returns true even when no row deleted | Return actual deletion outcome | 2 |
| B12 | P2 | server/coverage-critical.ini:3 | Coverage aggregates files and omits TaskService | Each listed file >=80 and add TaskService | 2 |
| B13 | P2 | server/server/api/routes/collaboration.py:109 | Permissions query absent tables, POST falsely reports success, read/write not separated | Draft collaboration persistence and authorization proposal | 3 |
| B14 | P2 | server/server/api/routes/style.py:330 | Remaining style/stats/achievements/collaboration routes contain business queries | Draft scoped route-service boundary proposal | 3 |

### frontend

| ID | Severity | Location | Fact | Action | Tier |
|---|---|---|---|---|---|
| F01 | P2 | client/package.json:14 | Root tsc configuration has no source inputs;248 app diagnostics hidden | Repair diagnostics then enable effective app/node checks | 2 |
| F02 | P2 | client/src/vite.d.ts:1 | Ambient declaration replaces react-query public types | Use actual library public types | 2 |
| F03 | P2 | client/src/types/api.generated.ts:142 | Generated API types omit current fields and mark anchor optional | Regenerate from current OpenAPI and check drift | 2 |
| F04 | P1 | client/src/hooks/useTaskSync.ts:264 | Positional calls to object-parameter APIs drop content/version | Use current request object and verify actual fetch JSON | 2 |
| F05 | P2 | client/src/hooks/useCreateTask.ts:83 | Mutation wrapper discards callbacks supplied by modal | Forward public mutation callbacks and test real hook seam | 2 |
| F06 | P1 | client/src/hooks/useTaskSync.ts:290 | Switch loses pending saves; overlapping saves conflict and overwrite newer edits | Serialize task saves, preserve drafts, isolate task completions | 2 |
| F07 | P2 | client/src/hooks/useTaskSync.ts:223 | Failed old load prevents latest selected task loading | Latest request wins, ignore stale completions | 2 |
| F08 | P2 | client/src/hooks/useTaskSync.ts:248 | Root StrictMode creates two initial tasks | Make bootstrap idempotent without disabling StrictMode | 2 |
| F09 | P1 | client/src/services/api/interventionClient.ts:137 | Active clients omit required credentials/CSRF contract | Merge with B07 full authentication request repair | 2 |
| F10 | P2 | client/vitest.config.ts:20 | Aggregate coverage hides ContentInjector54.21% | Per-file80 and public ProseMirror operation tests | 2 |
| F11 | P2 | client/package.json:7 | Declared Node range includes versions excluded by jsdom/Vitest | Use supported intersection ^22.13.0 || ^24.0.0 | 2 |
| F12 | P2 | client/src/components/Task/index.ts:23 | Nonexistent exports and undeclared axios/router imports fail compilation | Remove impossible exports; reconcile used dependencies without enabling new UI | 2 |
| F13 | P2 | client/src/App.tsx:162 | React19 props/JSX/ref/nullability contracts fail strict compiler | Repair actual public component contracts and guards | 2 |
| F14 | P2 | client/src/components/Editor/EditorCore.tsx:608 | Editor/ProseMirror plugin and public type contracts fail compiler | Repair library API use while preserving transaction safety | 2 |
| F15 | P2 | client/src/types/ai-actions.ts:13 | Enums/parameter properties violate erasable syntax; BufferSource and guards fail | Preserve values and runtime behavior with correct syntax/types | 2 |
| F16 | P2 | client/src/components/Editor/TransactionFilter.test.ts:101 | 135 test diagnostics masked by transpilation | Repair test fixtures and signatures without suppressions | 2 |
| F17 | P2 | client/vite.config.ts:7 | Vite config contains invalid duplicate test property | Use existing separate test config and check tool configs | 2 |

### hygiene

| ID | Severity | Location | Fact | Action | Tier |
|---|---|---|---|---|---|
| H01 | P2 | client/e2e/test-trigger-debug.spec.ts:83; test-manual-trigger-click.spec.ts:64; new-user-audit.spec.ts:22 | E2E overwrites tracked screenshot evidence | Direct future output to ignored test-results, retain referenced documentation assets, untrack only disposable outputs | 2 |
| H02 | P2 | .gitignore:72 | server/coverage.json is not ignored | Add precise generated-report ignore | 1 |
| H03 | P2 | scripts/ralph/ralph.sh:40,71 | Tracked .last-branch is overwritten at runtime | Untrack/ignore exact state file; retain local bytes | 1 |
| H04 | P2 | LOCK_REFACTORING_TESTS_README.md:94,107 | Completed2025 migration still presents instructions to fail/implement | Archive intact with current guide pointer and repair links | 1 |
| H05 | P2 | client/package.json:52;PR181 | plugin-react6 needs Vite8, isolated PR retains Vite7 and fails | Coordinated migration proposal | 3 |
| H06 | P2 | client/eslint.config.js:30;PR176 | Hooks7 preset produces legacy plugins array and fails flat config | Migration proposal with actual preset validation | 3 |
| H07 | P2 | server/tests/conftest.py:52;PR172 | Pytest9 removes old path hook argument, collection fails | Migration proposal with collection_path compatibility tests | 3 |

### workflow

See [C01–C05](runs/2026-09-29/reviews/workflow-audit.md). All P2/Tier1, consolidated with documentation to avoid duplicate repairs.

All findings above are open at wave3. Closure and evidence will be appended after acceptance; historical sections remain unchanged.

### 2026-09-29 实施取证补充

- F02/F03（R11）：实际 app 编译首先复现15条 TanStack公共导出缺失；去掉遮蔽声明后该组清零。进一步用实际端点的原始 `app.openapi()` 与模型序列化比较，确认 `InterventionResponse.issued_at` 和三个 Anchor 的 `type` 总会输出，但响应 schema 未列为必填。该差异归入同票的服务端序列化描述修复；不得在生成器内静默补写必填语义。RED与保持输入默认值的检查见本轮日志。
- D-A/D-B/D-C：主 agent 核对并修正了文档 worker 漏项，保留依赖指南结构、历史命令正文、准确 Phase5来源、宪法与OpenSpec托管块。集成状态仍须等待 Wave5独立复核。

| 编号 | 严重度 | 文件:行 | 可验证事实 | 建议动作 | Tier |
|---|---|---|---|---|---|
| B15 | P2 | server/server/api/routes/stats.py:76 | period分支固定返回零，UserStats在生产代码只有模型和读取路径，未记录写作活动 | P-02明确日期口径、写作时间证据与最小持久化方案，待审批 | 3 |
| B16 | P2 | server/server/models/achievement.py:16 | 模型、定义与读取存在，但生产代码无成就授予写入路径，当前规范要求里程碑授予 | P-02明确指标来源、幂等授予及历史处理，待审批 | 3 |

B15/B16为提案来源核对中的追加发现。现有规范没有时间窗口、写作时长采集、回填及完整授予政策；清偿要求需要数据/行为选择，不能把字面零值或不存在的历史当作正确结果。当前不实施、不修改正式规范。

- F14（R15）补充：真实 Milkdown 初始化测试在当前 placeholder `$prose` 回调返回形状处失败（读取 undefined.state）；不是仅有静态诊断。首个有效 RED 见 `runs/2026-09-29/logs/R15-test-writer-02-red.log`。该插件当前未被 EditorCore 导入或挂载，因此这是导出插件的可复现契约缺陷，不能据此断言当前主编辑器启动失败。归入既有 P2 编辑器契约票，保持现有挂载范围和状态语义，尚待完成修复与复核。
