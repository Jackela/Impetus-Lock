Status: Proposed / not approved。所有条目为未来工作，未实施。

## 1. Approval and characterization
- [ ] 1.1 批准领域分组、事务边界与协作提案先后；核对 R09/R10 集成基线，不复用越权合同。
- [ ] 1.2 在 HTTP/WS 边界刻画 design 表的响应、两用户、无 session、分页、算法与错误；单列 period 零值、无授予入口、权限假成功的现有缺口。

## 2. Incremental extraction with TDD
- [ ] 2.1 Style/profile：先做身份、算法、版本/样本与失败事务的公共服务 RED，再抽取必要规则/仓储并保留 API 断言。
- [ ] 2.2 History：先做用户过滤、missing/foreign/delete outcome 的 RED，再复用仓储抽取编排，保留错误 detail。
- [ ] 2.3 Stats：先做已知零记录、breakdown、period 校验与 no-session 的 RED，再抽取现有查询/映射，不实现聚合。
- [ ] 2.4 Achievements：先做两用户、排序/分页、missing/no-session 的 RED，再抽取现有查询；静态定义保留简单映射。
- [ ] 2.5 Collaboration：先对获批范围写公共服务 RED，再抽取授权/操作编排，保留连接/消息适配；共享政策不得由抽取票自行决定。

## 3. Verification and rollback
- [ ] 3.1 每领域保留独立 RED/GREEN，比较 HTTP/WS 完整合同、事务失败和依赖注入；检查没有多余基类和直接 SQL 路由。
- [ ] 3.2 运行相关服务/API 回归、Ruff/mypy/import-linter、严格 OpenSpec；按风险补充真实数据库验证。
- [ ] 3.3 演练逐领域回退到已修复安全基线；由主代理审阅行为缺口并决定验收，不能把结构调整当成功能补全。
