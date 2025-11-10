# Feature Specification: Impetus Lock Core - Agent Intervention System

**Feature Branch**: `001-impetus-core`  
**Created**: 2025-11-06  
**Status**: Draft  
**Input**: User description: "实现 Impetus Lock 的核心 Vibe，包括 Muse 模式（卡壳检测与施压注入）、Loki 模式（随机混沌介入）、以及不可删除约束的交互范式"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Un-deletable Constraint Enforcement (Priority: P1)

**Actor**: 小王 (Creative Enthusiast) - 一个渴望打破"完美主义"和"心智定势"的创作者

**Scenario**: 当 AI Agent 通过"Provoke"行动注入创意施压内容，或通过"Delete"行动移除用户文本后，小王希望这些更改是**不可撤销**和**不可删除**的，以强制他放弃对"完美"的执着，专注于即兴创作。

**Why this priority**: 这是整个项目的**核心 Vibe** 和**唯一的 P1 优先级**（Article II: Vibe-First Imperative）。没有"不可删除"约束，Impetus Lock 就失去了其存在的意义——它只是另一个"礼貌的" AI 助手。

**Independent Test**: 可以通过以下独立测试验证：
1. 创建一个带有 lock_id 标记的文本块
2. 尝试通过键盘（Backspace/Delete）删除该块
3. 尝试通过编辑器 Undo 功能撤销该块
4. 验证该块在所有操作后仍然存在且不可编辑

**Acceptance Scenarios**:

1. **Given** 编辑器中存在一个 AI 注入的带有 `lock_id` 标记的 Markdown blockquote（例如：`> Muse 注入：你的主角此时必须... <!-- lock:lock_x -->`），  
   **When** 小王将光标定位在该块内并按下 Backspace 或 Delete 键，  
   **Then** 该锁定块必须保持完整，并触发视觉反馈（震动动画）和音效反馈（"Bonk" 无效音）

2. **Given** 编辑器中存在一个被 AI 通过"Delete"行动移除的文本段落，  
   **When** 小王按下 Ctrl+Z（Undo）尝试恢复该段落，  
   **Then** 该段落必须**无法恢复**，Undo 操作应被阻止或跳过此删除事务

3. **Given** 编辑器中存在多个锁定块（来自多次 Provoke 行动），  
   **When** 小王尝试使用"全选 + 删除"或"替换全部"功能，  
   **Then** 所有锁定块必须保持不变，只有非锁定内容被删除

4. **Given** 小王正在编辑锁定块**之前**或**之后**的正常文本，  
   **When** 小王的编辑操作涉及光标移动或选区变化，  
   **Then** 锁定块的边界必须被明确标识（例如通过高亮或边框），且光标不能进入锁定块内部编辑

---

### User Story 2 - Muse Mode STUCK Detection and Intervention (Priority: P1)

**Actor**: 小王 (Creative Enthusiast) - 陷入"创意卡壳"的创作者

**Scenario**: 当小王在"Muse 模式"下写作时，如果他停止输入超过 60 秒，Agent 应"感知"到他陷入 STUCK 状态，并"自主决策"注入一个与上下文相关的"创意施压"块，强制打破他的心智定势。

**Why this priority**: 这是核心 Vibe 的**主动介入机制**，直接解决用户的核心痛点（Mental Set 和 Blank Page Anxiety）。没有这一功能，Agent 就只是一个被动工具。

**Independent Test**: 可以通过以下独立测试验证：
1. 在 Muse 模式下输入一段文本（例如："他打开门，犹豫着要不要进去。"）
2. 停止输入并等待 60 秒
3. 验证 Agent 自动触发后端 API 调用
4. 验证编辑器中注入了一个新的 Markdown blockquote 且该块带有 lock_id

**Acceptance Scenarios**:

1. **Given** 小王在 Muse 模式下写作，当前文档内容为"他打开门，犹豫着要不要进去。"，  
   **When** 小王停止输入达到 60 秒（状态机：WRITING → IDLE → STUCK），  
   **Then** Agent 必须调用后端 API `/api/v1/impetus/generate-intervention`（mode: "muse"），并在光标位置注入返回的 Provoke 内容（例如：`> Muse 注入：门后传来低沉的呼吸声。`）

