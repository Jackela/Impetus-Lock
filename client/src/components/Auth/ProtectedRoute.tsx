/**
 * Protected Route Component
 *
 * Redirects to login if user is not authenticated.
 * Preserves intended URL for post-login redirect.
 *
 * @module components/Auth/ProtectedRoute
 */

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

/** Props for ProtectedRoute */
interface ProtectedRouteProps {
  /** Child components to render if authenticated */
  children: React.ReactNode;
  /** Path to redirect to if not authenticated */
  redirectTo?: string;
}

/**
 * Protected route wrapper that requires authentication.
 *
 * @example
 * ```tsx
 * <Route path="/tasks" element={
 *   <ProtectedRoute>
 *     <TaskList />
 *   </ProtectedRoute>
 * } />
 * ```
 */
export function ProtectedRoute({
  children,
  redirectTo = "/login",
}: ProtectedRouteProps): JSX.Element {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    // Preserve intended URL for post-login redirect
    return (
      <Navigate to={redirectTo} state={{ from: location.pathname + location.search }} replace />
    );
  }

  // Render children if authenticated
  return <>{children}</>;
}
