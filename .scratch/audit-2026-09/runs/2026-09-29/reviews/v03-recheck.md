V03 复审确认 **1 项 P1 Spec 缺陷**；Standards 无新增发现。原始四项发现均已修复，但 R13 仍有以下加载失败路径。

- **P1｜R13：首次加载失败后，仍用未知的占位版本写入已有任务。**  
  [useTaskSync.ts:240](/Users/jackela/.codex/worktrees/impetus-audit-2026-09-29/Impetus-Lock/client/src/hooks/useTaskSync.ts:240)  
  选择尚未加载的 A，GET 返回 503 后，草稿变为 `status="error"`，但保留预设的 `taskId=A、version=0`。此时编辑，800ms 后保存条件放行，发送 `PUT /tasks/A`，内容为默认文档加新输入。如果服务器 A 恰为合法的版本 0，请求直接覆盖原内容，且错误提示被清除。  
  **已用 Node 24、真实 React hook/taskClient 和内存 HTTP 边界复现**：唯一 GET 失败，随后 PUT 携带 `version:0`，模拟服务器接受并变为版本 1。当前后端版本校验与这一结果一致。这是 R13 引入的回归，不涉及 Tier3 产品决策。  
  **最小修正：**区分“版本未知”和合法版本 0；已有任务未取得可信版本时保留草稿、阻止 PUT，并在成功加载后恢复保存。补充 GET 失败后编辑的回归，同时保留已有离线新建恢复行为。

原始四项复核结果：加载期间编辑保留、离线恢复草稿切换保留、后台初始化完成均已修正；实际 App/AppModals 创建回调现在选择新任务，真实 Milkdown 测试验证了版本 0 的新任务内容及选中状态。R03 请求体未发现剩余缺陷。

审查范围：`31b0e3f..d528e0e` 中 V03 的 `eddbe65、d663fa6、380c9bc、92e8efe、d528e0e`，三个 hook、对应测试、taskClient，以及 App/AppModals/CreateTaskModal/EditorCore 接口；R22 内部完整审查仍属 V04。已核对指定指令、当前规格、票据、原始 RED/GREEN、未暂存审计元数据及未跟踪 R22/V06 记录；暂存区为空，源码无未提交差异。

核对了 35 项聚焦测试及最终客户端 696 通过、4 跳过的原始日志，未重复全套门禁。新增验证仅在内存运行，未修改文件、依赖或真实数据，未委派、运行浏览器 E2E、调用模型或远端服务。认证 UI、持久化协作和统计提案未作为本批缺陷；最终接受仍由 main 决定。

