# Audio Feedback System - Quick Reference Guide

## 🎵 音效系统概述

Impetus Lock 的音效系统通过 Web Audio API 为 AI 干预动作提供沉浸式反馈。

## 📁 音频资源

音效文件位于 `client/src/assets/audio/`：

| 文件 | 动作类型 | 描述 |
|------|---------|------|
| `clank.mp3` | PROVOKE | 金属撞击声 - AI 施压时触发 |
| `whoosh.mp3` | DELETE | 风声/消散声 - 内容删除时触发 |
| `bonk.mp3` | REJECT | 碰撞/反弹声 - 操作被拒绝时触发 |

## 🎯 触发机制

### 1. 通过 `SensoryFeedback` 组件

```tsx
import { SensoryFeedback } from './components/SensoryFeedback';
import { AIActionType } from './types/ai-actions';
import { useState } from 'react';

function MyComponent() {
  const [actionType, setActionType] = useState<AIActionType | null>(null);

  const handleProvoke = () => {
    setActionType(AIActionType.PROVOKE); // 触发 Glitch 动画 + Clank 音效
    setTimeout(() => setActionType(null), 2000); // 清除状态
  };

  return (
    <>
      <button onClick={handleProvoke}>触发 AI 施压</button>
      <SensoryFeedback actionType={actionType} />
    </>
  );
}
```

### 2. 通过 `useAudioFeedback` Hook

```tsx
import { useAudioFeedback } from './hooks/useAudioFeedback';
import { AIActionType } from './types/ai-actions';

function MyComponent() {
  const { playAudio, isReady } = useAudioFeedback();

  const handleAction = () => {
    if (isReady) {
      playAudio(AIActionType.PROVOKE); // 仅播放音效，无动画
    }
  };

  return <button onClick={handleAction}>播放音效</button>;
}
```

## 🧪 测试音效系统

### 在应用中查看反馈

`SensoryFeedbackDemo` 是单独的演示组件，目前没有挂载到 `App.tsx`。应用中的反馈由 `EditorCore` 根据真实编辑器动作显示；浏览器人工检查步骤见 [MANUAL_TESTING_GUIDE.md](./MANUAL_TESTING_GUIDE.md)。

启动前端：

```bash
cd client
npm run dev
```

使用应用中的 Muse/Loki 模式和编辑器操作触发反馈。Loki 与 Muse 的干预需要后端及已配置的 LLM 提供方；本指南中的组件测试和本地检查不能证明浏览器或生产环境行为。

### 手动触发

点击右上角的 **"I'm stuck!"** 按钮（`ManualTriggerButton`）：

- **前提**: 后端服务器必须启动（见下方）
- **效果**: 触发 AI 干预 → 返回 PROVOKE/DELETE 动作 → 播放对应音效

## 🚀 启动完整系统

### 前端（Vite + React）

```bash
cd client
npm run dev
```

访问: http://localhost:5173

### 后端（FastAPI + Poetry）

```bash
cd server
poetry run uvicorn server.api.main:app --reload --host 127.0.0.1 --port 8000
```

验证: http://127.0.0.1:8000/health

## 🎨 AI 动作类型

| AIActionType | 动画 | 音效 | 触发场景 |
|-------------|------|------|---------|
| `PROVOKE` | Glitch (故障闪烁) | Clank (金属撞击) | AI 施压/插入锁定内容 |
| `DELETE` | Fade-out (淡出) | Whoosh (风声) | Loki 模式删除内容 |
| `REJECT` | Shake (抖动) | Bonk (碰撞) | 用户尝试删除锁定内容 |

## 🔧 配置

### 音效音量调整

编辑 `client/src/hooks/useAudioFeedback.ts`:

```typescript
const gainNode = audioContext.createGain();
gainNode.gain.value = 0.5; // 调整音量 (0.0 - 1.0)
```

### 禁用音效（测试用）

编辑 `client/src/components/SensoryFeedback.tsx`:

```typescript
// 注释掉 playAudio 调用
useEffect(() => {
  if (actionType && isReady) {
    // playAudio(actionType); // 禁用音效
  }
}, [actionType, isReady, playAudio]);
```

## 📊 测试覆盖

音效系统测试位于：

- **单元测试**: `client/src/hooks/useAudioFeedback.test.ts`
- **组件测试**: `client/src/components/SensoryFeedback.test.tsx`
- **E2E 测试**: `client/e2e/sensory-feedback.spec.ts`

运行测试:

```bash
cd client
npm run test              # 单元测试
npm run test:e2e          # E2E 测试
```

## ⚠️ 常见问题

### 1. 音效不播放

**原因**: 浏览器阻止自动播放音频

**解决**: 
- 用户必须先与页面交互（点击按钮）
- 使用 Demo 组件测试 - 按钮点击会触发用户交互

### 2. `AudioContext` 错误

**原因**: 浏览器不支持 Web Audio API（罕见）

**解决**: 
- 系统会自动降级（graceful degradation）
- 检查控制台警告: `Web Audio API not supported`

### 3. 后端连接失败 (`ERR_CONNECTION_REFUSED`)

**原因**: 后端服务器未启动

**解决**: 
```bash
cd server
poetry run uvicorn server.api.main:app --reload --host 127.0.0.1 --port 8000
```

## 🎯 实际使用场景

### 场景 1: 用户尝试删除锁定内容

```typescript
// 在 TransactionFilter 中检测到删除锁定内容
if (isAttemptingToDeleteLock) {
  setCurrentAction(AIActionType.REJECT); // 触发 Shake + Bonk
}
```

### 场景 2: AI Muse 模式施压

```typescript
// API 返回 PROVOKE 动作
const response = await triggerMuseIntervention(context, cursor, version);
if (response.action.type === 'PROVOKE') {
  setCurrentAction(AIActionType.PROVOKE); // 触发 Glitch + Clank
}
```

### 场景 3: Loki 模式随机删除

```typescript
// API 返回 DELETE 动作
const response = await triggerLokiIntervention(context, cursor, version);
if (response.action.type === 'DELETE') {
  setCurrentAction(AIActionType.DELETE); // 触发 Fade + Whoosh
}
```

## 📝 开发指南

### 添加新音效

1. 将音频文件放入 `client/src/assets/audio/`
2. 更新 `useAudioFeedback.ts`:
   ```typescript
   const audioFiles = {
     [AIActionType.PROVOKE]: '/src/assets/audio/clank.mp3',
     [AIActionType.DELETE]: '/src/assets/audio/whoosh.mp3',
     [AIActionType.REJECT]: '/src/assets/audio/bonk.mp3',
     [AIActionType.NEW_TYPE]: '/src/assets/audio/new-sound.mp3', // 新增
   };
   ```

### 调整动画时长

编辑 `client/src/hooks/useAnimationController.ts`:

```typescript
const variants = {
  glitch: {
    initial: { opacity: 1 },
    animate: { 
      opacity: [1, 0, 1, 0, 1],
      transition: { duration: 0.5 } // 调整时长
    }
  }
};
```

## 🔗 相关文档

- [SensoryFeedback 组件](./client/src/components/SensoryFeedback.tsx)
- [useAudioFeedback Hook](./client/src/hooks/useAudioFeedback.ts)
- [useAnimationController Hook](./client/src/hooks/useAnimationController.ts)
- [AI Actions Types](./client/src/types/ai-actions.ts)
