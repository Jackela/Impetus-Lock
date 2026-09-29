## Context

Article IV 要求业务进入服务，Article I 同时要求最简单可行结构。已完成 tasks/templates/streaks 抽取不重做。当前来源是本 worktree 的实际代码；未来实现须用主代理集成 R09/R10 后的安全基线重新刻画合同，不能用这里的越权行为作为兼容承诺。

## Public contract inventory

以下路径省略 host。通用 auth/CSRF 由已授权修复后的 middleware/client 合同决定，FastAPI 422 参数校验和现有 schema 字段保持。

| 路由族 | 当前实现观察；缺陷条目不构成正确性合同 |
| --- | --- |
| POST /style/analyze | 201；text/user_id 输入和 StyleVector 输出；持久化 profile 的 samples_count/version 增加，但当前响应 samples_count 始终为1，不顺带改成累计数；向量算法与 confidence 计算不变；无 session 仍返回分析结果，不声称保存 |
| POST /style/apply | 200；original_text/styled_text/style_applied/style_version；无 profile 404，非法持久化向量 500；无 session 使用当前默认向量与 version=1 |
| GET/DELETE /style/profile/{user_id} | 200/204；profile 含向量、样本数、版本、日期；缺失 404，无 session 503；用户身份与 foreign 拒绝以 R09 的已修复合同为准 |
| POST /style/compare | 200；欧式距离按当前数值公共键计算并除以键数，返回四位小数、排序 radar 数据和现有 insights 阈值；无公共数值键距离为 1.0，不更换算法 |
| POST /style/history | 201；text 最少 100 字符，返回 UUID/user_id/text/style_vector/created_at；IntegrityError 409、OperationalError 503、ValueError 400，保留 detail 对象 |
| GET /style/history/user/{user_id} | 200；items/total/limit/offset，limit 默认10且1–100、offset>=0，按 created_at 倒序；账户检查以 R09 为准 |
| GET/DELETE /style/history/{history_id} | 200/204，缺失/foreign 404；只删除实际匹配行，保留 R09 的真实删除结果 |
| GET /stats/ 与 /stats/breakdown | 200，当前账户 UserStats；无记录返回各指标零且 last_activity_at=null，无 session 500；时间为 ISO 字符串 |
| GET /stats/period/{period} | day/week/month 返回200及当前零值响应；非法 period 返回400；当前无实际时期聚合，不以抽取实现之 |
| GET /achievements/definitions | 200，现有八项定义、顺序和描述，transport 下的认证规则保持 |
| GET /achievements/ | 200；total/limit/offset/achievements，默认limit100且1–100；user过滤、earned_at倒序、metadata=null；无 session 返回空列表及当前分页 |
| GET /achievements/{achievement_id} | 200；UUID校验422，missing/foreign404，无 session500，时间与metadata转换保持 |
| /collaboration/* | WS 4001/4003、join/operation/cursor/selection/awareness/ping 消息、REST users/count/stats/rooms及health 字段先刻画；共享政策与持久化版本改变只按另外获批提案执行 |

当前协作权限 POST 假成功、absent schema、时期统计固定零值和无授予写入路径均不是需要延续的正确合同。缺少活动日期、写作时长和授予政策的部分由 `complete-writing-activity-tracking` 单独提出数据与行为选择；结构抽取不削弱正式 stats/achievements 规范。仅完成抽取不足以声称这些功能已验收。

## Necessary service and repository seams

StyleService 接收已认证 user_id、文本/向量/强度以及注入的 profile/history 仓储；分析/转换可保留纯函数，并核对现有调用者后移动，避免重复算法。StyleHistoryService 负责已修复的所有权与结果检查，复用现有仓储；列表和数量必须同一用户过滤。

Stats 的账户查询与零值映射、Achievements 的账户过滤/列表/单条查询交给小型服务，仓储只具备现有 get/list/count 能力。静态 definitions 无需一个专门仓储。period 的简单枚举校验可留 HTTP 层，零值业务返回可放 StatsService，但不创建虚构的聚合仓储。

CollaborationService 已存在于 infrastructure websocket；对授权、共享或任务持久化的应用操作使用独立的小型服务/窄协议，连接、JSON解析和Redis传输保持在适配层。不能把整个 WebSocket 实现机械移到 application，使应用层依赖 FastAPI。与权限提案联合实施时复用同一个授权服务；独立抽取时先明确哪些操作可在既有合同下迁移。

服务不实例化仓储、session 或 Redis；依赖工厂在组装处创建并注入。协议只列使用的方法，服务接收明确身份，typed errors 到 HTTP 的转换留路由。每个写操作明确一处 commit/rollback；profile analyze 的写入失败不能返回成功保存。历史仓储自身 session 生命周期与事务归属先核对，不叠加第二次 commit。

## Alternatives, migration and rollback

保留简单 transport 是推荐的一部分，不与服务原则冲突。保留所有业务在路由不能满足 Article IV；统一基类/通用 repository 则成本大于收益。

先刻画集成后的 API，逐个领域移动必要规则/查询及依赖，保持 schema 和算法，比较完整响应和失败结果。无独立数据变更；权限持久化的迁移仅属于另一提案。失败时一起恢复该领域依赖工厂与路由到安全基线，保留 R09/R10。统计/成就 spec 与 runtime 的差异继续列为未解决行为事项，不顺带修改正式规范。

## Open approval decisions

批准最小服务分组、事务归属、与协作授权提案的先后顺序。任何新增时期聚合、授予逻辑、共享数据或 API 变化均不在本次抽取授权内。
