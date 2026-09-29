## ADDED Requirements

### Requirement: Collaboration Domain Operations Remain Outside Transport Routes
协作路由 SHALL 只保留认证入口、消息解析、连接处理与 transport 错误映射，将获批的授权/持久化业务交给注入服务。抽取 SHALL 复用同一管理器，且不能自行新增共享政策、schema 或把原权限假成功当成已修复。

#### Scenario: Authorized operation passes through transport adapter
- **WHEN** 已认证用户发送范围内合法协作消息
- **THEN** 路由 SHALL 解析消息并调用注入服务，保留获批的消息字段和成功/错误结果。

#### Scenario: Authorization migration is not approved
- **WHEN** 仅路由抽取被批准而持久化授权政策仍未批准
- **THEN** 抽取 SHALL 不创建共享 schema 或扩大访问
- **AND** 现有协作功能缺口 SHALL 继续明确列出，不称为验收完成。
