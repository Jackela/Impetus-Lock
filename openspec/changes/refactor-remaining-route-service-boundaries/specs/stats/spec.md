## ADDED Requirements

### Requirement: Existing Statistics Queries Use Minimal User-Scoped Services
统计账户查询和映射 SHALL 委派给注入的窄服务/仓储，并保留现有字段、账户隔离、无记录零值、ISO时间及数据库不可用错误。此次结构抽取 SHALL 不削弱现有 User Statistics 的时期聚合要求；当前 period 占位与活动采集缺口 SHALL 作为未完成行为另行审批，不能作为正确统计合同。

#### Scenario: No statistics record exists
- **WHEN** 已认证用户无 UserStats 记录
- **THEN** `/stats/` SHALL 返回当前全零指标和 last_activity_at=null，breakdown SHALL 返回零 muse/loki。

#### Scenario: Database unavailable or invalid period
- **WHEN** session 不可用而请求 stats/breakdown，或 period 参数无效
- **THEN** 系统 SHALL 分别保留 500 或 400，不改成成功空数据。

#### Scenario: Period stub is discovered during characterization
- **WHEN** 对照规范发现 period 路由对有活动的用户仍固定返回零
- **THEN** 团队 SHALL 保留缺陷证据并单列活动采集与聚合的待审批行为方案
- **AND** 结构抽取 SHALL 不将占位值写成正式正确结果或宣称时期统计已完成。
