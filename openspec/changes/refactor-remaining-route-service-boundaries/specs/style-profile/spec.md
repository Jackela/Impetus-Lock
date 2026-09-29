## ADDED Requirements

### Requirement: Existing Style Operations Use Minimal Injected Services
现有 style analyze/apply/compare 和 profile 操作 SHALL 将业务计算、账户编排和持久化委派给最小注入服务/仓储，保留既有算法、响应 schema、状态、样本和版本语义。路由 SHALL 保留认证、参数校验、HTTP 映射；身份隔离 SHALL 采用已修复的当前合同。

#### Scenario: Analyze updates an owned profile
- **WHEN** 已认证用户提交合法文本分析且持久化可用
- **THEN** 服务 SHALL 保存该用户 profile 并保持既有向量算法及 samples_count/version 增加
- **AND** 路由 SHALL 返回现有 201 schema，事务失败不得报告成功保存。

#### Scenario: Optional session is unavailable
- **WHEN** style analyze/apply/profile 在没有 session 的既有路径执行
- **THEN** analyze SHALL 保留当前非持久化分析，apply SHALL 保留默认向量/version=1，profile GET/DELETE SHALL 保留 503。

#### Scenario: Compare and profile contracts remain unchanged
- **WHEN** 调用现有比较或已授权 profile 读取/删除
- **THEN** 比较距离、radar排序、insights 和四位小数 SHALL 保持
- **AND** profile SHALL 保留版本/日期字段及当前 missing/foreign 拒绝，不新增用户访问权。
