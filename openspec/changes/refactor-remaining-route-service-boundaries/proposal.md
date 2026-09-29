# Change: 抽取剩余路由中的必要业务与持久化操作

Status: Proposed / not approved。P-01，Tier 3，仅起草，不包含实施。

## Why

已归档的 route-service-boundaries 处理了 tasks/templates/streaks；当前 style/profile/history、stats、achievements 和协作授权/操作仍在 HTTP 层执行计算、ORM 查询或业务编排。需要按实际业务抽取最小服务边界，同时避免为静态响应和 HTTP 映射建立通用框架。

依据：`server/server/api/routes/{style,style_history,style_comparison,stats,achievements,collaboration}.py`、`server/server/infrastructure/persistence/style_history_repository.py`、`server/server/infrastructure/websocket/collaboration_service.py`；backend-audit B14。R09 所有权修复和 R10 依赖组装是独立已授权票；本提案不能保留当前越权漏洞，也不代替这些修复。

## What Changes

- 将 style 分析/应用/比较及 profile 的业务编排放入小型服务，复用当前算法和既有 StyleHistoryRepository。
- 用窄仓储接口封装统计和成就的既有查询；当前账户由路由认证后显式传给服务，不从请求体推断 owner。
- 将协作授权及获批的持久化操作交给服务；REST/WS 保留 transport 校验、消息解析和错误映射。共享 schema 与角色政策仅由 `complete-collaboration-authorization` 提案决定。
- 保留已实现合同的响应、分页、版本、计算和数据库不可用行为，详见 design；统计占位和缺失授予不是正确性承诺。活动采集与聚合由独立 `complete-writing-activity-tracking` 草稿提出审批选择，不在结构抽取中直接实现。
- 静态 achievement definitions、health 响应和简单 HTTP 映射可留在路由。无 generic CRUD/service base class、事件总线或框架替换。

## Impact

- Affected specs: 复用 `stats`、`achievements`；目前无对应正式能力，新增 `style-profile`、`style-history`；协作部分在同名 `collaboration-authorization` delta 中增加独立边界要求，不复制权限政策。
- Affected interfaces: 仅现有 `/style/*`、`/stats/*`、`/achievements/*`、`/collaboration/*` 及其依赖、业务服务和窄仓储。
- 前置：R09/R10 完成后的合同重新取样；不再次抽取已完成的 tasks/templates/streaks，也不改其规范。
- `stats` 规范要求按时期聚合，但当前 period 路由总返回零；成就规范有授予要求，当前这里仅定义/列表/查询。抽取保留这些已观察行为，不宣称补全产品能力。

## Alternatives and approval choices

推荐抽取确有业务/查询的操作，路由继续保存简单 transport 和静态响应。全部留在路由最省变更，但仍违反 Article IV 并把账户/事务逻辑绑定到 HTTP。所有路由强制包装为服务增加无价值层级，违背 Article I；不推荐。

待批准：各业务服务的最终组合及仓储最小方法；协作授权提案若延后，本提案只抽取现有可确认行为，不能新增共享政策，也不能让缺 schema 查询和假成功被包装后称为已修复。期间统计及成就授予缺口另行决策。

## Acceptance, migration and rollback

先在已修复基线记录两用户、无 session、算法边界、分页和错误合同，再逐个业务操作记录服务公共边界 RED 并实现最小抽取。对外 API 对照通过后再迁移下一路由族。协作需测只读拒绝/提交顺序，权限新行为以其获批提案为准。

无独立 schema 迁移；每个路由族连同依赖与服务实现一起回退到抽取前且已完成 R09/R10 的版本。不得回退所有权修复。严格格式通过只检查草案语法，不证明服务已抽取。