2. **Given** 小王在 STUCK 状态下收到 AI 注入的施压块，  
   **When** 注入完成，  
   **Then** 该块必须立即应用 lock_id 标记，并触发"Glitch"闪烁动画和"Clank"（锁上）音效

3. **Given** 小王在注入后的 10 秒内再次停止输入，  
   **When** 60 秒计时器再次触发，  
   **Then** Agent 必须再次调用后端 API，但后端应返回**不同的**施压内容（避免重复，基于新的上下文）

4. **Given** 小王在 Muse 模式下持续高速输入（每秒 >2 个字符），  
   **When** 输入持续超过 5 分钟，  
   **Then** STUCK 检测器必须**不触发**，状态机保持在 WRITING 状态

5. **Given** 后端 API 调用失败或超时（例如网络错误），  
   **When** STUCK 状态触发介入，  
   **Then** 前端必须显示友好的错误提示（例如："AI 暂时无法连接，请稍后再试"），且不应注入空白或损坏的锁定块

---

### User Story 3 - Loki Mode Random Chaos Interventions (Priority: P1)

**Actor**: 小王 (Creative Enthusiast) - 渴望"游戏化纪律"的创作者

**Scenario**: 当小王启用"Loki 模式"时，Agent 应在**随机时间间隔**（30-120 秒）主动"行动"，无论小王是否在写作。行动可能是"Provoke"（注入施压）或"Delete"（删除最后一句），将写作变成一场 Rogue-like 游戏。

**Why this priority**: 这是核心 Vibe 的**混沌游戏化**机制，提供"纪律"的同时避免枯燥。它强化了"失去控制"的 Roguelike 体验，这是项目的核心卖点。

**Independent Test**: 可以通过以下独立测试验证：
1. 启用 Loki 模式
2. 等待随机触发（使用加速测试模式：10-30 秒）
3. 验证 Agent 调用后端 API 并执行返回的 action（"provoke" 或 "delete"）
4. 验证执行的行动不可撤销

**Acceptance Scenarios**:

1. **Given** 小王启用 Loki 模式，当前文档内容为"他打开门，犹豫着要不要进去。突然，门后传来脚步声。"，  
   **When** 随机定时器触发（例如 45 秒后），  
   **Then** Agent 必须调用后端 API `/api/v1/impetus/generate-intervention`（mode: "loki"），并执行返回的 action

2. **Given** 后端 API 返回 `{ "action": "provoke", "content": "脚步声突然停止。", "lock_id": "lock_xxx" }`，  
   **When** 前端接收响应，  
   **Then** 必须在光标位置注入该内容，应用 lock_id 标记，并触发"Glitch"动画 + "Clank"音效

3. **Given** 后端 API 返回 `{ "action": "delete", "anchor": { "type": "range", "from": 1289, "to": 1310 } }`（删除"突然，门后传来脚步声。"），  
   **When** 前端接收响应，  
   **Then** 必须根据 anchor 定位并删除指定范围的文本，**绕过 Undo 栈**，且不触发"可撤销"事务

4. **Given** 小王在 Loki 模式下疯狂输入了 500 字，  
   **When** Loki 定时器在输入过程中触发，  
   **Then** Agent 必须**仍然执行介入**，即使用户正在写作（这是 Loki 与 Muse 的核心区别）

5. **Given** 小王在 Loki 模式下收到"Delete"行动，删除了他刚写的最后一句话，  
   **When** 他按下 Ctrl+Z（Undo），  
   **Then** 该删除操作必须**无法撤销**，Undo 应跳过此事务或显示"无法撤销 AI 行动"的提示

6. **Given** Loki 模式连续触发了 3 次"Delete"行动，导致文档几乎被清空，  
   **When** 文档剩余字符数 <50，  
   **Then** 后端应**拒绝返回新的"Delete"行动**，改为返回"Provoke"（防止文档被完全清空的安全保护）

---

### User Story 4 - Manual Demo Trigger Button (Priority: P2)

**Actor**: 小王 (Creative Enthusiast) - 在演示 Impetus Lock 时的演示者

