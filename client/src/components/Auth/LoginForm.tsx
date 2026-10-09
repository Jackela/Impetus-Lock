/**
 * Login Form Component
 *
 * Provides email/password login with validation and error display.
 *
 * @module components/Auth/LoginForm
 */

import type { JSX } from "react";
import React, { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

/** Props for LoginForm */
interface LoginFormProps {
  /** Callback after successful login */
  onSuccess?: () => void;
  /** Callback to switch to register form */
  onSwitchToRegister?: () => void;
}

/**
 * Login form component with email and password fields.
 *
 * @param root0 - Component props
 * @param root0.onSuccess - Callback invoked after successful login
 * @param root0.onSwitchToRegister - Callback to switch to the register form
 * @returns The rendered login form
 *
 * @example
 * ```tsx
 * <LoginForm onSuccess={() => navigate("/tasks")} />
 * ```
 */
export function LoginForm({ onSuccess, onSwitchToRegister }: LoginFormProps): JSX.Element {
  const { login, isLoading, error, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const errorId = useId();
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

    // Basic validation
    if (!email.trim()) {
      setValidationError("Email is required");
      return;
    }

    if (!password) {
      setValidationError("Password is required");
      return;
    }

    submitting.current = true;
    setIsSubmitting(true);
    try {
      await login(email, password);
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
    <div className="login-form">
      <h2>Login</h2>

      {displayError && (
        <div id={errorId} ref={errorRef} tabIndex={-1} className="error-message" role="alert">
          {displayError}
        </div>
      )}

      <form onSubmit={handleSubmit} aria-label="Login" aria-busy={busy}>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
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
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            placeholder="••••••••"
            required
            aria-describedby={displayError ? errorId : undefined}
            aria-invalid={!!displayError}
          />
        </div>

        <button type="submit" disabled={busy} className="submit-button">
          {busy ? "Logging in..." : "Login"}
        </button>
      </form>

      {onSwitchToRegister && (
        <p className="switch-form">
          Don&apos;t have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="link-button"
            disabled={busy}
          >
            Register
          </button>
        </p>
      )}
    </div>
  );
}
