# Future tasks — Proposed / not approved

所有任务保持未勾选；这里只规划审批后的实施。P-02 文档格式检查不是任何任务完成的证据，不执行生产测试、迁移或功能实现。

## 1. Approval and contract baseline

- [ ] 1.1 由主代理复核当前 stats/achievements/task/intervention 及五份待批准提案来源；确认与结构抽取、认证、协作的接口归属，不改既有验收条件。
- [ ] 1.2 批准活动表或缩小范围的替代路径、UTC时期、累计/删除/修正政策、干预和锁口径；不选撤回时保留当前规范要求。
- [ ] 1.3 批准时长测量/覆盖协议、v2 opt-in及旧合同弃用、创建/干预持久化重试身份、唯一授予、历史重建/补发和重复处理；明确streak/Special的独立依赖。确认公共测试边界后才写实现测试。

## 2. Vertical TDD slices after approval

- [ ] 2.1 先在 task写入 + stats GET 边界记录成功创建、重复key、commit失败的 RED；实现最小同事务活动/汇总/幂等记录后记录 GREEN，保留唯一commit和账户校验。
- [ ] 2.2 先在 task更新/删除 + stats GET 边界记录首次锁、同锁重存、版本冲突、实际编辑、删除后历史保留及修正重跑的 RED；实现最小行为后记录 GREEN。
- [ ] 2.3 先在 intervention请求 + stats/breakdown/achievements GET 边界记录失败提交、缓存过期/重启重试、首个结果重放和foreign task的 RED；使用受控provider实现持久化重试映射与同事务采集后记录 GREEN，不调用真实LLM。
- [ ] 2.4 先在 period/aggregate GET 边界记录UTC日/周/月边界、as_of、七日3/7日均、完整空窗口与历史unknown、数据库错误的 RED；实现事实聚合及逐指标证据schema后记录 GREEN。
- [ ] 2.5 先在获批写作报告 + stats GET 边界记录35+40秒、跨午夜、重叠页签、idle/hidden、过期、伪造owner及sequence重放/冲突的 RED；实现最小认证区间/并集/覆盖处理后记录 GREEN。
- [ ] 2.6 先在task/intervention写入 + achievements GET 边界记录1/10/100及首次mode、99到101并发、重复重试、不更改earned_at、不在读取授予的 RED；实现数据库唯一身份和事务授予后记录 GREEN。
- [ ] 2.7 在独立streak行为方案获批且连续天数/宽限/任务活动接入完成后，以其公共资格结果先验证streak_3/7/30的 RED再实现授予并记录 GREEN；依赖未完成时明确不可评估，不把当前后续日期加一行为作为通过依据。
- [ ] 2.8 先在client API/Stats/Export/Achievements公共展示边界记录null/partial/503/旧合同升级错误、账户切换、unknown导出及不可评估徽章的 RED；更新获批schema、生成类型和消费者后记录 GREEN。

## 3. Data validation, migration and rollback

- [ ] 3.1 在独立test-owned PostgreSQL schema验证唯一/并发/commit rollback和migration；仅删除测试自有schema/记录，不drop共享表。保留单独RED/GREEN证据。
- [ ] 3.2 备份原数据，预检查成就重复组与旧汇总来源；按owner批准的可恢复合并方案再建unique。可证明来源重建两次保持同一结果，不填历史时长/锁日期/缺失删除历史。
- [ ] 3.3 验证新旧数据、UUID/owner/content/earned_at保留及首次启用覆盖；按获批政策处理可信历史阈值，streak与Special缺项分别报告。
- [ ] 3.4 演练关闭采集/授予/v2及恢复，保留新增事实/身份/备份；停用期间出现coverage gap而非假零，不调用旧sprint3破坏性downgrade。
- [ ] 3.5 由主代理执行适用检查、联合提案冲突复核和最终接受；本票strict格式通过不能勾选实施、迁移、验收或发布。
