/**
 * Agent Mode Types
 *
 * Agent working mode configuration (Muse/Loki/Off).
 * Matches data-model.md AgentMode specification.
 *
 * Constitutional Compliance:
 * - Article V (Documentation): Complete JSDoc for all exported types
 *
 * @module types/mode
 */

/**
 * Agent working mode enum.
 *
 * Determines intervention behavior:
 * - **muse**: STUCK detection (60s idle) → Provoke only
 * - **loki**: Random triggers (30-120s) → Provoke OR Delete
 * - **off**: Agent disabled, normal editing mode
 *
 * @example
 * ```typescript
 * let mode: AgentMode = 'muse';
 *
 * // Switch to Loki mode
 * mode = 'loki';
 *
 * // Disable agent
 * mode = 'off';
 * ```
 */
export type AgentMode =
  /**
   * Muse mode - Strict mentor (STUCK-triggered provoke only).
   */
  | "muse"

  /**
   * Loki mode - Chaos trickster (random provoke/delete).
   */
  | "loki"

  /**
   * Agent disabled - Normal editing mode.
   */
  | "off";

/**
 * Type guard to validate AgentMode.
 *
 * @param mode - Potential AgentMode value
 * @returns True if mode is valid
 *
 * @example
 * ```typescript
 * if (isAgentMode(userInput)) {
 *   setMode(userInput);
 * }
 * ```
 */
export function isAgentMode(mode: unknown): mode is AgentMode {
  return ["muse", "loki", "off"].includes(mode);
}

/**
 * Agent mode display metadata for UI.
 *
 * @example
 * ```typescript
 * const metadata = AGENT_MODE_META.muse;
 * console.log(metadata.label); // "Muse - 严格导师"
 * console.log(metadata.description); // "STUCK 检测（60秒）→ 施压注入"
 * ```
 */
export const AGENT_MODE_META: Record<
  AgentMode,
  {
    label: string;
    description: string;
    color: string;
  }
> = {
  muse: {
    label: "Muse - 严格导师",
    description: "STUCK 检测（60秒）→ 施压注入",
    color: "#8B5CF6", // Purple
  },
  loki: {
    label: "Loki - 混沌恶作剧",
    description: "随机触发（30-120秒）→ 注入 或 删除",
    color: "#EF4444", // Red
  },
  off: {
    label: "关闭 Agent",
    description: "普通编辑模式",
    color: "#6B7280", // Gray
  },
};