**Scenario**: 在演示或测试时，小王希望有一个"我卡住了！"按钮，可以立即触发 Muse 模式的 STUCK 状态，而无需等待 60 秒，以便快速展示 Agent 的介入效果。

**Why this priority**: 这是**辅助功能**（auxiliary），不是核心 Vibe。它提升了演示体验，但不是 MVP 的必要组成部分（Article II）。

**Independent Test**: 可以通过以下独立测试验证：
1. 在 Muse 模式下点击"我卡住了！"按钮
2. 验证 Agent 立即触发后端 API 调用
3. 验证行为与自然触发的 STUCK 状态完全相同

**Acceptance Scenarios**:

1. **Given** 小王在 Muse 模式下写作，但只写了 5 秒（未达到 STUCK 条件），  
   **When** 他点击界面上的"我卡住了！"按钮，  
   **Then** Agent 必须**立即**触发 Muse 介入流程，调用后端 API 并注入施压内容

2. **Given** 小王在 Loki 模式下点击"我卡住了！"按钮，  
   **When** 按钮被点击，  
   **Then** 系统应显示提示："Loki 模式不支持手动触发"（因为 Loki 是随机触发，手动触发会破坏其混沌特性）

3. **Given** 小王在自然 STUCK 状态（60 秒无输入）下点击"我卡住了！"按钮，  
   **When** 按钮被点击，  
   **Then** 系统应**重置 STUCK 计时器**，避免立即触发两次介入（防止重复）

---

### User Story 5 - Visual and Audio Feedback (Priority: P2)

**Actor**: 小王 (Creative Enthusiast) - 渴望游戏化感官反馈的用户

**Scenario**: 当 AI 执行"行动"（Provoke 或 Delete）时，小王希望获得清晰的视觉和听觉反馈，以强化"游戏化"体验，让介入行为更有仪式感和冲击力。

**Why this priority**: 这是**UI 增强**（UI polish），属于 P2 优先级（Article II）。它显著提升用户体验，但不是核心功能的必要条件。

**Independent Test**: 可以通过以下独立测试验证：
1. 触发一次 Provoke 行动
2. 观察是否播放"Glitch"动画和"Clank"音效
3. 尝试删除锁定块
4. 观察是否播放"Shake"动画和"Bonk"音效

**Acceptance Scenarios**:

1. **Given** Agent 成功注入一个 Provoke 内容块，  
   **When** 注入完成，  
   **Then** 该块必须播放**"Glitch"闪烁动画**（持续 0.5 秒，类似 CRT 屏幕故障效果）和**"Clank"音效**（金属锁上的声音，音量适中）

2. **Given** 小王尝试删除一个锁定块（按下 Backspace/Delete），  
   **When** 删除操作被阻止，  
   **Then** 该块必须播放**"Shake"震动动画**（左右震动 3 次，持续 0.3 秒）和**"Bonk"音效**（类似撞墙的钝响，表示"无效操作"）

3. **Given** Agent 执行"Delete"行动，删除用户的最后一句话，  
   **When** 删除完成，  
   **Then** 被删除区域必须短暂显示**"消失动画"**（淡出效果，0.4 秒）和**"Whoosh"音效**（快速划过的声音）

4. **Given** 小王在系统设置中关闭了"音效"选项，  
   **When** 任何 AI 行动触发，  
   **Then** 必须**只播放视觉动画**，不播放任何音效

5. **Given** 小王在低性能设备上使用 Impetus Lock（例如老旧笔记本），  
   **When** 动画播放，  
   **Then** 动画必须使用 CSS transform（GPU 加速），避免卡顿，且动画帧率 ≥30 FPS

---

### Edge Cases

- **What happens when the user is typing at the exact moment a Loki intervention triggers?**  
  系统必须等待当前输入事务完成（例如当前字符被提交到文档）后，再执行 Loki 行动，避免打断用户的输入流。
  
- **What happens when the user rapidly switches between Muse and Loki modes?**  
  系统必须立即停止当前模式的定时器，并启动新模式的定时器。已经触发但尚未完成的 API 请求应被取消（通过 AbortController）。
  
