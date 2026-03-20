import { useState, useRef, useCallback } from "react";
import type { InterventionAPIError } from "./hooks/useInterventionApiError";

export function useAppState() {
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Modal states
  const [showWelcome, setShowWelcome] = useState(false);
  const [showConfigError, setShowConfigError] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showStyleLearning, setShowStyleLearning] = useState(false);

  // Error and feedback states
  const [lastLLMError, setLastLLMError] = useState<InterventionAPIError | null>(null);
  const [llmFeedback, setLLMFeedback] = useState<string | null>(null);

  // Timer state for Muse mode
  const [timerRemaining, setTimerRemaining] = useState<number>(60);

  // Refs
  const feedbackTimeout = useRef<number | null>(null);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const showFeedback = useCallback((message: string, duration = 3000) => {
    if (feedbackTimeout.current) {
      window.clearTimeout(feedbackTimeout.current);
    }
    setLLMFeedback(message);
    feedbackTimeout.current = window.setTimeout(() => {
      setLLMFeedback(null);
    }, duration);
  }, []);

  const clearFeedback = useCallback(() => {
    if (feedbackTimeout.current) {
      window.clearTimeout(feedbackTimeout.current);
    }
    setLLMFeedback(null);
  }, []);

  return {
    // Sidebar
    sidebarOpen,
    toggleSidebar,

    // Modals
    showWelcome,
    setShowWelcome,
    showConfigError,
    setShowConfigError,
    showSettings,
    setShowSettings,
    showCreateTaskModal,
    setShowCreateTaskModal,
    showStyleLearning,
    setShowStyleLearning,

    // Errors
    lastLLMError,
    setLastLLMError,

    // Feedback
    llmFeedback,
    showFeedback,
    clearFeedback,
    feedbackTimeout,

    // Timer
    timerRemaining,
    setTimerRemaining,
  };
}
