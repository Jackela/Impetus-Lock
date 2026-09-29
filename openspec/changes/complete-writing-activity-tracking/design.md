## Context

建议使用用途固定的活动事实满足现有统计与成就能力，并显式显示历史证据不足。P-02 仅提出审批选择；本文不是已决架构，也不是实施授权。来源基点为本 worktree `7e255bed593cad28f0b4022cc04c822875e1e088`，实施前需重新核对主代理集成结果。

## Current source evidence

| 实际来源 | 已观察事实与限制 |
| --- | --- |
| [stats routes](../../../server/server/api/routes/stats.py):17-94、[schema](../../../server/server/api/schemas/stats.py) | 累计/breakdown 只读取当前用户 UserStats；无记录返回零，无 session 为500。period 校验 day/week/month 后固定零，不查询时期。schema 全为整数，没有覆盖/未知字段，也没有 average_tasks_per_day。 |
| [UserStats](../../../server/server/models/user_stats.py):15-49 | 唯一 user_id、累计字段、writing_minutes、last_activity_at；无日期维度。对 server/server 的定向搜索只发现模型与两个读取路由，无 writer。模型的 estimated 描述不是时长证据。 |
| [achievement routes](../../../server/server/api/routes/achievements.py)、[model](../../../server/server/models/achievement.py):38-51、[sprint3 migration](../../../server/alembic/versions/20260413130000_add_sprint3_tables.py):24-53 | 八项定义和 owner 过滤读取；无授予写入调用。`idx_achievements_user_type` 为普通索引，不能防止重复授予。列表当前无 session 返回空200；这是观察结果，不是可用证据。 |
| [TaskModel](../../../server/server/models/task.py):49-114、[TaskService](../../../server/server/application/services/task_service.py):447-649 | 任务有 owner、创建/更新 UTC 日期、当前 lock_ids 和版本；owner 写操作经过一次注入 transaction.commit。创建没有持久化请求去重身份。删除级联 actions。 |
| [InterventionActionModel](../../../server/server/infrastructure/persistence/models.py):37-100、[repository](../../../server/server/infrastructure/persistence/postgresql_task_repository.py):163-210 | task_id 外键级联删除、唯一 action_id、mode/issued_at/created_at；无独立 user_id，通过任务归属。save_action 只 flush，不 commit。 |
| [InterventionService](../../../server/server/application/services/intervention_service.py):259-325、[route](../../../server/server/api/routes/intervention.py):149-241 | 只有传入 repository 与 task_id 才保存 action；route 按账户/任务/Idempotency-Key 分区，15秒缓存串行化；先提交再发布缓存。过期/重启后仍可能生成新 action_id，不能用 action_id 唯一性证明同一请求永不重复。LLM latency 是推理耗时。 |
| [writing state hook](../../../client/src/hooks/useWritingState.ts) | Muse 专用本地 idle/STUCK 检测，未持久化时长，不覆盖 Loki/off、后台页签或跨设备。不能直接累计它的运行时长。 |
| [stats client](../../../client/src/services/api/statsClient.ts)、[Stats](../../../client/src/components/Stats/Stats.tsx)、[Export](../../../client/src/components/Export/Export.tsx) | number 字段直接显示/导出，需同步认识 null 和证据状态；生成 API 类型也依赖当前整数 schema。 |
| [achievement client](../../../client/src/services/api/achievementClient.ts)、[Achievements](../../../client/src/components/Achievements/Achievements.tsx) | definitions 与 earned records 组合显示；错误或数据不可用不能在新展示中被默认为全部未获得。 |
| [StreakService](../../../server/server/application/services/streak_service.py):62-105、[当前 streaks 规范](../../specs/streaks/spec.md) | 同日不增加，任意后续不同日期增加；注释明确宽限/恢复未实现。聚合行没有完整逐日历史。既有规范要求任务创建/编辑更新和1天宽限，不能把现有计数当正确连续天数。 |

读取了五份当前待批准 proposal，并重点对照 [剩余路由抽取 design](../refactor-remaining-route-service-boundaries/design.md) 及其 stats/achievements delta。其余工具链提案无统计行为重叠；认证、协作关系见 proposal。本票未扫描无关历史归档，未使用旧审计结果代替当前代码事实。

## Goals / Non-Goals

目标是有证据的累计、时期、干预分布、写作时长与唯一授予，保留 unknown 的意义。只用现有 FastAPI/Pydantic、SQLAlchemy/Alembic、小型服务和注入的窄仓储/事务。辅助功能保持 P2 或以下。

