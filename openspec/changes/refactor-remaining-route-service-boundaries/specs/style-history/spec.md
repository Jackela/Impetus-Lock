## ADDED Requirements

### Requirement: Existing Style History Uses User-Scoped Service Operations
现有 style history SHALL 通过显式已认证 user_id 的注入服务复用窄仓储，保留当前 schema、排序、分页和 201/200/204/400/404/409/503 映射。服务 SHALL 在读取或删除前采用已修复的所有权合同，不能因抽取恢复越权或假删除成功。

#### Scenario: History list and count use one identity
- **WHEN** 用户请求其历史分页
- **THEN** items 和 total SHALL 都过滤至同一用户，并保留 created_at 倒序、limit/offset 约束。

#### Scenario: Missing or foreign history is deleted
- **WHEN** 请求删除不存在或属于其他用户的 history_id
- **THEN** 系统 SHALL 返回 404 且不删除其他用户数据。

#### Scenario: History creation fails
- **WHEN** 仓储抛出 IntegrityError、OperationalError 或 ValueError
- **THEN** 路由 SHALL 分别保留 409、503、400 的现有 detail 对象，不产生成功响应。