- **What happens when the backend API returns a "Delete" action but the anchor position is invalid (e.g., out of bounds)?**  
  前端必须验证 anchor 的有效性。如果 `from` 或 `to` 超出文档范围，应记录错误日志，显示用户友好的提示（"AI 行动失败，请刷新页面"），且不执行删除操作。
  
- **What happens when the user refreshes the page or closes and reopens the editor?**  
  所有锁定块的 lock_id 标记必须被持久化（例如存储在文档的元数据中或使用特殊的 Markdown 语法如 `<!-- lock:xxx -->`）。页面重新加载后，这些锁定块必须仍然保持"不可删除"状态。
  
- **What happens when the user manually edits the document source (e.g., in developer tools or raw Markdown mode)?**  
  系统应在文档加载时扫描所有带有 lock_id 标记的块，并重新应用"不可删除"约束。如果用户通过外部方式删除了锁标记，该块将失去保护（这是可接受的边缘情况，因为用户主动绕过了系统）。
  
- **What happens when the backend API is unreachable for an extended period (e.g., 5+ consecutive failures)?**  
  前端应在连续失败 5 次后，自动暂停 Agent 介入，并显示持久化通知："AI Agent 暂时离线，已切换为普通编辑模式。"用户可手动点击"重试连接"按钮恢复。
  
- **What happens when the user copies a locked block and pastes it elsewhere?**  
  粘贴的内容应**不带 lock_id 标记**（即普通文本），以避免用户无法编辑自己复制的内容。只有 AI 直接注入的内容才应被锁定。

---

## Requirements *(mandatory)*

### Functional Requirements

#### Core Lock Mechanism

- **FR-001**: 系统必须能够为文档中的任意文本块分配唯一的 `lock_id` 标识符（UUID 格式）
- **FR-002**: 系统必须能够通过编辑器内核层（例如 ProseMirror 的 `filterTransaction`）拦截所有试图删除或修改带有 `lock_id` 标记的文本块的操作
- **FR-003**: 当用户尝试删除锁定块时，系统必须阻止该操作，并触发视觉反馈（Shake 动画）和音效反馈（Bonk 音效）
- **FR-004**: 系统必须能够绕过编辑器的 Undo/Redo 栈，使得 AI 执行的"Delete"行动无法通过 Ctrl+Z 撤销
- **FR-005**: 锁定块的 `lock_id` 必须被持久化，页面刷新后仍然有效

#### Muse Mode - STUCK Detection

- **FR-006**: 系统必须实现一个状态机，跟踪用户的写作状态（WRITING、IDLE、STUCK）
- **FR-007**: 当用户在 60 秒内没有输入任何字符时，状态机必须从 IDLE 转换到 STUCK
- **FR-008**: 当状态转换到 STUCK 时，系统必须调用后端 API `/api/v1/impetus/generate-intervention`（mode: "muse"），传递光标前最后 3 句话作为 context
- **FR-009**: 系统必须在收到后端响应后，在光标位置注入返回的 Markdown blockquote 内容，并应用 `lock_id` 标记
- **FR-010**: 注入完成后，系统必须触发"Glitch"闪烁动画和"Clank"音效

#### Loki Mode - Random Chaos

- **FR-011**: 系统必须实现一个随机定时器，在 30-120 秒的随机间隔内触发 Loki 介入
- **FR-012**: 当定时器触发时，系统必须调用后端 API `/api/v1/impetus/generate-intervention`（mode: "loki"），传递当前上下文
- **FR-013**: 系统必须根据后端返回的 `action` 字段执行相应操作：
  - 如果 `action` 为 "provoke"：注入 `content` 内容并应用 `lock_id`
  - 如果 `action` 为 "delete"：根据 `anchor` 定位并删除指定文本范围，绕过 Undo 栈
- **FR-014**: 系统必须在文档剩余字符数 <50 时，拒绝执行"Delete"行动（安全保护）
- **FR-015**: 系统必须能够在用户输入过程中执行 Loki 介入（与 Muse 模式不同）

#### Backend API Integration

- **FR-016**: 系统必须使用幂等键（Idempotency-Key header）调用后端 API，避免重复介入
- **FR-017**: 系统必须能够处理后端 API 的以下响应：
  - 200 OK：成功返回 `InterventionResponse`
  - 400 Bad Request：无效输入（例如锚点不存在）
  - 422 Unprocessable Entity：请求体验证失败
  - 429 Too Many Requests：触发限流
  - 500 Internal Server Error：服务端错误