不新增事件总线、通用 activity SDK、泛化奖励引擎、队列、跨产品遥测或性能预聚合体系。不修复整套 streak 业务，不新增 Special 徽章，不改变锁保护/共享/认证政策。现有 Achievement Types 对 Special 的要求仍在；当前八项定义未单独声明该类别，属于另一个明确的审批缺项，不能因本次授予补全而声称整个成就规范已完成。

## Alternatives considered

| 路径 | 收益 | 无法省去的成本或证据缺口 |
| --- | --- | --- |
| 直接查询 TaskModel + join InterventionActionModel | 最少 schema，按 owner/created_at 可以统计现存任务与已保存的 Muse/Loki action | 删除会移除来源；不能证明全部曾创建次数。当前 lock_ids 不提供首次创建日期，issued lock 不证明保存，历史时长不可用。需要批准缩小产品语义，不能用零补齐。 |
| 一张带日期、固定种类的活动表 + 复用 UserStats（推荐） | 保存首次事实和去重身份，支持时期、删除后累计、区间和可重建汇总 | 增加窄 schema/事务写入、覆盖信息和重试合同；不存正文。保留最小身份是去重和修正的实际需求。 |
| 每用户每日汇总 | 时期求和快、行数少 | 汇总本身不保留请求/锁唯一身份，也不能处理重叠区间、错误修正和来源删除。仍需另一去重记录或来源明细，当前不足以比推荐方案更小；无性能证据前不叠加 daily table。 |
| 经 owner 批准撤回不支持的 UI/API | 避免继续显示假数字 | 需要另行批准能力退出、API弃用、调用者迁移和规范变更；本次不选、不执行。 |

## Proposed fixed activity data

建议一张 `writing_activity`，字段仅包含 UUID、认证 user_id 外键、可空 task_id（删除后置空）、保留的非正文 source_key、固定 kind、UTC occurred_at、记录时间、幂等 operation_key、必要的区间起止/秒数及 correction 引用。source_key 保留原任务 UUID/版本或 action/lock 身份，不复制上下文、正文、凭证。账户删除按现有用户外键政策清理其数据；普通任务删除不级联清除活动。

固定种类及来源如下；它们不是可由客户端任意声明的事件名：

| kind | 可信提交来源与唯一身份 | 计数口径 |
| --- | --- | --- |
| task_created | owner 创建成功；`(user, kind, task UUID)`，另绑定创建请求 key | 曾成功创建的任务数；不是当前任务库存 |
| task_edited | 实际内容变更并成功保存；`(user, kind, task UUID, committed version)` | last_activity 和日均覆盖；不增加创建数，标题/优先级变更与重复保存不证明写作 |
| intervention_issued | 认证 owner 的任务关联请求，已保存 action、同事务提交；`(user, kind, action_id)` 及请求 key | 成功保存并签发的 Muse/Loki 数；不证明编辑器实际应用或用户阅读 |
| lock_created | 创建/保存任务时首次出现的新持久化 lock_id；`(user, kind, original task UUID, lock_id)` | 每个任务内同一锁只计一次；不按每次保存、不按未保存的 LLM 建议计数 |
| writing_interval | 经认证、任务归属校验的有测量区间；`(user, kind, session UUID, sequence)` | 合并账户所有任务/页签的重叠区间后累计秒数，随后换算分钟 |

复用 UserStats 的唯一 user_id 作为写入串行化和累计汇总位置，增加最小覆盖/秒数字段的具体 migration 待批准。period 查询由活动事实按范围聚合；breakdown 与累计读同一证据范围。汇总是派生值，不能比活动表更“权威”。精确约束可使用 kind/source_key 和 operation_key 的受限唯一组合，不引入通用 JSON 事件 payload。

## Proposed metric and time boundaries

推荐固定 UTC，避免新增用户时区设置和历史重新分桶；API 显式返回 `timezone="UTC"`。day 是当天00:00到次日00:00；week 为当周周一00:00到下周周一00:00；month 为当月1日00:00到次月1日00:00。均为 `[period_start, period_end)`，一次请求固定 as_of，仅纳入 as_of 前已提交的事实。occurred_at 为业务事务内取得的服务端 UTC 时间，只有提交成功后才可见，不宣称它是数据库精确 commit 时刻。写作区间跨边界按实际秒数拆分。

period 返回本日/本周/本自然月截至 as_of 的结果，不是滚动24小时/7天/30天。允许改为用户时区是有实质差异的替代选择，需另批 timezone 来源、夏令时、变更后是否重算历史，不能默用浏览器/服务器本地时间。

