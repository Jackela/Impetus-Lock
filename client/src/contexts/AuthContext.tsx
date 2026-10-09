/**
 * Authentication Context for React
 *
 * Provides global auth state and methods for login, logout, and registration.
 * Uses HttpOnly cookies for token storage (handled by browser).
 *
 * @module contexts/AuthContext
 */

import { cookieAuthOptions } from "../services/api/cookieAuth";
import type { RemoteSession } from "../services/api/remoteSession";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/** User data returned from API */
export interface User {
  id: string;
  email: string;
}

/** Authentication context type */
export interface AuthContextType {
  /** Last server-confirmed account, retained while local writing is paused. */
  user: User | null;
  /** Whether a session check or authentication operation is waiting. */
  isLoading: boolean;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Server-confirmed authentication state, distinct from operation loading. */
  status:
    | "checking"
    | "authenticated"
    | "anonymous"
    | "check-error"
    | "expired"
    | "logging-out"
    | "logout-unconfirmed";
  /** The lifetime of currently authorized remote work. */
  session: RemoteSession | null;
  /** Whether protected requests may start. */
  remoteEnabled: boolean;
  /** Current account authorization lifetime. */
  generation: number;
  /** Save current writing synchronously before authorization is paused or replaced. */
  registerSnapshot: (callback: () => void) => () => void;
  /** Confirm the current account again with the server. */
  recheck: () => Promise<void>;
  /** Login with email and password */
  login: (email: string, password: string) => Promise<void>;
  /** Register new user */
  register: (email: string, password: string) => Promise<void>;
  /** Logout current user */
  logout: () => Promise<void>;
  /** Error message from last auth operation */
  error: string | null;
  /** Clear error message */
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Props for AuthProvider */
interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Authentication provider component.
 *
 * Wraps application with auth state and provides auth methods.
 *
 * @param root0 - Provider props
 * @param root0.children - Application subtree receiving auth context
 * @returns The auth context provider wrapping children
 *
 * @example
 * ```tsx
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 * ```
 */
export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const userRef = useRef<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthContextType["status"]>("checking");
  const [session, setSession] = useState<RemoteSession | null>(null);
  const sessionRef = useRef<RemoteSession | null>(null);
  const sessionController = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const snapshots = useRef(new Set<() => void>());
  const activeOperation = useRef<{
    kind: "check" | "login" | "register" | "logout";
    controller: AbortController;
    promise: Promise<void> | null;
  } | null>(null);
  const startOperation = useCallback((kind: "check" | "login" | "register" | "logout") => {
    activeOperation.current?.controller.abort();
    const operation = {
      kind,
      controller: new AbortController(),
      promise: null as Promise<void> | null,
    };
    activeOperation.current = operation;
    setIsLoading(true);
    return operation;
  }, []);
  const cancelOperation = useCallback((): void => {
    activeOperation.current?.controller.abort();
    activeOperation.current = null;
    setIsLoading(false);
  }, []);

  const registerSnapshot = useCallback((callback: () => void): (() => void) => {
    snapshots.current.add(callback);
    return () => {
      snapshots.current.delete(callback);
    };
  }, []);

  const pause = useCallback((): Error | null => {
    let snapshotError: Error | null = null;
    for (const snapshot of snapshots.current) {
      try {
        snapshot();
      } catch {
        snapshotError ??= new Error("Your local draft could not be saved. Remote work is paused.");
      }
    }
    sessionRef.current = null;
    sessionController.current?.abort();
    sessionController.current = null;
    setSession(null);
    ++generationRef.current;
    return snapshotError;
  }, []);

  const authorize = useCallback(
    (data: unknown): void => {
      if (
        !data ||
        typeof data !== "object" ||
        !("id" in data) ||
        typeof data.id !== "string" ||
        !data.id.trim() ||
        !("email" in data) ||
        typeof data.email !== "string"
      ) {
        throw new Error("The server did not confirm an account. Please retry.");
      }
      const nextUser: User = { id: data.id, email: data.email };
      if (userRef.current) {
        const snapshotError = pause();
        if (snapshotError) throw snapshotError;
      }
      const controller = new AbortController();
      const nextSession: RemoteSession = {
        userId: nextUser.id,
        generation: ++generationRef.current,
        signal: controller.signal,
        isCurrent: () => sessionRef.current === nextSession && !controller.signal.aborted,
        onUnauthorized: () => {
          if (!nextSession.isCurrent()) return;
          const snapshotError = pause();
          cancelOperation();
          setError(snapshotError?.message ?? null);
          setStatus("expired");
        },
      };
      sessionController.current = controller;
      sessionRef.current = nextSession;
      setSession(nextSession);
      userRef.current = nextUser;
      setUser(nextUser);
      setStatus("authenticated");
    },
    [cancelOperation, pause]
  );

