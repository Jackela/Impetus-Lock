Status: Proposed / not approved。以下均为未来工作；本票未执行任何实施任务。

## 1. Approval and contracts
- [ ] 1.1 由主代理交付审批选择：任务共享或撤回端点、admin 政策、WS 协议迁移和旧房间处置。
- [ ] 1.2 核对 R10、认证和任务版本修复后的实际基线及所有客户端；冻结 REST/WS 消息、错误和迁移清单。

## 2. Authorization and schema, one TDD slice at a time
- [ ] 2.1 在批准的 HTTP/WS 公共边界先记录 owner/read/write/admin/foreign 的 RED，再实现最小身份与能力校验。
- [ ] 2.2 用持久化授予/撤销、重启读取与失败提交的 RED 引导共享仓储及 PostgreSQL 迁移；验证无日志权限回填。
- [ ] 2.3 先记录只读操作、降权/撤权后旧连接和越权 metadata 请求的 RED，再实现每次操作重检与连接失效。

## 3. Durable task operations
- [ ] 3.1 对 canonical 内容、lock_ids、task_version 的重连/重启、并发冲突、删除锁与失败提交写 RED，再逐项实现提交后确认和广播。
- [ ] 3.2 在功能开关后引入获批的 WS 版本协商；拒绝旧编辑协议并验证 owner-only 普通任务 CRUD 不被放宽。
- [ ] 3.3 演练迁移和关闭功能后的回退，保留任务内容/新共享数据；检查 schema/FK 和删除行为。

## 4. Verification and handoff
- [ ] 4.1 保存独立 RED/GREEN，运行授权/任务/协作回归、真实 PostgreSQL 验证、Ruff/mypy/import-linter 和严格 OpenSpec 校验。
- [ ] 4.2 由主代理安排单独授权的客户端实际流程验证；列明未验证的浏览器/Redis/分布式一致性，不将本票格式验证当成验收。