累计是 tracking_start 到 as_of 加上已证实的有限历史；创建数、干预数、锁数是历史发生次数，普通删除不减少。last_activity_at 为已证实的最近 task_created、task_edited 或 writing_interval 结束时间；AI 签发、纯元数据修改不冒充用户写作。

average_tasks_per_day 建议按统计窗口内已覆盖的 UTC 日数（含当前日）除任务创建次数；覆盖从账户创建与采集启用两者中较晚者开始。不以“有任务的天数”为分母。完整七日3次创建为3/7，展示时保留两位小数；范围不完整则完整指标为 null，只在证据 metadata 中给已观察次数/已覆盖日数，不能用残缺历史计算准确的累计日均。

## Proposed writing-duration evidence

推荐一个窄的认证报告合同：`POST /stats/writing-intervals`，使用现有 cookie/CSRF。服务端先给当前账户、owner task 发短会话身份与服务端时间锚；报告 session_id、sequence、相对单调时钟的起止及区间内输入证据，不接受 user_id、任意绝对历史时间或任意累计分钟数。精确请求/响应 schema 与会话锚创建方式须批准后再写代码。

测量面向 Muse/Loki/off 全模式。只累计前台可见、编辑器有焦点且最近5秒有真实用户内容输入的时间；idle、隐藏、失焦、会话过期或账号切换立即停止。每段最多60秒，秒数保留原精度，累计后才 `floor(seconds/60)`；例如35+40秒为75秒、1分钟，不逐段截断为零。校验时间顺序、非负、服务器会话经过时间和合理输入范围，超过界限422；其他账户的会话/任务404。重试相同 sequence 不再次累计，改变同一身份的内容409。

并发页签/设备的有效区间按账户时间轴取并集；完全重叠30秒只算30秒，不能按 task 分别加后再求和。跨日区间分别归入两日。客户端测量只是受校验的估计，需给 `measurement="foreground-input-estimate"`，不将其描述为经过独立确认的实际工作时长。

这是新增行为、仍待批准，现有 Muse idle hook 不足以证明完成。迟到或离线报告仅在已保存会话锚的短期限（推荐5分钟）内接受，超过期限不编造历史；保留缺口标识。只在协议保证整个窗口已覆盖时用零表示“无活动”。没有报告、旧客户端未测量、会话缺最后区间、服务停用或未关联任务的本地写作都不能单凭沉默证明零。若不能证明完整覆盖，返回 partial/unavailable 与已观察秒数。服务器可确认从未有写作任务/会话且覆盖完整的新账户为零；存在未测量写作的账户为未知。

## Proposed public schema and compatibility

推荐在三个现有 stats GET 路径加入显式 `contract=activity-v2`，保留原字段名称，新合同数值类型为 `int | null`（average 为 `float | null`）。附 `as_of`、`timezone`、`tracking_started_at`、`evidence`；period 另附 `period_start`/`period_end`。`evidence` 按字段返回 `status: complete | partial | unavailable`、`covered_from`、`reason` 和可空的 `observed_value`。complete 时主字段等于准确测量/定义范围值；partial 时主字段 null，observed_value 只表示已证实部分；unavailable 时两者均 null。日均只在分子/分母都完整时返回数值。

示例：老账户有两条仍保留的创建记录，但删除历史未知，则 `total_tasks=null`、evidence.total_tasks 为 partial/observed_value=2；其写作时长 unavailable/null。启用后的完整当天有2次创建且无时长测量，则 tasks_created=2、writing_minutes=null。完整覆盖且无任何活动的窗口，各计数0、last_activity_at=null。数据库故障是错误，不是“完整零”；新合同三个 stats GET 均建议返回503，非法 period 保留400，认证/CSRF沿用修复后的合同。

这与旧 schema 不兼容，必须显式选择，不能静默给 number 消费者返回 null。迁移建议：新服务及消费者一起启用，更新 statsClient、生成类型、Stats、Markdown/JSON Export；unknown/partial 显示“不可用/记录不完整”，导出保留 null/status。旧合同停止返回未经证实的零：完整证据且所有旧字段可表达时映射为整数；证据不足则建议409/detail.code=`stats_contract_upgrade_required`。这也是需批准的兼容行为改变，替代选择为独立版本路径和明确弃用期限；不得永久保留旧零值作为成功兼容方案。

干预主计数按“已保存的任务关联签发”定义，需相应说明 UI/导出标签。现有无 task 请求及匿名/本地写作不推断个人 owner，不获得个人授予；若 owner 要求将认证但无 task 的签发也纳入，须另批其最小持久化、请求去重和证据覆盖，不能偷偷把这些排除项当成全部 received 总数。

