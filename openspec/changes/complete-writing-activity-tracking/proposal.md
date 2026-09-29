# Change: 补全写作活动统计与成就授予的证据路径

Status: Proposed / not approved。P-02，Tier 3，仅起草。以下均为待批准方案；不实施、不修改当前规范或既有验收条件。主代理独立集成、复核和接受。

## Why

当前规范要求采集写作统计、按时期聚合和达到里程碑后授予成就，但实际代码只有统计与成就读取路径。`server/server/api/routes/stats.py:76-94` 对 day/week/month 固定返回零；UserStats 没有生产写入调用；Achievement 没有授予调用且用户与类型索引不是唯一约束。零值不能证明没有活动。

任务有创建日期和 owner，干预历史有 mode、action_id 和日期，可以导出仍保留记录的部分计数；任务删除会级联删除干预，当前 lock_ids 不是历史锁创建记录。写作分钟数不能从 updated_at、字数或 LLM 请求耗时推算。需要批准数据语义和兼容政策，不能把这些缺口作为普通结构抽取直接补齐。

依据：[当前 stats 规范](../../specs/stats/spec.md)、[当前 achievements 规范](../../specs/achievements/spec.md)，以及 [design 的实际来源清单](design.md#current-source-evidence)。[READY ticket](<../../../.scratch/audit-2026-09/runs/2026-09-29/issues/P-02-activity-tracking.md>) 是本次范围来源。

## What Changes

- 推荐增加一张用途固定的、带日期和幂等身份的写作活动表，复用 SQLAlchemy、Alembic、现有事务和 UserStats；活动事实用于时期查询，UserStats 仅作为可重建的累计汇总。无需每日汇总表、事件总线、异步计数消费者或通用游戏化框架。
- 记录成功提交的任务创建、内容编辑、干预签发、首次持久化锁和有测量依据的写作区间。明确定义 UTC 日、周一开始的周、自然月，写作秒数、删除与修正、账户归属和重复请求处理。
- 推荐在现有 stats 路径通过显式 `contract=activity-v2` 选择新响应，未知/不完整指标返回 null 并附证据状态；真实完整空窗口才返回零。**BREAKING**：该合同下数值字段可为 null，新增时期边界、证据范围与日均任务数；客户端、生成类型、界面和导出需共同迁移。旧整数合同没有安全的未知值表达，不能继续把占位零当作准确统计。
- 复用现有八项成就定义及 Achievement 读取，建议同一用户与 achievement_type 只授予一次。任务阈值和首次干预随同事务判断；streak 授予依赖获批且经过行为验证的连续天数/宽限政策，不能读取当前“日期不同就加一”的结果直接发奖。
- 历史仅重建仍可证明的任务与干预记录，记录覆盖范围，不补造写作时长、删除历史、锁创建日期或历史达标日期。

## Impact

- Affected specs: 仅在 changes 内给既有 `stats`、`achievements` 增加窄范围要求，不修改 `openspec/specs`、归档规范或既有验收条件。
- Future affected interfaces: `/stats/`、`/stats/breakdown`、`/stats/period/{period}`、任务与干预写入的事务/重试边界、写作区间报告合同、成就授予、SQLAlchemy/Alembic、stats/achievement 客户端及 Stats/Export 展示。精确接口方案见 design，尚未启用。
- [refactor-remaining-route-service-boundaries](../refactor-remaining-route-service-boundaries/proposal.md) 只负责结构抽取。它不批准活动写入、聚合、未知值 schema 或授予政策，也不能削弱当前统计/成就规范。未来联合实现复用同一个小型服务和事务；新合同由本提案审批后才覆盖抽取中的兼容映射。
- [认证入口提案](../complete-authenticated-editor-entry/proposal.md) 负责身份与草稿隔离；本提案不从本地缓存或未认证请求推断 owner。[协作提案](../complete-collaboration-authorization/proposal.md) 的共享政策未批准，本提案暂只统计 owner 的普通任务写入，不默认为共享编辑者分配功劳。

## Alternatives and recommendation

推荐用途固定的活动记录，因为实际指标包含历史创建次数、首次锁、时期和可测量写作区间，且必须在删除后保持累计里程碑。成本是新增 schema 和写入事务编排，需先批准。

较小的替代方案是直接按 owner 查询 TaskModel 与 InterventionActionModel，提供“现存记录计数”，写作时长明确不可用。它不需要活动表，但删除后计数下降，无法可靠重建曾创建任务数、锁历史或全部里程碑；需由 owner 批准产品范围与描述变更，不能声称满足现有全部要求。每日汇总比活动表查询简单，但仍需持久化去重身份与写作区间才能应对重试、删除和修正，当前收益不足，详见 design 比较。

如果 owner 选择不支持统计/成就，可另行批准撤回具体 UI/API、调用者迁移和规范变更。此草案不执行撤回、不删除当前要求；单独隐藏界面或保留固定零值不能关闭缺口。

## Acceptance examples

以下为推荐路径的未来验收示例，不是已通过的测试或本票新获授权的实施条件：

- 一个完整记录的新账户成功创建两个任务，分别持久化一个新锁；重复请求、保存相同 lock_id 和提交失败不增加计数。当天统计为 tasks_created=2、locks_created=2；未测量写作时长为 null/unavailable。
- 2026-09-28 00:00:00Z 属于周一开始的新周；2026-09-27 23:59:59Z 不属于该周。2026-10-01 00:00:00Z 不属于九月自然月。
- 两个并发写入把任务累计数从 99 增到 101，只生成一个 hundred_tasks；重试和服务重启后仍只有一个，earned_at 为第一次有证据的达标事务时间。
- 完整测量的两个 35 秒、40 秒不重叠区间合计 75 秒，writing_minutes=1；完全重叠的两个 30 秒区间合计 30 秒。旧账户有任务但无时长证据，累计 writing_minutes=null，而非零。
- 删除任务后已提交的历史创建次数和已授予成就保留；错误记录按唯一修正身份重新汇总，不重新授予。另一账户既不能查询这些事实，也不能替别人提交区间。

更多可区分成功与合理失败的例子见 [stats delta](specs/stats/spec.md)、[achievements delta](specs/achievements/spec.md) 与 design；未来在公共 API/服务边界逐个 RED 后实现，禁止把静态格式验证当作功能通过。

## Migration, rollback and approval decisions

未来先备份并检查现有任务、干预、UserStats、成就及重复授予，再扩展 schema，按可证明来源进行可重复的有限重建；在客户端兼容和事务并发测试通过后启用。推荐采用保留表和新数据的功能回退，不运行会删除原有 sprint3 表的 downgrade。回退期间的新写入使覆盖出现缺口，恢复后明确标记部分/未知，不补零。

待主代理与 owner 批准：活动记录还是现存记录的缩小范围；UTC 边界与累计/删除语义；签发干预和持久化锁的口径；写作测量上限、覆盖标准及报告接口；v2 schema、旧合同弃用节奏；永久唯一授予与历史重复处理；streak 的独立行为依赖；历史重建和保留政策。所有 [tasks](tasks.md) 保持未勾选。严格 OpenSpec 格式通过不代表这些选择已批准。