- **FR-018**: 系统必须在 API 调用失败时，显示用户友好的错误提示，不应注入空白或损坏的内容
- **FR-019**: 系统必须在连续 5 次 API 调用失败后，自动暂停 Agent 介入，并允许用户手动重试

#### Demo Mode

- **FR-020**: 系统必须在 Muse 模式下提供一个"我卡住了！"按钮，点击后立即触发 STUCK 介入流程
- **FR-021**: 系统必须在 Loki 模式下禁用该按钮，并显示提示"Loki 模式不支持手动触发"
- **FR-022**: 系统必须在手动触发后重置 STUCK 计时器，避免立即触发两次介入

#### Visual and Audio Feedback

- **FR-023**: 系统必须在注入 Provoke 内容时，播放"Glitch"闪烁动画（0.5 秒）和"Clank"音效
- **FR-024**: 系统必须在用户尝试删除锁定块时，播放"Shake"震动动画（0.3 秒）和"Bonk"音效
- **FR-025**: 系统必须在执行"Delete"行动时，播放淡出动画（0.4 秒）和"Whoosh"音效
- **FR-026**: 系统必须提供音效开关选项，允许用户禁用音效但保留视觉动画
- **FR-027**: 所有动画必须使用 GPU 加速（CSS transform），确保在低性能设备上帧率 ≥30 FPS

---

### Key Entities

- **LockBlock（锁定块）**: 一个带有唯一 `lock_id` 标识符的文本块，通常为 Markdown blockquote 格式（例如 `> Muse 注入：内容 <!-- lock:lock_x -->`）。属性包括：
  - `lock_id` (string, UUID): 唯一标识符
  - `content` (string): 文本内容
  - `source` (enum: "muse" | "loki"): 来源模式
  - `created_at` (timestamp): 创建时间
  - `is_deletable` (boolean): 始终为 `false`

- **WritingState（写作状态）**: 用户当前的写作状态，由状态机维护。可能的值：
  - `WRITING`: 用户正在输入（最近 5 秒内有输入）
  - `IDLE`: 用户暂停输入（5-60 秒无输入）
  - `STUCK`: 用户陷入卡壳（超过 60 秒无输入）

- **InterventionAction（介入行动）**: Agent 执行的操作，由后端 API 返回。属性包括：
  - `action` (enum: "provoke" | "delete"): 行动类型
  - `content` (string, 可选): Provoke 内容（仅当 action 为 "provoke" 时）
  - `lock_id` (string, UUID, 可选): 锁 ID（仅当 action 为 "provoke" 时）
  - `anchor` (object, 可选): 删除锚点（仅当 action 为 "delete" 时）
  - `action_id` (string, UUID): 唯一行动 ID
  - `issued_at` (timestamp): 行动发出时间

- **Anchor（锚点）**: 用于定位文档中的目标位置，支持三种类型：
  - `pos`: 单点位置 `{ type: "pos", from: number }`
  - `range`: 位置范围 `{ type: "range", from: number, to: number }`
  - `lock_id`: 引用已存在的锁 ID `{ type: "lock_id", ref_lock_id: string }`

- **AgentMode（Agent 模式）**: 用户选择的 Agent 工作模式：
  - `muse`: 严格导师模式，STUCK 检测触发
  - `loki`: 混沌恶作剧模式，随机触发
  - `off`: Agent 关闭，普通编辑模式

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用户在尝试删除锁定块时，100% 的操作必须被阻止，且系统提供即时视觉/音效反馈（测试方法：自动化 E2E 测试，模拟 1000 次删除尝试）

- **SC-002**: Muse 模式下，STUCK 状态检测的准确率必须 ≥95%（测试方法：人工标注 100 次真实"卡壳"场景，系统成功检测 ≥95 次）

- **SC-003**: 从触发介入到内容注入完成，整个流程的响应时间必须 <3 秒（包括后端 API 调用）（测试方法：性能监控，取 100 次介入的 P95 响应时间）

