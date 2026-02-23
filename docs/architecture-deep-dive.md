# Impetus-Lock: 对抗式 AI 创意写作系统架构解析

> **"将孤独写作变成人机对抗的 Roguelike 游戏"**

*作者: The Architect (AI 架构师团队)*  
*日期: 2026-02-23*

---

## 一、项目概述：重新定义 AI 写作辅助

### 1.1 核心痛点

传统 AI 写作工具的问题：
- **过于顺从**: ChatGPT 式的"是的，先生"模式
- **被动响应**: 只在被问时才回答
- **无挑战性**: 从不质疑用户的想法

**结果**: 创作者陷入"回音室"，难以突破思维定式。

### 1.2 Impetus-Lock 的解决方案

**核心理念**: AI 不是助手，而是**对手**。

通过强制植入"不可删除的创作束缚"来破除心理定式——将孤独写作变成人机对抗的 Roguelike 游戏。

---

## 二、双 Agent 架构设计

### 2.1 Muse Mode (创意施压者)

**角色**: 严格的写作导师

**触发条件**:
- 60 秒无输入
- 用户主动点击"我卡住了！"

**行为模式**:
```
感知 (Perceive) → 决策 (Decide) → 行动 (Act)
     ↓                  ↓              ↓
检测 STUCK 状态    生成创意压力    植入约束文本
```

**技术实现**:
- 通过 ProseMirror `filterTransaction` 拦截删除操作
- 使用 `lock_id` 标记不可删除文本块
- LLM (Instructor + Pydantic) 生成结构化干预

### 2.2 Loki Mode (混沌恶作剧者)

**角色**: 不可预测的游戏对手

**触发条件**:
- 30-120 秒随机触发
- 与用户输入状态无关

**行为模式**:
| 动作 | 概率 | 效果 |
|------|------|------|
| PROVOKE | 50% | 注入恶作剧句子 |
| REWRITE | 25% | 混沌改写用户文本 |
| DELETE | 25% | 删除最后一句 |

**技术实现**:
- 客户端定时器随机触发
- 绕过前端 Undo 栈
- `revert_token` 机制用于紧急恢复

---

## 三、不可删除约束机制

### 3.1 核心挑战

如何在编辑器层面实现"物理上不可删除"的文本？

### 3.2 技术方案

**Milkdown (ProseMirror) + 自定义 Plugin**:

```typescript
// 核心拦截逻辑
const lockPlugin = new Plugin({
  filterTransaction(tr, state) {
    // 检查是否有 lock_id 标记的文本被删除
    const hasLockedDeletion = checkLockedDeletion(tr, state);
    if (hasLockedDeletion) {
      // 触发震动 + Bonk 音效
      triggerShakeAndSound();
      return false; // 阻止删除
    }
    return true;
  }
});
```

### 3.3 持久化策略

```markdown
用户输入: 这是一个故事的开头

Muse 注入:
> 但主角必须在第三幕背叛自己的信念 <!-- lock:muse_001 -->

存储格式:
- Markdown 注释保留 lock_id
- 页面加载时重新解析并应用锁
- 跨会话持久化
```

---

## 四、感官反馈系统

### 4.1 多模态反馈设计

| 动作 | 视觉 | 听觉 | 触觉 |
|------|------|------|------|
| Muse 注入 | Glitch 闪屏 | Clank 金属锁声 | - |
| Loki 删除 | Fade-out 淡出 | Whoosh 风声 | - |
| 尝试删除锁定 | Shake 震动 | Bonk 音效 | 设备震动 |

### 4.2 技术栈

- **动画**: Framer Motion
- **音频**: Web Audio API
- **触觉**: Navigator.vibrate

---

## 五、开发最佳实践

### 5.1 Architecture Guards

项目采用严格的架构护栏：

```
Constitution (宪法)
├── Article I: Simplicity & Anti-Abstraction
├── Article II: Vibe-First Imperative
├── Article III: Test-First Imperative (TDD)
├── Article IV: SOLID Principles
└── Article V: Clear Documentation
```

### 5.2 TDD 工作流

```
Red: 写失败测试
Green: 最小实现
Refactor: 优化代码
```

**强制要求**: 测试覆盖率 ≥ 80% for P1 features

### 5.3 Spec-Driven Development

- OpenAPI 契约先行
- Pydantic 模型严格验证
- 版本化 Prompt Registry

---

## 六、技术栈选型分析

### 6.1 前端

| 技术 | 用途 | 选型理由 |
|------|------|---------|
| React + Vite | UI 框架 | 生态成熟，开发体验好 |
| Milkdown | 编辑器 | ProseMirror 内核，可扩展性强 |
| Framer Motion | 动画 | React 生态最佳动画库 |
| TypeScript | 类型系统 | 大型项目必备 |

### 6.2 后端

| 技术 | 用途 | 选型理由 |
|------|------|---------|
| FastAPI | Web 框架 | 异步支持，自动生成文档 |
| Instructor | LLM 结构化输出 | 类型安全的 LLM 调用 |
| Pydantic | 数据验证 | Python 生态标准 |
| SQLAlchemy | ORM | 成熟稳定 |

### 6.3 AI 层

| 技术 | 用途 |
|------|------|
| Instructor | 结构化 LLM 输出 |
| Pydantic | 输出模式定义 |
| OpenAI/Anthropic API | 核心 LLM |

---

## 七、竞品对比

| 产品 | 模式 | 互动性 | 约束机制 |
|------|------|--------|---------|
| ChatGPT | 顺从助手 | 被动 | 无 |
| Claude | 温和助手 | 被动 | 无 |
| Sudowrite | 创意辅助 | 主动建议 | 可忽略 |
| **Impetus-Lock** | **对抗对手** | **强制干预** | **不可删除** |

**差异化**: Impetus-Lock 是唯一采用"强制约束"模式的创意写作工具。

---

## 八、未来展望

### 8.1 短期规划

- [ ] 多语言支持
- [ ] 自定义 Agent 人格
- [ ] 协作写作模式

### 8.2 长期愿景

**"AI 创意陪练"平台**:
- 绘画领域的 Muse/Loki
- 音乐创作的对抗式 AI
- 编程的"代码挑战者"

---

## 九、结语

Impetus-Lock 证明了 AI 不必总是顺从。有时候，最好的创作辅助来自于一个会挑战你、强迫你突破舒适区的对手。

> *"我们不是在与 AI 合作，我们在与 AI 对抗——而这种对抗，让创作变得更有趣。"*

---

**项目链接**: https://github.com/Jackela/Impetus-Lock  
**许可证**: MIT

---

*本文由 The Architect AI 团队撰写*  
*Kimi (主笔) + GLM-5 (架构顾问) + OpenCode (代码审查)*
