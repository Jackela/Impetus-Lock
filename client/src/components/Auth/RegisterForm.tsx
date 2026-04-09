/**
 * Registration Form Component
 *
 * Provides email/password registration with validation and error display.
 *
 * @module components/Auth/RegisterForm
 */

import React, { useState } from "react";
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

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
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

    try {
      await register(email, password);
      onSuccess?.();
    } catch {
      // Error is handled by auth context
    }
  };

  const displayError = validationError || error;

  return (
    <div className="register-form">
      <h2>Register</h2>

      {displayError && (
        <div className="error-message" role="alert">
          {displayError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            placeholder="your@email.com"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            placeholder="••••••••"
            required
            minLength={8}
          />
          <small className="hint">Must be at least 8 characters</small>
        </div>

        <div className="form-group">
          <label htmlFor="confirm-password">Confirm Password</label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isLoading}
            placeholder="••••••••"
            required
          />
        </div>

        <button type="submit" disabled={isLoading} className="submit-button">
          {isLoading ? "Creating account..." : "Register"}
        </button>
      </form>

      {onSwitchToLogin && (
        <p className="switch-form">
          Already have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="link-button"
            disabled={isLoading}
          >
            Login
          </button>
        </p>
      )}
    </div>
  );
}
