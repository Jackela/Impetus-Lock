/**
 * SensoryFeedback Demo Component
 *
 * Interactive demo to test visual + audio feedback system.
 * Shows how to trigger different AI action types and their corresponding
 * animations and sounds.
 */

import { useState } from "react";
import { SensoryFeedback } from "./SensoryFeedback";
import { AIActionType } from "../types/ai-actions";

/**
 * Demo component for testing SensoryFeedback system.
 *
 * Provides buttons to trigger each AI action type:
 * - PROVOKE: Glitch animation + Clank sound
 * - DELETE: Fade-out animation + Whoosh sound
 * - REJECT: Shake animation + Bonk sound
 *
 * @example
 * ```tsx
 * // Add to App.tsx for testing:
 * import { SensoryFeedbackDemo } from './components/SensoryFeedbackDemo';
 *
 * <SensoryFeedbackDemo />
 * ```
 */
export function SensoryFeedbackDemo() {
  const [actionType, setActionType] = useState<AIActionType | null>(null);

  /**
   * Trigger an AI action and clear it after animation duration.
   *
   * @param type - AI action type to trigger
   */
  const triggerAction = (type: AIActionType) => {
    setActionType(type);

    // Clear action after 2 seconds (animation duration)
    setTimeout(() => {
      setActionType(null);
    }, 2000);
  };

  return (
    <div
      style={{
        padding: "2rem",
        border: "2px solid #8b5cf6",
        borderRadius: "8px",
        backgroundColor: "#1a1a1a",
        maxWidth: "600px",
        margin: "2rem auto",
      }}
    >
      <h2 style={{ color: "#8b5cf6", marginTop: 0 }}>🎵 Sensory Feedback Demo</h2>

      <p style={{ color: "#ddd", marginBottom: "1.5rem" }}>点击按钮触发不同的音效和动画：</p>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
        <button
          onClick={() => triggerAction(AIActionType.PROVOKE)}
          disabled={actionType !== null}
          style={{
            flex: 1,
            padding: "1rem",
            fontSize: "1rem",
            fontWeight: "bold",
            backgroundColor: "#10b981",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: actionType ? "not-allowed" : "pointer",
            opacity: actionType ? 0.5 : 1,
          }}
        >
          🔨 PROVOKE
          <br />
          <small style={{ fontWeight: "normal" }}>Glitch + Clank</small>
        </button>

        <button
          onClick={() => triggerAction(AIActionType.DELETE)}
          disabled={actionType !== null}
          style={{
            flex: 1,
            padding: "1rem",
            fontSize: "1rem",
            fontWeight: "bold",
            backgroundColor: "#ef4444",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: actionType ? "not-allowed" : "pointer",
            opacity: actionType ? 0.5 : 1,
          }}
        >
          🌀 DELETE
          <br />
          <small style={{ fontWeight: "normal" }}>Fade + Whoosh</small>
        </button>

        <button
          onClick={() => triggerAction(AIActionType.REJECT)}
          disabled={actionType !== null}
          style={{
            flex: 1,
            padding: "1rem",
            fontSize: "1rem",
            fontWeight: "bold",
            backgroundColor: "#f59e0b",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: actionType ? "not-allowed" : "pointer",
            opacity: actionType ? 0.5 : 1,
          }}
        >
          ⛔ REJECT
          <br />
          <small style={{ fontWeight: "normal" }}>Shake + Bonk</small>
        </button>
      </div>

      <div
        style={{
          padding: "1rem",
          backgroundColor: "#2d2d2d",
          borderRadius: "4px",
          color: "#aaa",
          fontSize: "0.9rem",
        }}
      >
        <strong>当前状态：</strong> {actionType || "Idle (等待触发)"}
      </div>

      {/* SensoryFeedback component handles visual + audio */}
      <SensoryFeedback actionType={actionType} />
    </div>
  );
}