- **SC-004**: Loki 模式下，随机触发的时间间隔必须符合 30-120 秒的均匀分布（测试方法：统计 1000 次触发的时间间隔，验证分布的均匀性）

- **SC-005**: 用户在体验 Impetus Lock 10 分钟后，对"破除心智定势"的主观评分必须 ≥4 分（满分 5 分）（测试方法：用户访谈和问卷调查，N≥30）

- **SC-006**: 后端 API 连续 5 次失败时，系统必须在 1 秒内自动暂停 Agent 介入，并显示友好错误提示（测试方法：模拟网络故障，验证暂停逻辑和 UI 提示）

- **SC-007**: 锁定块在页面刷新后，100% 保持"不可删除"状态（测试方法：创建 10 个锁定块，刷新页面，验证所有锁定块仍然有效）

- **SC-008**: 所有视觉动画在低性能设备（例如 Intel Core i3, 4GB RAM）上的帧率必须 ≥30 FPS（测试方法：使用 Chrome DevTools Performance 面板，记录动画帧率）

- **SC-009**: 用户在启用"Loki 模式"后，平均每 5 分钟内必须经历至少 2 次介入（Provoke 或 Delete）（测试方法：统计 100 个 5 分钟时段的介入次数，计算平均值）

- **SC-010**: 演示模式下，点击"我卡住了！"按钮后，介入必须在 1 秒内触发（测试方法：自动化 UI 测试，验证按钮点击到内容注入的时间间隔）

---

## Assumptions

1. **后端 API 已实现**：假设 `/api/v1/impetus/generate-intervention` 端点已按照 API_CONTRACT.md 规范实现，且 LLM 服务（Instructor + Pydantic）能够可靠生成结构化输出。

2. **编辑器选型**：假设前端使用 Milkdown（基于 ProseMirror）作为编辑器，因为它提供了 `filterTransaction` API，这是实现"不可删除"约束的核心技术依赖。

3. **Markdown 格式**：假设 AI 注入的内容始终为 Markdown blockquote 格式（`> Muse 注入：内容 <!-- lock:... -->`），这是最小化实现路径（Article I: Simplicity）。

4. **Context 大小**：假设"光标前最后 N 句话"的 N 默认为 3，这是基于经验的合理默认值（足够 LLM 理解上下文，但不会导致 token 数过大）。

5. **浏览器兼容性**：假设目标浏览器为现代浏览器（Chrome/Firefox/Edge 最新版），支持 ES2020 和 CSS Grid/Flexbox。

6. **音效资源**：假设"Clank"、"Bonk"、"Whoosh"音效文件已准备好（例如从免费音效库 Freesound.org 获取），且文件大小 <50KB。

7. **网络环境**：假设用户网络环境为 4G/WiFi，后端 API 平均响应时间 <1 秒（P95 <2 秒）。

8. **用户画像**：假设目标用户"小王"具备基本的计算机使用能力，熟悉 Markdown 语法，且不介意学习新的交互范式。

---

## Out of Scope (Not in P1)

以下功能**不在 P1 范围内**，但可能在未来版本中实现：

1. **多用户协作**：P1 仅支持单用户场景，不考虑多人同时编辑同一文档时的锁定块冲突。

2. **自定义触发条件**：P1 的 STUCK 检测时间固定为 60 秒，Loki 触发间隔固定为 30-120 秒。用户自定义这些参数不在 P1 范围内。

3. **锁定块的手动解锁**：P1 中锁定块是**永久不可删除**的（除非通过后台 `revert_token` 恢复）。用户请求"临时解锁"的功能不在 P1 范围内。

4. **多语言支持**：P1 仅支持中文 AI 施压内容。英文、日文等多语言支持不在 P1 范围内。

5. **历史记录和回放**：P1 不提供查看历史介入记录或回放 Agent 行动的功能。

6. **高级锚点类型**：P1 仅支持 `pos`、`range`、`lock_id` 三种基本锚点类型。基于语义的锚点（例如"删除包含关键词 X 的句子"）不在 P1 范围内。

7. **离线模式**：P1 依赖后端 API，不支持离线使用。本地 LLM 集成不在 P1 范围内。
