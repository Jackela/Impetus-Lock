V03 确认 **4 项 Spec 缺陷**；Standards 未发现需修正的问题。R03 未发现剩余缺陷。

1. **P1｜R13：加载响应覆盖加载期间的编辑。**  
   [useTaskSync.ts:316](/Users/jackela/.codex/worktrees/impetus-audit-2026-09-29/Impetus-Lock/client/src/hooks/useTaskSync.ts:316)  
   选择 A 后、GET 返回前输入内容，`adoptTask` 会无条件替换草稿内容和锁、清除 `dirty`，并覆盖本地缓存。继续输入后，新保存请求只包含服务器旧内容及后续输入，之前的编辑丢失。当前 App 在加载期间仍允许编辑，内存探针已复现。**最小修正：加载完成时保留已变脏的草稿及待保存内容，仅协调任务身份和版本；补充延迟 GET 期间编辑的回归测试。** 属于草稿保留缺陷，新增缓存覆盖使恢复副本也丢失。

2. **P1｜R13：恢复的离线草稿未标记为待保留，切换后丢失。**  
   [useTaskSync.ts:335](/Users/jackela/.codex/worktrees/impetus-audit-2026-09-29/Impetus-Lock/client/src/hooks/useTaskSync.ts:335)  
   从缓存恢复未保存的 A 草稿后，网络恢复，切到 B 再返回 A；恢复路径仍令 `dirty=false`，因此 `loadTask` 丢弃该草稿并重新加载服务器旧内容。探针确认缓存和界面均变回服务器内容，期间没有保存请求。**最小修正：将恢复的本地草稿标记为需要保留，切换时沿用已有草稿保留分支，避免自动覆盖。** 属于 R13 剩余缺陷。

3. **P2｜R13：缓存任务的晚到初始化结果导致永久加载。**  
   [useTaskSync.ts:399](/Users/jackela/.codex/worktrees/impetus-audit-2026-09-29/Impetus-Lock/client/src/hooks/useTaskSync.ts:399)  
   缓存指向 A，初始化请求未结束时切到 B；A 的响应随后被完全忽略。再次选择 A 时，Map 中的 A 仍为 `loading`，被保留且不再请求。探针结果为 `taskId=A、status=loading、content=default`，仅发出过 A、B 两次 GET。**最小修正：让后台初始化完成其草稿状态，同时继续隔离可见状态；或清除失效的加载记录，使返回时重新请求。** 属于 R13 新回归。

4. **P2｜R12：实际创建流程没有选择新任务。**  
   [App.tsx:210](/Users/jackela/.codex/worktrees/impetus-audit-2026-09-29/Impetus-Lock/client/src/App.tsx:210)  
   创建成功后，实际回调仅为 `refetch`；没有更新 `editingTaskId` 或选中任务，编辑器仍停留在旧任务。新增测试通过自行定义的 `TaskCreationScreen` 补上选择逻辑，未验证真实调用方。**最小修正：在现有成功回调中接入任务选择，并用实际调用方验证。** 这是票面“选择新任务”的剩余验收缺口，不是新增产品要求。

审查范围为 `31b0e3f..de4dbe5` 中的 `eddbe65`、`d663fa6`、`380c9bc`，包括三个 hook、对应测试、taskClient，以及 App／AppModals／CreateTaskModal／EditorCore 调用路径；另核对了项目指令、当前规格、票据和原始 RED/GREEN 日志。末次检查没有暂存变更；新增的审计报告修改及 V01/V02 未跟踪记录已检查，未改变 V03 源码。

前三项使用 Node 24.19.0、真实 React hook 和 taskClient 在内存中复现，仅控制 fetch 与 JSDOM 存储边界。未写文件、委派、重跑全量套件或执行浏览器／远程验证。认证 UI、持久化协作及统计提案未作为本批缺陷。最终接受由 main 决定。

