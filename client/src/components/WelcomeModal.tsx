import { useCallback, useEffect, useState } from "react";
import "./WelcomeModal.css";

const STORAGE_KEY = "impetus-lock-welcome-dismissed";

interface WelcomeModalProps {
  /** Force modal to show (for testing or re-triggering) */
  forceShow?: boolean;
  /** Callback when modal is dismissed */
  onDismiss?: () => void;
}

/**
 * Welcome Modal - Onboarding for new users
 *
 * Explains the core concept of Impetus Lock and the two AI modes:
 * - Muse: Creative pressure when stuck
 * - Loki: Random chaos (deletes + rewrites)
 * - Lock: AI additions cannot be removed
 *
 * Shows on first visit, can be dismissed permanently via localStorage.
 */
export function WelcomeModal({ forceShow = false, onDismiss }: WelcomeModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Check localStorage on initial mount to show modal for new users
  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      setIsOpen(true);
    }
  }, []); // Run once on mount

  // Allow forceShow prop to override and re-open modal
  useEffect(() => {
    if (forceShow) {
      setIsOpen(true);
    }
  }, [forceShow]);

  const handleClose = useCallback(() => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, "true");
    }
    setIsOpen(false);
    onDismiss?.();
  }, [dontShowAgain, onDismiss]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="welcome-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <div className="welcome-modal">
        <button
          className="welcome-modal-close"
          onClick={handleClose}
          aria-label="Close welcome modal"
        >
          ×
        </button>

        <h2 id="welcome-title">Welcome to Impetus Lock</h2>

        <p className="welcome-intro">
          An un-deletable task pressure system that keeps you moving forward.
        </p>

        <div className="welcome-modes">
          <section className="welcome-mode muse-mode">
            <h3 className="mode-muse">
              Muse Mode <span className="recommended-badge">RECOMMENDED</span>
            </h3>
            <p>
              When you stop typing for 60 seconds, Muse adds creative prompts to help you overcome
              writer's block. Think of it as a gentle nudge to keep you flowing.
            </p>
            <p className="mode-trigger">
              <strong>Trigger:</strong> Manual button ("I'm stuck!") or 60s idle time
            </p>
          </section>

          <section className="welcome-mode">
            <h3 className="mode-loki">Loki Mode</h3>
            <p>
              Chaos mode. Loki randomly intervenes to either delete sections of your work or inject
              provocative suggestions. Unpredictable pressure to keep you on your toes.
            </p>
            <p className="mode-trigger">
              <strong>Trigger:</strong> Random intervals (chaos is unpredictable)
            </p>
          </section>

          <section className="welcome-mode">
            <h3 className="mode-lock">The Lock Concept</h3>
            <p>
              All AI-added content is <em>locked</em> — you cannot delete it. AI interventions become
              permanent parts of your document, creating pressure to engage with the material.
            </p>
            <p className="mode-trigger">
              <strong>Result:</strong> Shake animation + sound when you try to delete locked content
            </p>
          </section>
        </div>

        <div className="welcome-footer">
          <label className="welcome-checkbox">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            Don't show this again
          </label>

          <button className="welcome-button" onClick={handleClose}>
            Get Started
          </button>
        </div>

        <p className="welcome-hint">
          <em>Tip: Press "?" key anytime to re-open this guide</em>
        </p>
      </div>
    </div>
  );
}