## Proposed transaction, retries and ownership

活动、派生 UserStats 和新授予与对应任务/action 使用同一 AsyncSession/一次 commit；没有另一次事后“加一”。可先 flush 同事务事实，但读取、缓存、确认或授予通知只能在成功 commit 后发布。采集/授予失败应回滚整个写事务，不能成功保存任务却无声丢计数；LLM 已调用但 commit 失败不记成功干预。session-less testing fallback 不构成持久化证据。

建议先用 user_id 唯一 upsert 初始化 UserStats，再 `SELECT FOR UPDATE` 锁该用户汇总行，在固定顺序下检查请求身份、写业务事实、插入独特活动、更新汇总并判断里程碑。同用户并发串行化避免丢更新；唯一约束是最后防线，禁止仅用 Python 先查再插。同事务一致读取用于统计，不能累计一半新的总数、一半旧的 breakdown。无需通用 UnitOfWork 框架。

幂等身份必须持久化并保留至账户删除，缓存TTL不是正确性边界。建议 task create 新增 v2 的必需 Idempotency-Key，活动记录绑定 authenticated user、操作种类、key、request digest 和 task UUID；重试复用同一任务，冲突 payload409，已删除任务的旧key返回410，不重新创建。当前无 key 的旧写入是否拒绝/如何弃用须批准；每个新的独立创建必须用新key，不能按相同正文去重。任务编辑用已有 task UUID + 已提交版本识别同一次成功更新，不把失败409当新活动。

AI 沿用当前账户/任务/key 分区与“首个结果优先”的重试语义，把持久化请求身份关联到已存 action；缓存过期或重启也重放已提交 action 的结果，不再调用 provider 生成新 action_id。现有 action 字段是否足以重建全部 InterventionResponse 字段须在实施时逐字段核对，必要的最小响应字段与映射另批，不能在活动表复制正文当通用缓存。已删除关联任务先做当前权限/存在检查，拒绝而不重发旧正文。失败事务不占用成功身份；提交结果不明的重试先查已提交身份而非再次调用。

所有个人读写按认证身份过滤；task/action 的 owner 从已验证 TaskModel.user_id 得到，不接受请求体伪造。统计查询不接受任意 user_id。新写作会话绑定同一认证账户与 owner task，账号切换不可沿用；未来共享行为由协作提案批准后才决定，不自动把 owner 改为 actor。

## Proposed deletion and correction

普通任务删除只移除当前内容及原干预明细，保留不含正文的已提交活动事实和历史次数；task_id 置空但原 source_key/请求身份保留。已发放成就是历史里程碑，不因普通删除、跨日或重新达到阈值撤销/重复。未保存的锁建议和重放不增加 locks_created。

需要修正错误采集时，仅允许经过明确授权的内部数据修正流程，对原事实建立唯一 correction 身份并标记取代/作废，按有效事实重新求和；重跑不再次减计数，不改用户正文。汇总与时期读统一排除被作废事实。发现既有授予根据错误来源产生时保留原记录与审计依据，标记待 owner 决定撤销，不自动删除或重写 earned_at。这不是新增管理后台或公开“任意加分”API。

## Proposed milestone policy

复用现有类型：first_task=1、ten_tasks=10、hundred_tasks=100 次已证实创建，first_muse/first_loki=首个成功持久化签发。达到多个阈值时分别生成对应类型，各自唯一 `(user_id, achievement_type)`；增加数据库唯一约束/受控重复清理，而非仅重复普通索引。达标判定与事实在同一事务，earned_at 为首次有可信证据的达标事务时间；重试与后续累计不改变时间。不因读列表执行隐式授予。

streak_3/7/30 只接收既有连续写作/宽限政策的已验证资格结果，仍复用其类型/读取。本票不选择新的宽限算法，也不把当前 StreakService 观察行为当正确政策；获批实施需另行解决 task create/edit 接入与宽限缺口并留下公共边界证据。在该依赖未完成时三项授予保持不可用且明确说明，不能用“任意三个不同日期”或历史聚合行猜测。仅实现任务/干预奖励不足以声称所有成就功能完成。

现有定义保持八项，不凭 Special 类别要求猜新奖项。未来 definitions/list 展示需要明确区分 earned、未获得与因证据/依赖不足而不可评估；可以在 definitions 增加可选 availability/reason，但精确 schema 尚需批准，不改变旧 earned records 的 UUID/名称/时间。

