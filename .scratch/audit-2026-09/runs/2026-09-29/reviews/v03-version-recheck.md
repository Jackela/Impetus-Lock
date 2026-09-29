确认 **1 项 P1 Spec 缺陷**；Standards 无新增发现。

- **P1｜R13 剩余缺陷：未知版本草稿在重新启动且 GET 成功时丢失。**  
  [useTaskSync.ts:422](/Users/jackela/.codex/worktrees/impetus-audit-2026-09-29/Impetus-Lock/client/src/hooks/useTaskSync.ts:422)  
  **触发：**选择 A，首次 GET 返回 503；输入后卸载，缓存正常保存本地内容及 `{taskId:"A", version:null}`；重新启动，此次 GET 成功。`bootstrap` 仅在失败分支恢复缓存，成功分支直接调用 `adoptTask`，此时 `dirty=false`，服务器内容因此覆盖本地草稿，并写回缓存，删除唯一保留的未保存内容。实际 App 启动时 `editingTaskId=null`，会进入该路径。  
  **已复现：**Node 24、真实 hook/taskClient、root StrictMode、纯内存 HTTP/storage；全过程仅两次 GET，没有 PUT，本地内容和缓存均从未保存草稿变为服务器原文。现有缓存回归只覆盖“重新启动仍失败，再编辑并切换恢复”，遗漏了直接加载成功的情况。  
  **依据与最小修正：**R13 票据第 35 行明确要求缓存重载保留草稿、锁及待保存意图，成功加载不得覆盖本地草稿。应在采用成功响应前恢复未知版本缓存的草稿及待保存状态，随后用真实版本恢复既有保存流程，并补充上述回归。这属于原票缺口，不涉及 Tier3 决策。

审查范围为 `d528e0e..3557352` 的 R13 实际差异、完整 hook、8 项新增测试、既有加载／冲突／切换／StrictMode 回归及 App 启动接口。R03、R12 沿用上次已关闭结论。最终 HEAD 为 `3557352`，暂存区为空，产品源码无未提交差异；未暂存内容为六份审计记录，最终无未跟踪文件。

已核对原始 RED **6 失败、2 通过**，GREEN **8 通过**、聚焦 **88 通过**，以及 main 修正格式后的完整门禁日志：lint／format／type-check 通过，测试 **704 通过、4 跳过**。未重复全套检查；新增复现仅在内存运行，无文件修改、委派、浏览器 E2E 或远端操作。最终接受由 main 决定。

