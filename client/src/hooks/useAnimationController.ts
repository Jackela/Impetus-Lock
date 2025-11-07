import { useMemo, useRef } from "react";
import { AIActionType } from "../types/ai-actions";

/**
 * Animation variants for Framer Motion.
 */
interface AnimationVariants {
  initial: { opacity: number; backgroundColor?: string; x?: number };
  animate: {
    opacity: number | number[];
    backgroundColor?: string | string[];
    x?: number | number[];
    transition: {
      duration: number;
      ease: string;
    };
  };
  exit: { opacity: number; backgroundColor?: string; x?: number };
}

/**
 * Hook return value.
 */
interface UseAnimationControllerReturn {
  animationKey: string;
  variants: AnimationVariants;
}

/**
 * Hook for controlling Framer Motion animations based on AI action type.
 *
 * Generates unique animation keys for cancel-and-replace behavior and provides
 * appropriate animation variants for each action type (Glitch/Fade-out/Shake).
 * Respects user's prefers-reduced-motion preference.
 *
 * **Requirements**:
 * - FR-007: Glitch animation for Provoke (opacity keyframes, 1.5s duration)
 * - FR-011: Fade-out animation for Delete (opacity 0, 0.75s duration)
 * - FR-014: Shake animation for Reject (uses P1 implementation)
 * - FR-018: Respect prefers-reduced-motion (simplified opacity-only animations)
 * - FR-019: Cancel-and-replace via unique keys per action
 *
 * @param actionType - Current AI action type
 * @returns Animation key and Framer Motion variants
 *
 * @example
 * ```typescript
 * function AnimatedFeedback({ actionType }: { actionType: AIActionType }) {
 *   const { animationKey, variants } = useAnimationController(actionType);
 *
 *   return (
 *     <AnimatePresence mode="wait">
 *       <motion.div
 *         key={animationKey}
 *         variants={variants}
 *         initial="initial"
 *         animate="animate"
 *         exit="exit"
 *       />
 *     </AnimatePresence>
 *   );
 * }
 * ```
 */
export function useAnimationController(actionType: AIActionType): UseAnimationControllerReturn {
  const counterRef = useRef(0);

  // Detect prefers-reduced-motion (FR-018)
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Generate unique animation key for cancel-and-replace (FR-019)
  const animationKey = useMemo(() => {
    counterRef.current += 1;
    return `${actionType}-${counterRef.current}-${Date.now()}`;
  }, [actionType]);

  // Generate animation variants based on action type
  const variants = useMemo((): AnimationVariants => {
    // Reduced-motion: Simple opacity change only (FR-018)
    if (prefersReducedMotion) {
      return {
        initial: { opacity: 1 },
        animate: {
          opacity: 0.5,
          transition: {
            duration: 0.2,
            ease: "linear",
          },
        },
        exit: { opacity: 0 },
      };
    }

    // Full animations based on action type
    switch (actionType) {
      case AIActionType.PROVOKE:
        // FR-007: Glitch animation - digital disruption effect
        return {
          initial: { opacity: 1 },
          animate: {
            opacity: [1, 0.5, 1, 0.3, 1, 0], // Glitch keyframes
            transition: {
              duration: 1.5,
              ease: "linear",
            },
          },
          exit: { opacity: 0 },
        };

      case AIActionType.DELETE:
        // FR-011: Fade-out animation - smooth disappearance
        return {
          initial: { opacity: 1 },
          animate: {
            opacity: 0,
            transition: {
              duration: 0.75,
              ease: "easeOut",
            },
          },
          exit: { opacity: 0 },
        };

      case AIActionType.REJECT:
        // P3 US2: Shake animation - horizontal oscillation for lock rejection
        // FR-003: Visual feedback when user attempts to delete locked content
        // Oscillates left/right to signal "you can't do that" rejection
        return {
          initial: { opacity: 1, x: 0 },
          animate: {
            opacity: 1, // Stable opacity - no fade during shake
            x: [0, -10, 10, -10, 10, -5, 5, 0], // Shake keyframes (decreasing amplitude)
            transition: {
              duration: 0.3, // Quick shake feedback (FR-003)
              ease: "easeInOut",
            },
          },
          exit: { opacity: 0, x: 0 },
        };

      case AIActionType.ERROR:
        // P3 US3: Red flash animation - urgent error indicator
        // FR-005: Visual feedback for API failures
        return {
          initial: { opacity: 1, backgroundColor: "transparent" },
          animate: {
            opacity: [1, 0.8, 1],
            backgroundColor: ["transparent", "rgba(239, 68, 68, 0.2)", "transparent"],
            transition: {
              duration: 0.5,
              ease: "easeInOut",
            },
          },
          exit: { opacity: 0, backgroundColor: "transparent" },
        };

      default:
        // Default: simple fade
        return {
          initial: { opacity: 1 },
          animate: {
            opacity: 0,
            transition: {
              duration: 0.3,
              ease: "linear",
            },
          },
          exit: { opacity: 0 },
        };
    }
  }, [actionType, prefersReducedMotion]);

  return { animationKey, variants };
}