## Migration Plan and rollback

1. 批准方案后备份既有 tasks/actions/UserStats/achievements/streaks，检查 timezone、孤立记录、旧汇总来源和 `(user,type)` 重复组；同名模型与迁移约束逐项对照。不得用默认零证明历史空活动。
2. 新增活动/覆盖/幂等字段及受约束固定 kinds，保持原任务/成就 UUID、内容、owner 和时间；新增表索引按 user/time 与唯一身份。成就重复组先停在预检查，不自动删除：由 owner 选择保留最早 earned_at 为有效授予并把其他完整行复制到恢复证据后再清理，或批准另一合并政策；原始每条数据可恢复后才建 unique。
3. 重建仅限仍保留且可关联 owner 的 Task.created_at 和保存的 InterventionAction.issued_at，身份来自既有UUID/action_id。重跑相同来源不再插入。删除历史缺失使累计范围 partial；updated_at 不重建每次编辑。当前 lock_ids 只证明现在存在，不回填锁创建日期；旧 UserStats 无来源数值单独保留，不能与重建活动相加。无历史 timing 数据时 writing_minutes 永远未知于该历史范围。
4. 推荐对重建已证实达到的任务/干预阈值，在获批启用事务授予并以启用/评估时间 earned_at、记录历史来源标识，绝不伪造当年的达标日期；另一选择是只对启用后新活动授予，需 owner 明确选择。两种不混用。旧已有授予保留；streak 不用聚合行补发。
5. 在功能开关下接入现有写入的同事务事实与持续身份，验证真实 PostgreSQL 唯一/并发/回滚、v2响应、消费者和导出。启用时间写成明确 UTC coverage_start；旧/不兼容客户端写入和采集故障使相应 metric 覆盖不足。未知值不得被默认值吞掉。
6. 推荐回退只关闭新采集/授予及v2入口，保存新增事实/汇总/请求身份/原授予与备份，不执行旧 sprint3 downgrade，也不降级删除表。不能回退到对未知时期返回准确零；使用明确 unavailable/error。回退期间业务写入可继续但产生 coverage gap，重启采集后保留该缺口，只重建可证明的记录。若必须恢复旧 schema，先独立批准导出并校验新数据、再做可恢复转换，不默认 drop。

## Future acceptance and evidence

未来测试通过公共 task/intervention 写入、stats/achievements GET 和获批的区间报告边界观察结果，不为私有方法写镜像断言。每个行为先 RED、最小实现后 GREEN；真实 provider 与浏览器不属于本票。

| 场景 | 可核对的预期 |
| --- | --- |
| 完整七日窗口3次创建 | tasks_created=3，average_tasks_per_day 约0.43；不是3/活跃日数 |
| UTC 9月27日23:59:59 与28日00:00:00创建 | 后者在9月28日开始的新周，前者在上一周；同样按月初排除边界 |
| 99任务并发两次创建，随后过15秒/重启重试 | 累计101；hundred_tasks 只一条且首次时间不变 |
| task/action/活动或授予 commit失败 | 不增加统计、不出现成就、不发布成功缓存；独立重试可成功一次 |
| 同锁保存、删除后旧key重试 | locks只首次计1；创建数保留；旧key410，不创建新任务 |
| 35秒 + 40秒、重叠30秒、跨午夜60秒 | 分别75秒/1分钟、30秒/0分钟、两日各30秒；按总秒汇总，不逐段丢秒 |
| 旧账户仍有两任务但无历史时长 | total_tasks null/partial/observed=2；writing_minutes null/unavailable；不授予猜测的历史时间 |
| 完整空窗口 vs 数据库故障/采集缺口 | 空窗口0/complete；故障503；缺口null/partial或unavailable |
| 用户B伪造用户A任务/会话、账号切换 | 写入拒绝；B的读取不泄漏A的次数、区间、时间或成就 |
| 隔日但不连续的历史 streak 行 | 不作为streak奖依据；宽限依赖待验证，旧读取/规范不在本票改写 |

## Open approval decisions

尚待决定：是否采纳活动表；全部指标还是缩小到现存记录；UTC或用户时区；删除后的历史语义与修正保留；干预签发/持久化锁口径和无task范围；估计时长的5秒/60秒/5分钟候选限制与可信覆盖；v2 opt-in/409兼容弃用安排；创建/干预的永久请求身份及完整重放字段；重复授予合并与历史补发政策；独立streak资格依赖、Special缺项归属。格式验证不批准这些选择，批准前不开始实施。