  const recheck = useCallback((): Promise<void> => {
    if (activeOperation.current?.kind === "check" && activeOperation.current.promise)
      return activeOperation.current.promise;
    const snapshotError = pause();
    cancelOperation();
    setError(snapshotError?.message ?? null);
    setStatus("checking");
    if (snapshotError) {
      setStatus("check-error");
      return Promise.resolve();
    }
    const operation = startOperation("check");
    const current = (): boolean => activeOperation.current === operation;
    operation.promise = (async (): Promise<void> => {
      try {
        const response = await fetch(
          `${API_URL}/auth/me`,
          cookieAuthOptions({ signal: operation.controller.signal })
        );
        if (!current()) return;
        if (response.ok) {
          const nextUser = await response.json();
          if (current()) authorize(nextUser);
        } else if (response.status === 401) {
          userRef.current = null;
          setUser(null);
          setStatus("anonymous");
        } else {
          throw new Error(`Unable to check your session (HTTP ${response.status}). Please retry.`);
        }
      } catch (err) {
        if (current()) {
          setError(
            err instanceof Error ? err.message : "Unable to check your session. Please retry."
          );
          setStatus("check-error");
        }
      } finally {
        if (current()) {
          activeOperation.current = null;
          setIsLoading(false);
        }
      }
    })();
    return operation.promise;
  }, [authorize, cancelOperation, pause, startOperation]);

  useEffect(() => {
    void recheck();
    return () => {
      sessionRef.current = null;
      sessionController.current?.abort();
      activeOperation.current?.controller.abort();
      activeOperation.current = null;
    };
  }, [recheck]);

  const submit = useCallback(
    (action: "login" | "register", email: string, password: string): Promise<void> => {
      if (activeOperation.current?.kind === action && activeOperation.current.promise)
        return activeOperation.current.promise;
      const wasAuthenticated = sessionRef.current !== null;
      if (wasAuthenticated) {
        const snapshotError = pause();
        cancelOperation();
        setStatus("checking");
        if (snapshotError) {
          setError(snapshotError.message);
          setStatus("check-error");
          return Promise.reject(snapshotError);
        }
      }
      setError(null);
      const operation = startOperation(action);
      const current = (): boolean => activeOperation.current === operation;
      operation.promise = (async (): Promise<void> => {
        try {
          const response = await fetch(
            `${API_URL}/auth/${action}`,
            cookieAuthOptions({
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password }),
              signal: operation.controller.signal,
            })
          );
          const data: unknown = await response.json().catch(() => null);
          if (!current())
            throw new DOMException("Authentication operation was superseded", "AbortError");
          if (!response.ok) {
            const detail =
              data &&
              typeof data === "object" &&
              "detail" in data &&
              typeof data.detail === "string"
                ? data.detail
                : null;
            throw new Error(
              detail ||
                `${action === "login" ? "Login" : "Registration"} failed (HTTP ${response.status}). Please retry.`
            );
          }
          authorize(data && typeof data === "object" && "user" in data ? data.user : null);
        } catch (err) {
          if (!current())
            throw new DOMException("Authentication operation was superseded", "AbortError");
          setError(err instanceof Error ? err.message : "Authentication failed");
          if (wasAuthenticated) setStatus("check-error");
          throw err;
        } finally {
          if (current()) {
            activeOperation.current = null;
            setIsLoading(false);
          }
        }
      })();
      return operation.promise;
    },
    [authorize, cancelOperation, pause, startOperation]
  );

  const login = useCallback(
    (email: string, password: string): Promise<void> => submit("login", email, password),
    [submit]
  );
  const register = useCallback(
    (email: string, password: string): Promise<void> => submit("register", email, password),
    [submit]
  );

  const logout = useCallback((): Promise<void> => {
    if (activeOperation.current?.kind === "logout" && activeOperation.current.promise)
      return activeOperation.current.promise;
    const snapshotError = pause();
    cancelOperation();
    setError(snapshotError?.message ?? null);
    setStatus("logging-out");
    if (snapshotError) {
      setStatus("logout-unconfirmed");
      return Promise.reject(snapshotError);
    }
    const operation = startOperation("logout");
    const current = (): boolean => activeOperation.current === operation;
    operation.promise = (async (): Promise<void> => {
      try {
        const response = await fetch(
          `${API_URL}/auth/logout`,
          cookieAuthOptions({ method: "POST", signal: operation.controller.signal })
        );
        if (!current()) return;
        if (response.status !== 204)
          throw new Error(
            `Logout has not been confirmed (HTTP ${response.status}). Please retry or check your session.`
          );
        userRef.current = null;
        setUser(null);
        setStatus("anonymous");
      } catch (err) {
        if (!current()) return;
        setError(
          err instanceof Error
            ? err.message
            : "Logout has not been confirmed. Please retry or check your session."
        );
        setStatus("logout-unconfirmed");
        throw err;
      } finally {
        if (current()) {
          activeOperation.current = null;
          setIsLoading(false);
        }
      }
    })();
    return operation.promise;
  }, [cancelOperation, pause, startOperation]);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: status === "authenticated",
    status,
    session,
    remoteEnabled: status === "authenticated",
    generation: generationRef.current,
    registerSnapshot,
    recheck,
    login,
    register,
    logout,
    error,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access authentication context.
 *
 * @returns Authentication context with user, login, logout, register
 * @throws Error if used outside AuthProvider
 *
 * @example
 * ```tsx
 * function LoginButton() {
 *   const { login, isLoading } = useAuth();
 *   return <button onClick={() => login(email, password)}>Login</button>;
 * }
 * ```
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * Read authentication when a provider is present, for independently usable hooks.
 *
 * @returns The authentication context, or undefined outside AuthProvider
 */
export function useOptionalAuth(): AuthContextType | undefined {
  return useContext(AuthContext);
}
