import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AIActionType } from "../types/ai-actions";
import { useAnimationController } from "../hooks/useAnimationController";
import { useAudioFeedback } from "../hooks/useAudioFeedback";

/**
 * Component props.
 */
interface SensoryFeedbackProps {
  /**
   * Current AI action type triggering feedback.
   */
  actionType: AIActionType | null;
}

/**
 * SensoryFeedback component orchestrates visual and audio feedback for AI actions.
 *
 * Combines Framer Motion animations with Web Audio API sounds to create
 * immersive feedback for AI intervention actions (Provoke/Delete/Reject).
 * Implements cancel-and-replace behavior via AnimatePresence unique keys.
 *
 * **Requirements**:
 * - FR-006 + FR-007: Glitch animation + Clank sound for Provoke
 * - FR-010 + FR-011: Fade-out animation + Whoosh sound for Delete
 * - FR-013 + FR-014: Shake animation + Bonk sound for Reject
 * - FR-015: Graceful degradation when audio unavailable
 * - FR-018: Respect prefers-reduced-motion
 * - FR-019: Cancel-and-replace (stop previous animation/audio)
 *
 * **Accessibility**:
 * - `role="status"`: Announces feedback to screen readers
 * - `aria-live="polite"`: Non-intrusive announcements
 * - `data-testid`: Test identifier for E2E/unit tests
 * - `data-animation`: Current animation type for debugging
 *
 * @param props - Component props
 * @param props.actionType - AI action type (PROVOKE/DELETE/REJECT) or null
 *
 * @example
 * ```typescript
 * function Editor() {
 *   const [currentAction, setCurrentAction] = useState<AIActionType | null>(null);
 *
 *   const handleProvoke = () => {
 *     setCurrentAction(AIActionType.PROVOKE);
 *     setTimeout(() => setCurrentAction(null), 2000); // Clear after animation
 *   };
 *
 *   return (
 *     <>
 *       <button onClick={handleProvoke}>Provoke</button>
 *       <SensoryFeedback actionType={currentAction} />
 *     </>
 *   );
 * }
 * ```
 */
export function SensoryFeedback({ actionType }: SensoryFeedbackProps) {
  const { animationKey, variants } = useAnimationController(actionType || AIActionType.PROVOKE);
  const { playAudio, isReady } = useAudioFeedback();

  // Play audio when action type changes
  useEffect(() => {
    if (actionType && isReady) {
      playAudio(actionType);
    }
  }, [actionType, isReady, playAudio]);

  // Don't render if no action
  if (!actionType) {
    return null;
  }

  // Map action type to animation name for data attribute
  const animationName = {
    [AIActionType.PROVOKE]: "glitch",
    [AIActionType.DELETE]: "fadeout",
    [AIActionType.REJECT]: "shake",
  }[actionType];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={animationKey}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        role="status"
        aria-live="polite"
        data-testid="sensory-feedback"
        data-animation={animationName}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: "none",
          zIndex: 9999,
          backgroundColor: "rgba(139, 92, 246, 0.1)", // Subtle purple overlay
        }}
      />
    </AnimatePresence>
  );
}
