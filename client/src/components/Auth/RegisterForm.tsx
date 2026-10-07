/**
 * Registration Form Component
 *
 * Provides email/password registration with validation and error display.
 *
 * @module components/Auth/RegisterForm
 */

import type { JSX } from "react";
import React, { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

/** Props for RegisterForm */
interface RegisterFormProps {
  /** Callback after successful registration */
  onSuccess?: () => void;
  /** Callback to switch to login form */
  onSwitchToLogin?: () => void;
}

/**
 * Registration form component with email and password fields.
 *
 * @param root0 - Component props
 * @param root0.onSuccess - Callback invoked after successful registration
 * @param root0.onSwitchToLogin - Callback to switch to the login form
 * @returns The rendered registration form
 *
 * @example
 * ```tsx
 * <RegisterForm onSuccess={() => navigate("/tasks")} />
 * ```
 */
export function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps): JSX.Element {
  const { register, isLoading, error, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const errorId = useId();
  const passwordHintId = useId();
  const errorRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const initiallyFocused = useRef(false);
  const submitting = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const busy = isLoading || isSubmitting;

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (busy || submitting.current) return;
    clearError();
    setValidationError(null);

    // Validation
    if (!email.trim()) {
      setValidationError("Email is required");
      return;
    }

    if (!password) {
      setValidationError("Password is required");
      return;
    }

    if (password.length < 8) {
      setValidationError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setValidationError("Passwords do not match");
      return;
    }

    submitting.current = true;
    setIsSubmitting(true);
    try {
      await register(email, password);
      onSuccess?.();
    } catch {
      // Error is handled by auth context
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  const displayError = validationError || error;
  useEffect(() => {
    if (displayError) errorRef.current?.focus();
    else if (!busy && !initiallyFocused.current) {
      emailRef.current?.focus();
      initiallyFocused.current = true;
    }
  }, [displayError, busy]);

  return (
    <div className="register-form">
      <h2>Register</h2>

      {displayError && (
        <div id={errorId} ref={errorRef} tabIndex={-1} className="error-message" role="alert">
          {displayError}
        </div>
      )}

      <form onSubmit={handleSubmit} aria-label="Register" aria-busy={busy}>
        <div className="form-group">
          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            ref={emailRef}
            name="email"
            autoComplete="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            placeholder="your@email.com"
            required
            aria-describedby={displayError ? errorId : undefined}
            aria-invalid={!!displayError}
          />
        </div>

        <div className="form-group">
          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            name="password"
            autoComplete="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            placeholder="••••••••"
            required
            minLength={8}
            aria-describedby={[passwordHintId, displayError ? errorId : ""]
              .filter(Boolean)
              .join(" ")}
            aria-invalid={!!displayError}
          />
          <small id={passwordHintId} className="hint">
            Must be at least 8 characters
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="confirm-password">Confirm Password</label>
          <input
            id="confirm-password"
            name="confirm-password"
            autoComplete="new-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={busy}
            placeholder="••••••••"
            required
            aria-describedby={displayError ? errorId : undefined}
            aria-invalid={!!displayError}
          />
        </div>

        <button type="submit" disabled={busy} className="submit-button">
          {busy ? "Creating account..." : "Register"}
        </button>
      </form>

      {onSwitchToLogin && (
        <p className="switch-form">
          Already have an account?{" "}
          <button type="button" onClick={onSwitchToLogin} className="link-button" disabled={busy}>
            Login
          </button>
        </p>
      )}
    </div>
  );
}
