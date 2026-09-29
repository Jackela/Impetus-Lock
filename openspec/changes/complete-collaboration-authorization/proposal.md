# Change: 完成基于任务的协作持久化与授权

Status: Proposed / not approved。P-01，Tier 3，仅起草；不包含实现、批准或发布。

## Why

现有协作接口使用 `document_id`，但实际持久化对象是 `tasks`。`check_document_access` 查询的 `documents`、`document_permissions` 未在当前模型或 Alembic 迁移中定义，查询异常被转换为拒绝访问。`POST /collaboration/rooms/{document_id}/permission` 只记日志，却返回 `success: true`，没有保存权限；连接时又把 read/write/admin 混为一种访问能力。Redis 房间内容有一小时 TTL，也不是任务持久化的替代品。

依据：`server/server/api/routes/collaboration.py` 的权限检查、消息处理和权限端点；`server/server/infrastructure/websocket/{collaboration_service,redis_pubsub}.py`；`server/server/models/task.py`；`server/alembic/versions/`。本轮 backend-audit B13 为提案来源，B09 的管理器依赖修复属于独立 R10，不由本提案实现。

## What Changes

- 推荐复用 task UUID：协作房间的 `document_id` 指向一个现有任务，不再创建并行文档实体。
- 新增明确的任务共享记录，保存 task_id、受邀 user_id 和 read/write/admin 权限；任务 owner 始终来自 `tasks.user_id`。
- 把读取、编辑、共享管理分开授权；REST 查询和 WebSocket 每次写入都检查当前权限，撤权后阻止既有连接继续访问。
- 只有事务提交成功才确认权限修改或协作写入；持久化内容、lock_ids 和任务版本统一以 Task 为准。Redis 只负责临时状态和传播。
- **BREAKING**：旧权限假成功响应被实际成功或失败替代；未授权的房间元数据不可读取；现有无任务关联的房间不自动获得所有权。WebSocket 持久化版本协议需要明确迁移。

## Impact

- Affected specs: 复用 `task`，新增集中描述共享政策的 `collaboration-authorization`。现有任务 CRUD 的 owner-only 要求保持；本提案不开放共享者直接调用通用任务 CRUD。
- Affected interfaces: `/collaboration/ws/{document_id}`、房间 users/stats/active、permission 端点、协作消息、TaskService/任务仓储、共享仓储和迁移。
- 前置：集成并重新核对 R10 的单一管理器组装；实现时依赖本轮认证、任务版本和所有权修复后的基线。
- 独立于路由抽取提案：后者不能代替这里的授权政策或创建共享 schema。

## Alternatives and approval choices

推荐“现有任务 + 显式共享记录”，因为内容、锁、版本和所有者已有唯一持久化身份。并行 `documents` 实体需要内容同步、双重所有权和迁移，当前没有独立文档生命周期依据。

另一可行路径是撤回尚不支持的协作端点及客户端入口，明确不可用，不保留权限假成功。若不批准共享功能，采用这一路径需单独确认弃用清单和调用者迁移；这里的规范草案只描述推荐路径，不把两条互斥路径同时作为验收要求。

待批准选择：是否交付任务共享，或撤回协作；是否采纳 owner-only 授予 admin 的规则；WebSocket 如何协商 task_version；旧无关联房间是丢弃临时状态还是由 owner 显式导入。这些均未获批准。

## Acceptance, migration and rollback

草案场景覆盖 owner/read/write/admin/无权限、两名用户、撤权后继续发送、重启后授权与内容、失败提交、版本冲突和锁保护，见 delta specs。未来实现先做迁移备份与孤立记录检查，再建共享表，最后在功能开关下启用持久化协议；不根据日志或 Redis 状态补造权限。

回退先关闭协作入口并拒绝权限写入，保留已写入任务内容和共享表以供恢复；仅在确认无新授权数据且有备份时回退 schema。不得恢复返回假成功的旧权限接口。严格格式通过不代表这些行为已验证。
