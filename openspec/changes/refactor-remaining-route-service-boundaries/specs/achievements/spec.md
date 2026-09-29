## ADDED Requirements

### Requirement: Existing Achievement Reads Use Minimal User-Scoped Services
成就列表和单条读取 SHALL 委派给注入的窄服务/仓储，保留账户过滤、earned_at倒序、分页、字段和错误映射。静态 definitions SHALL 保留现有八项定义，不要求无业务价值的包装服务；本抽取 SHALL 不新增授予功能。

#### Scenario: List owned achievements
- **WHEN** 已认证用户查询成就列表
- **THEN** 系统 SHALL 保留当前账户过滤、total/limit/offset 和时间转换，metadata=null。

#### Scenario: Missing database and foreign achievement
- **WHEN** session 不可用而查询列表/单条，或单条属于其他用户
- **THEN** 列表 SHALL 保留空200，单条 SHALL 保留无数据库500或 foreign404。
