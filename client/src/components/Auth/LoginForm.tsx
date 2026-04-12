/**
 * Login Form Component
 *
 * Provides email/password login with validation and error display.
 *
 * @module components/Auth/LoginForm
 */

import React, { useState } from "react";
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

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
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

    try {
      await login(email, password);
      onSuccess?.();
    } catch {
      // Error is handled by auth context
    }
  };

  const displayError = validationError || error;

  return (
    <div className="login-form">
      <h2>Login</h2>

      {displayError && (
        <div className="error-message" role="alert">
          {displayError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            placeholder="your@email.com"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            placeholder="••••••••"
            required
          />
        </div>

        <button type="submit" disabled={isLoading} className="submit-button">
          {isLoading ? "Logging in..." : "Login"}
        </button>
      </form>

      {onSwitchToRegister && (
        <p className="switch-form">
          Don&apos;t have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="link-button"
            disabled={isLoading}
          >
            Register
          </button>
        </p>
      )}
    </div>
  );
}
