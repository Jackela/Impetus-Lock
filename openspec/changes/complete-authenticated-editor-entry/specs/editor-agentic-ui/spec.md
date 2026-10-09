## ADDED Requirements

### Requirement: Active Editor Entry Resolves Server Authentication

当前编辑器入口 SHALL 复用现有认证组件与已修复 auth client 合同，并以服务器 `/auth/me` 或成功 auth 响应确定用户。loading、未登录和网络失败 SHALL 有明确状态；身份确认前 SHALL 不启动受保护的任务或 AI 工作。系统 SHALL 不通过读取 HttpOnly cookie 推断会话。

#### Scenario: Initial session check is pending

- **WHEN** 用户打开页面且 me 请求尚未完成
- **THEN** 页面 SHALL 显示可访问 loading，不发送任务创建/查询/保存或 AI 请求。

#### Scenario: Authentication succeeds or is rejected

- **WHEN** me 返回200或401
- **THEN** 入口 SHALL 分别进入该用户编辑器或显示登录；登录错误 SHALL 显示 error，成功 SHALL 确认身份后进入编辑器。

#### Scenario: Session check has a network failure

- **WHEN** me 请求网络失败或服务器5xx
- **THEN** 系统 SHALL 提示重试，不声称用户未登录，不启动受保护同步。

#### Scenario: Login and registration submit with clear outcomes

- **WHEN** 用户以键盘或按钮提交登录或注册
- **THEN** 表单 SHALL 防止重复提交，保留失败后的输入并关联错误提示；成功后 SHALL 使用服务器返回的身份进入账户工作区。

### Requirement: Session Expiry and Logout Preserve Accurate State

系统 SHALL 提供 logout，区分成功、等待与未确认失败；受保护401 SHALL 触发会话过期状态并暂停远端工作，403 SHALL 保留相应 CSRF/权限错误。转换状态前 SHALL 保存最新本地草稿及锁。

#### Scenario: Session expires while editing

- **WHEN** 编辑中受保护请求返回401
- **THEN** 系统 SHALL 保留最新内容和锁，暂停远端自动保存/AI，并提供重新登录与本地继续写作提示。

#### Scenario: Logout fails

- **WHEN** logout 网络失败或返回非成功
- **THEN** 系统 SHALL 标明退出尚未确认并提供重试，不宣称服务端会话已清除。

#### Scenario: Logout succeeds

- **WHEN** logout 返回204
- **THEN** 页面 SHALL 回到登录、移除账户 query 展示，并保留该账户草稿以供本人再次登录恢复。

#### Scenario: Logout cannot preserve the last local snapshot

- **WHEN** 浏览器存储失败导致最新正文及锁未能可靠保留
- **THEN** 系统 SHALL 报告失败、暂停远端工作，并保留当前编辑器；不发送退出请求或卸载最后一份正文。

#### Scenario: A protected request fails without invalidating the session

- **WHEN** 受保护请求返回403、网络错误或5xx
- **THEN** 系统 SHALL 提供相应失败与重试，不将错误声明为用户已退出。

### Requirement: Cached Drafts and Async Results Are Account Scoped

缓存和异步完成 SHALL 按已确认用户与任务隔离。旧无用户归属缓存 SHALL 保留为未归属草稿，不能静默绑定或上传至登录账号。恢复 SHALL 保留锁与版本冲突处理。

#### Scenario: A different account signs in

- **WHEN** A 退出后 B 登录，A 的保存/查询仍在完成
- **THEN** B SHALL 仅看到其账户内容，A 的旧完成 SHALL 不回写 B 的 UI 或缓存
- **AND** A 草稿 SHALL 不显示或上传至 B。

#### Scenario: Same user recovers an unsaved draft

- **WHEN** 同账号重新登录且草稿版本落后于服务器
- **THEN** 系统 SHALL 保留 content/lock_ids 并执行现有冲突提示，不静默覆盖任一份内容。

#### Scenario: Legacy global cache exists

- **WHEN** 系统发现旧全局内容和 task metadata
- **THEN** 系统 SHALL 保留原文并要求显式导入选择，不从 taskId 猜 owner，不自动更新旧 Task。

#### Scenario: A previous session returns late results or 401

- **WHEN** 账户或会话代次已变化，而旧查询、保存、AI 或导出完成或返回401
- **THEN** 系统 SHALL 忽略旧结果及错误通知，不修改新账户界面、缓存、锁或触发旧数据下载。

#### Scenario: The user explicitly adopts the server version

- **WHEN** 本地锁定稿与服务器发生冲突，用户选择采用服务器版本
- **THEN** 系统 SHALL 先可靠保留完整本地恢复备份，再安装真实服务器正文和锁；不能将旧锁拒绝的文档替换记录为已保存。

#### Scenario: Unassigned draft choices preserve the original source

- **WHEN** 用户导入、导出或明确丢弃旧全局草稿
- **THEN** 导入 SHALL 创建新的当前账户草稿身份并保留原副本；导出 SHALL 保留原始正文和 metadata；只有明确丢弃 SHALL 移除旧副本。

#### Scenario: A lock or owned snapshot cannot be recovered reliably

- **WHEN** 原始正文的锁无法在解析文档中定位，或账户快照的锁 metadata/JSON 损坏
- **THEN** 系统 SHALL 保留原始正文及 raw 源、显示恢复错误并提供导出及重试，阻止该稿的正常编辑与上传，不静默去锁或自动上传默认稿替代。
