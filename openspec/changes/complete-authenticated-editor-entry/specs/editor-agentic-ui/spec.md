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
- **AND** 清除界面前 SHALL 再保存等待期间新增的最新正文和锁。

#### Scenario: Server sign out succeeds but final preservation fails

- **WHEN** logout 已返回204或身份检查已确认401，但清除界面前的最新本地快照保存失败
- **THEN** 系统 SHALL 明确说明服务端已退出与本地保存失败，保留唯一内存正文和锁及当前写作区，提供导出和重试；不得将已确认退出显示为退出未确认。

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

#### Scenario: Independent tabs write to the same account task

- **WHEN** 同一账户在多个写作实例恢复或编辑同一任务
- **THEN** 各实例 SHALL 使用独立工作副本并保留恢复来源和旧副本；当前实例切回任务时 SHALL 优先恢复自己的副本，不采用其他标签未上传的正文。

#### Scenario: Late saves must not change the restored selection

- **WHEN** 另一任务的迟到保存改变草稿更新时间排序后，当前写作上下文刷新
- **THEN** 系统 SHALL 按单独记录的当前选中身份恢复任务、正文、锁和版本，不依赖更新时间排序推断选择。

#### Scenario: An owned draft has an unknown remote version

- **WHEN** 已归属草稿的远端版本未知，系统读取当前服务器任务
- **THEN** 系统 SHALL 比较完整正文和锁；差异 SHALL 保留双方并进入冲突处理，不能借服务器最新版本自动上传本地稿。

#### Scenario: Reading the unassigned source fails

- **WHEN** 任一旧全局草稿原串无法读取
- **THEN** 系统 SHALL 显示读取失败并提供重试，保留原键与可读部分；不得把失败当不存在，不得生成残缺原稿导出。

#### Scenario: Storage fails before changing the selected draft

- **WHEN** 切换任务、导入或显式另存前，当前最新草稿无法可靠保存
- **THEN** 系统 SHALL 保留原任务身份、正文和锁，显示错误并提供恢复存储后的重试，不能卸载唯一内存正文。

### Requirement: Authentication Writes Coordinate Shared Cookies

登录、注册和退出 SHALL 在同源 Web Locks 中串行执行；排队可取消，已发送请求 SHALL 等待响应头处理后再释放正常锁。发送前 SHALL 保存待确认记录，记录只用于检测未确认请求而非实现互斥。广播和获得焦点时 SHALL 及时保存正文并重新检查身份。所有受保护请求 SHALL 携带预期账户，服务端在业务执行前校验，包括退出；错配 SHALL 暂停旧页而不执行另一账户的业务。

#### Scenario: Authentication coordination is unavailable or an earlier page closes

- **WHEN** Web Locks 不可用、认证协调记录无法写入，或已发认证响应未确认且发送页关闭
- **THEN** 系统 SHALL 保留正文并拒绝后续认证写请求，提供可行动提示；不按超时或一次身份检查解除未确认屏障，不无保护地继续写共享 cookie。

#### Scenario: A dispatched response returns after cancellation

- **WHEN** 已发认证请求被新界面操作取消或替代，旧响应随后返回
- **THEN** 系统 SHALL 忽略旧界面结果，同时等其 cookie 响应头处理后才允许排队的新认证请求发送，并在实际发送时读取当前 CSRF。

#### Scenario: Cookies belong to another account

- **WHEN** 页面捕获的预期账户 A 与共享 cookie 实际认证账户 B 不同
- **THEN** 服务端 SHALL 在查询、创建、保存、AI、导出及退出业务前拒绝错配，不返回 B 的身份或清除 B 的 cookie；旧页 SHALL 暂停并保留 A 正文和锁。

### Requirement: Unconfirmed Creation and Complete Export Preserve Data

任务创建结果未知 SHALL 保留原稿与实际尝试内容，停止自动重复创建；显式重新检查只提供候选，不自动归属。账户导出 SHALL 读取全部分页，发现失败或可观察的集合变化时停止下载并提示重试，多次分页请求 SHALL 不声称原子快照。

#### Scenario: Creation commits but its response is lost

- **WHEN** 已发送任务创建请求出现网络失败、取消、5xx或无法读取完整成功响应
- **THEN** 系统 SHALL 保留未知标记且不自动再创建；允许重新检查和明确选择匹配任务，选择后仍保留后来本地修改并处理内容冲突；明确另存 SHALL 说明可能生成重复任务。

#### Scenario: Complete account export spans multiple pages

- **WHEN** 账户任务为0、100、101或201条，或第二页失败、分页间出现可观察变化
- **THEN** 系统 SHALL 只在全部页面读取并通过一致性检查后生成完整文件；失败或变化 SHALL 不生成残缺文件，账户切换后的旧完成 SHALL 不下载。
