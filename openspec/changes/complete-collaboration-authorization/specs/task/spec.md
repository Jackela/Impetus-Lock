## ADDED Requirements

### Requirement: Collaborative Writes Preserve Persistent Task Identity
获准的协作写入 SHALL 保存至现有 Task 的 content、lock_ids 和同一 version 序列，保留 task UUID、owner 与既有锁约束。Task 持久化内容 SHALL 是重连的权威来源；客户端提供的全文和 Redis 临时状态 SHALL 不覆盖该来源。确认与广播 SHALL 在任务事务成功后发生。

#### Scenario: Collaborative edit survives restart
- **WHEN** write 用户的合法操作按当前 task_version 提交，随后重启并重连
- **THEN** 系统 SHALL 返回该 Task 已提交的内容、锁和递增版本
- **AND** 普通任务 owner 读取 SHALL 看到同一内容与版本。

#### Scenario: Stale version or protected lock edit
- **WHEN** 协作操作基于过期 task_version 或破坏既有不可删除锁
- **THEN** 系统 SHALL 拒绝写入且不发布成功操作
- **AND** 当前内容、lock_ids 和版本 SHALL 保持。

#### Scenario: Task persistence fails
- **WHEN** 合法协作操作提交失败
- **THEN** 系统 SHALL 返回可重试错误，不确认/广播成功，不以 Redis 状态冒充已保存。

#### Scenario: Legacy editing client has no persistent protocol support
- **WHEN** 客户端不能协商获批的持久化版本协议
- **THEN** 系统 SHALL 明确拒绝编辑并说明需升级，不把临时 room version 当成 Task version。
