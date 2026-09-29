## Context

任务已有 UUID、user_id、content、lock_ids 和 version。当前协作服务从消息携带的 content 计算操作结果，使用独立 room.document_version，向 Redis 保存临时状态；这还不能证明重启后的文档保存或完整 OT 一致性。当前仓库没有持久化 documents/document_permissions。不得把缺失 schema 当成部署已经存在的数据。

## Goals / Non-Goals

目标是可保存的任务协作及可验证授权。非目标是另建文档产品、通用 ACL 框架、owner 转移、组织角色、完善所有 OT 算法或扩大普通任务 CRUD 的共享范围。写入需要经过既有任务版本与锁约束，不能绕开不删除约束。

## Recommended decisions

共享记录建议采用唯一 `(task_id, user_id)`、Task/User 外键、受约束的 permission 枚举和修改时间。owner 不重复存成可覆盖的共享角色。仓储只提供查有效角色、列可读任务、授予/撤销共享和持久化协作任务写入所需操作，构造时注入数据库/事务。

| 有效身份 | 读取任务内容/房间元数据 | 编辑协作内容 | 授予或撤销 read/write | 授予或撤销 admin |
| --- | --- | --- | --- | --- |
| owner | 允许 | 允许 | 允许 | 允许 |
| admin | 允许 | 允许 | 允许，不能修改 owner/admin | 拒绝 |
| write | 允许 | 允许 | 拒绝 | 拒绝 |
| read | 允许 | 拒绝 | 拒绝 | 拒绝 |
| 无共享或未登录 | 拒绝 | 拒绝 | 拒绝 | 拒绝 |

admin 提升政策是待批准建议；不得把管理员等同任务 owner。目标账户必须存在，权限值必须有效，唯一约束防止重复共享。保留现有 POST 查询参数和响应标识，成功响应去掉 pending note；撤销建议用同一资源的 DELETE，精确路径/参数随批准的接口清单确定，不接受任意 permission 字符串代替撤销。

认证失败 REST 401；缺失或无可见权限任务 REST 404；可读但无管理能力的修改 REST 403；参数验证 422；存储不可用或提交失败 503，不返回 success。WS 保留未认证 4001、无访问 4003；只读写入返回 `permission_denied` 错误且不执行/广播。撤回访问关闭既有连接；write 降为 read 的连接可保留，但下一次操作立即拒绝。每次读写重新核查数据库有效角色，Redis 广播撤权帮助及时断开，不作为唯一授权依据。全局 active 列表只返回当前用户可读任务；健康检查不暴露用户/内容或不可读任务标识。

## Persistence and protocol migration

连接首次读取 canonical Task 内容和锁；不把 Redis 内容覆盖已保存 Task。客户端提供的 content 不是权威。服务器读取已存内容，在写入事务内检查当前角色、操作范围、task_version 和锁约束，以任务的原子版本更新提交后再确认/广播；授权与撤权并发时，不能让旧角色检查绕过已提交的撤权。冲突反馈包含可恢复的版本信息，仅有读权限者可获得内容；冲突和失败不发布成功操作。REST 的 Task version 与协作写入共享一条版本序列；现有 WS `version` 的临时意义不能悄悄变化。

建议在功能开关后用显式协议版本/能力协商增加 task_version 与 lock_ids，拒绝未升级的编辑客户端并给出升级信息。握手形式、冲突消息字段和客户端清单在批准时确定。需要字符范围与锁信息完整往返测试；如无法保证既有锁保护，保持协作写入禁用，不能用“已有 OT”代替证据。

现有 tasks 不改 UUID/owner/content；初始共享集为空，owner 可访问。不从旧 permission 请求日志授予权限。无 task UUID 对应的 Redis 房间视为不支持，不自动新建 Task。迁移检查 FK、唯一约束、缺失账户以及真实 PostgreSQL 升降级；先备份，再扩展 schema，最后启用读/写。任务删除时共享记录随明确 FK 策略清理，内容和权限事务边界要核对。

## Alternatives and rollback

并行 documents 只在独立生命周期有需求时再讨论。撤回端点比维持假成功更诚实，但意味着功能退出，需通知已有客户端。rollback 关闭协作写入/共享管理，维持 owner 的普通任务 CRUD，保留已持久化数据；不回退到失效 schema 查询和虚假成功。清空共享表或恢复备份会丢失新授权，须单独批准。

## Open approval decisions

选择共享还是撤回、admin 授权范围、WS 版本协商及冲突消息、旧房间处置、写入锁范围如何复用既有规则。所有选择为 Proposed，批准前只做文档与来源验证。
