## Context

当前 App 直接启动 useTaskSync；该 hook 使用 `impetus.task.cache` 和 `impetus.task.meta`，没有用户隔离。QueryClient 为全局实例。AuthContext 直接 fetch 现有 auth endpoints，提供 user/isLoading/login/register/logout；错误处理目前把 me 非成功与网络失败都设为无用户，logout 也未检查 HTTP status。ProtectedRoute 导入 react-router-dom，却没有 active router；不能仅包上它就声称入口已完成。

## Goals / Non-Goals

目标是当前编辑器的完整认证入口、会话状态和可恢复草稿。非目标是新认证后端、token 存储重建、router 平台、账号权限治理、修复 cookie/CSRF 或重写编辑器。继续使用现有 HttpOnly 会话、修复后的 credentials/CSRF client 合同。

## Recommended state model

| 状态/触发 | UI 与允许动作 |
| --- | --- |
| 初始 `/auth/me` pending | 有可访问 loading；不挂载远端任务同步/查询/AI 定时器 |
| me 200 | 以服务器 user.id 建立账户范围，进入原编辑器 |
| me 401 或受保护请求明确401 | 登录/会话过期提示；停远端自动保存和 AI；保留已归属草稿 |
| me 网络错误/5xx | 显示重试与失败原因，不判定 session 过期，不创建远端任务 |
| login/register pending | 禁止重复提交，保留表单可理解等待状态 |
| login/register 失败 | 可访问 error，保留适当输入；不挂载编辑器/宣称已登录 |
| login/register 成功 | 用响应 user 或 me 确认身份后建立账户范围，恢复或选择草稿 |
| logout pending | 先停止新远端工作，将未保存内容/锁写入用户草稿快照，清理账户 UI 展示 |
| logout 204 | 清理用户会话及敏感 query 缓存，显示登录；草稿保留在原用户范围 |
| logout 非成功/网络失败 | 明确“退出未确认”，编辑器远端工作保持暂停，提供重试或 me 检查；不宣称服务端会话已清除 |

401 是会话无效信号，403 CSRF/权限失败仍走其错误提示，不循环跳登录。不要轮询无期限或把失败请求无限重放。现有 AuthContext 的入口要适配统一且已经修复的 client transport；不能另建 cookie 发行方案。组件层通过 context/hooks，保留既有 import guard。

## Account and draft lifecycle

建议缓存键按稳定 user.id 与 task.id（尚无 task 时为本用户 local draft）隔离，保存 content、lock_ids、version、dirty 标记及恢复时间。auth/session generation 用于阻止上个账户的异步 load/save/AI 结果回写当前界面。取消本账户在途查询/定时保存，并忽略无法取消的旧完成；不复制 R13 的每任务序列化实现，沿用其已修复公共行为。

会话过期先缓存最新编辑和锁，再暂停远端同步，提示可继续本地写作并重新登录。同一账号恢复时比较服务器 Task version，采用现有冲突提示，不能用陈旧缓存覆盖服务器或抹去新草稿。另一账号登录时只加载其用户范围；不得向其显示、上传前一账号草稿，也不得复用前一账号 query 数据。退出后不显示已归属草稿，除非该用户重新通过身份确认。

旧两个全局键无法证明 owner。迁移保留内容和 metadata 的本地副本，归为 unassigned；即使带 taskId 也不能推出所属账号。登录后仅提示有未归属草稿，用户明确选择导入为当前账户新草稿或导出/丢弃；绝不自动更新旧 taskId。锁必须随内容完整恢复；无法辨认锁时显示恢复错误并保留原文，不默默去锁。浏览器缓存不能消除共享设备的本机访问风险，范围隔离解决的是产品内跨账户误显示和误上传。

## Alternatives and trade-offs

单页 auth gate 足够覆盖当前入口，并能复用 LoginForm/RegisterForm；无需为此接入 router。若确认多 URL 导航才使用 ProtectedRoute，并另外批准 router 与路由范围。仅 AuthProvider 包装不足以停止 App 内受保护副作用；需要认证后才挂载编辑器子树或明确 gating。仅“401 toast”缺少登录入口和草稿切换，不能满足要求。

## Migration and rollback

先验证 R04/R13 及完整 TypeScript 修复后的基线，再添加 loading/auth/error 边界，再迁移缓存与账户 query 生命周期，最后开启入口。保留原缓存副本直至恢复验证，不擅自销毁草稿。

回退入口及缓存 reader 必须一起考虑：保留按账户缓存和未归属备份，认证策略不回退；若旧 UI 无法安全读取新缓存，就暂停远端入口并提供受控恢复，不能回到全局缓存自动上传。未来实际浏览器验证包括刷新、账号切换、401 和网络失败，不用 unit green 代替。

## Open approval decisions

注册是否开放、过期后的本地继续写作提示、未归属草稿导入与保留策略；auth gate 与缓存生命周期的精确组装方案。均 Proposed / not approved。
