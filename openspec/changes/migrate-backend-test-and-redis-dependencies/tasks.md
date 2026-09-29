Status: Proposed / not approved。各项均为未来工作，不代表本票进行了兼容性实验。

## 1. Independent evidence before project approval
- [ ] 1.1 主代理刷新172/185与具体目标版本，单独授权隔离实验环境；确认Python3.11/3.12、optional matrix及真实Redis7可用，不修改linked环境。
- [ ] 1.2 pytest组保存旧hook在9的收集RED，最小collection_path适配后比较8/9 node IDs、optional有/无、serial/xdist及asyncio/cov插件GREEN，不调用真实LLM。
- [ ] 1.3 Redis组保存7行为基线和8候选失败/成功，在两Python环境执行真实pubsub/限流/TTL/断链重连/取消关闭验证；skip不得计为GREEN。
- [ ] 1.4 由主代理分别审阅证据，批准精确版本、协议/timeout/retry与最小调用改动；缺任一必要环境则对应组继续待批准。

## 2. Group A: approved project migration
- [ ] 2.1 冻结收集/optional公共边界，在项目记录RED后最小更新collection_path与pytest及兼容插件锁，不扩大ignore。
- [ ] 2.2 复跑Python3.11/3.12、optional有/无、serial/xdist；比较收集清单、预期skip和结果，保存独立GREEN。
- [ ] 2.3 演练pytest包/锁/hook独立回退，不回退Redis或其他票。

## 3. Group B: approved project migration
- [ ] 3.1 针对获批生命周期公共边界先写/执行RED，再最小更新redis包/锁、await/关闭和必要显式配置，保留key/payload/TTL/失败策略。
- [ ] 3.2 真实Redis7验证pubsub与限流、subscribe/unsubscribe、重连、cancel/aclose、重复close与无残留资源；检查未skip的真实测试计数。
- [ ] 3.3 演练redis包/锁/client配置独立回退，不清空Redis、不恢复已修复缺陷。

## 4. Handoff
- [ ] 4.1 运行后端lint/type/architecture、获批测试矩阵与严格OpenSpec；分别报告两组环境、RED/GREEN、skip和未验证项，由主代理验收。
