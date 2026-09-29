## ADDED Requirements

### Requirement: Pytest Migration Preserves Effective Collection Across Supported Python
pytest9迁移 SHALL 使用collection_path的Path hook并保留可选SDK的选择性收集。未来批准及项目实施之前 SHALL 有Python3.11/3.12、optional有/无、serial/xdist与asyncio/cov插件兼容证据；缺失证据 SHALL 保持待批准。

#### Scenario: Old path hook prevents collection
- **WHEN** pytest9使用旧path参数的hook
- **THEN** 收集错误 SHALL 被保存为失败证据，迁移 SHALL 不通过忽略失败文件绕过。

#### Scenario: Optional dependency availability differs
- **WHEN** optional SDK不存在或存在
- **THEN** 仅其对应文件 SHALL 按既有规则跳过或收集，其他node IDs SHALL 不无故减少。

#### Scenario: Only one Python version was checked
- **WHEN** 只有Python3.12通过而3.11未验证
- **THEN** 迁移 SHALL 保持必需matrix证据未完成，不称为批准或实施就绪。

### Requirement: Redis Migration Requires Real Lifecycle and Rate Limit Evidence
redis-py8迁移 SHALL 在Python3.11/3.12与真实Redis7验证现有JSON pubsub、subscribe/unsubscribe、断链重连、监听取消/aclose、TTL和限流行为。批准及项目实施前 SHALL 明确协议、timeout/retry和失败策略；mock或不可达skip SHALL 不代替真实证据。

#### Scenario: Server is unavailable during validation
- **WHEN** 真实Redis测试不可达并skip
- **THEN** 本组 SHALL 标为环境证据缺失，不能因为退出0宣称通过。

#### Scenario: Manager is closed and reconnected
- **WHEN** manager监听中被取消/关闭并重新连接
- **THEN** 系统 SHALL 正确释放旧listener/pubsub/client并正常交付新消息，无重复监听或残留任务。

#### Scenario: Rate limit window is exercised
- **WHEN** 真实Redis上的请求达到既有限额并进入下一窗口
- **THEN** 系统 SHALL 保持限额拒绝、TTL与窗口重置，以及获批的故障/恢复策略。

### Requirement: Backend Major Migrations Have Independent Approval and Rollback
pytest和redis迁移 SHALL 有独立包/锁/配套配置、失败与成功证据、批准和回退，不以一个组通过替代另一组。回退 SHALL 保留既有key/payload数据及其他票的已授权修复。

#### Scenario: Pytest succeeds but Redis evidence is missing
- **WHEN** pytest matrix通过而Redis真实生命周期未验证
- **THEN** Redis组 SHALL 继续待批准，与pytest分开决策。

#### Scenario: Redis migration is rolled back
- **WHEN** Redis候选失败需要回退
- **THEN** 仅其依赖与必要client配置 SHALL 一起回退，不清空Redis或撤回pytest组。
