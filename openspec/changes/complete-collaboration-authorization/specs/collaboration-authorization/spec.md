## ADDED Requirements

### Requirement: Task Sharing Uses Explicit Persistent Capabilities
系统 SHALL 用现有 Task UUID 作为协作文档身份，从 Task owner 和持久化共享记录解析 read/write/admin 权限。owner SHALL 有全部能力；read SHALL 仅可读；write SHALL 可读和编辑；admin SHALL 可读、编辑并管理 read/write 共享，只有 owner SHALL 授予或撤销 admin。普通任务 CRUD SHALL 保持 owner-only。

#### Scenario: Owner opens an existing task
- **WHEN** owner 连接其 Task UUID 对应的协作房间
- **THEN** 系统 SHALL 允许读取和编辑，无需复制 owner 到共享表
- **AND** 未关联任何 Task 的房间 SHALL 拒绝访问，不猜测所有者。

#### Scenario: Reader attempts an edit
- **WHEN** 持久化角色为 read 的用户发送编辑 operation
- **THEN** 系统 SHALL 返回 permission_denied 且不修改、确认或广播该操作
- **AND** 该用户 SHALL 仍可读取有权限的内容与房间状态。

#### Scenario: Share administrator cannot elevate administrators
- **WHEN** admin 试图授予 admin 或修改 owner 权限
- **THEN** 系统 SHALL 拒绝，现有权限 SHALL 保持不变
- **AND** admin 对 read/write 的合法授予 SHALL 在提交成功后生效。

### Requirement: Permission Success Means Durable Commit
共享管理接口 SHALL 认证调用者、校验管理能力与目标用户，并仅在有效权限事务提交成功后返回成功。存储不可用 SHALL 返回明确失败，不能将日志记录当成权限保存。

#### Scenario: Grant survives process restart
- **WHEN** owner 成功授予 write，进程随后重启
- **THEN** 重新连接的受邀者 SHALL 仍可编辑，其他未共享用户 SHALL 无访问权。

#### Scenario: Permission commit fails
- **WHEN** 授予或撤销的存储事务失败
- **THEN** REST SHALL 返回 503 且不返回 success
- **AND** 原有有效权限 SHALL 保持，不发布成功变更。

### Requirement: Authorization Covers Existing Connections and Metadata
系统 SHALL 对房间内容、用户、统计和活跃房间列表按当前持久化权限过滤；每次协作读写 SHALL 重检有效角色。撤权 SHALL 阻止既有连接继续接收或发送任务数据。

#### Scenario: Access revoked during connection
- **WHEN** owner 撤销已连接用户的访问并提交成功
- **THEN** 系统 SHALL 关闭该连接并停止其后续内容读取/编辑
- **AND** 重新连接 SHALL 以无访问权限拒绝。

#### Scenario: Writer downgraded to reader
- **WHEN** write 用户被降为 read 后再次发送操作
- **THEN** 系统 SHALL 拒绝写入，即使连接仍存在且旧缓存角色为 write。

#### Scenario: Foreign room identifiers are requested
- **WHEN** 登录用户查询不可读任务的 users/stats 或 active 列表
- **THEN** 单房间 REST SHALL 返回 404，列表 SHALL 不包含不可读任务
- **AND** 健康检查 SHALL 不暴露这些任务标识、用户或内容。
