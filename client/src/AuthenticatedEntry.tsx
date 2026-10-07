import { useEffect, useMemo, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "./contexts/AuthContext";
import { LockManagerProvider } from "./contexts/LockManagerContext";
import { LoginForm, RegisterForm } from "./components/Auth";
import "./styles/auth-entry.css";

function AccountWorkspace({ children }: { children: ReactNode }) {
  const { remoteEnabled } = useAuth();
  const client = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            retry: (count, error) =>
              error.name !== "AbortError" &&
              !("status" in error && [401, 403].includes(Number(error.status))) &&
              count < 1,
          },
          mutations: { retry: false },
        },
      }),
    []
  );
  useEffect(() => {
    if (!remoteEnabled) void client.cancelQueries();
  }, [client, remoteEnabled]);
  useEffect(
    () => () => {
      void client.cancelQueries();
      client.clear();
    },
    [client]
  );
  return (
    <QueryClientProvider client={client}>
      <LockManagerProvider>{children}</LockManagerProvider>
    </QueryClientProvider>
  );
}

/**
 * Resolve server identity before mounting protected editor work.
 * @param props - Original application subtree
 * @param props.children - Existing editor application
 * @returns A session entry or the account's existing writing workspace
 */
export function AuthenticatedEntry({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [registration, setRegistration] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const forms = registration ? (
    <RegisterForm
      onSwitchToLogin={() => {
        auth.clearError();
        setRegistration(false);
      }}
      onSuccess={() => setShowSignIn(false)}
    />
  ) : (
    <LoginForm
      onSwitchToRegister={() => {
        auth.clearError();
        setRegistration(true);
      }}
      onSuccess={() => setShowSignIn(false)}
    />
  );

  if (!auth.user) {
    return (
      <main className="auth-entry">
        <div className="auth-entry__card">
          <h1>Impetus Lock</h1>
          <p className="auth-entry__intro">
            Sign in to save your writing and recover it when you return.
          </p>
          {auth.status === "checking" ? (
            <p role="status">Checking your session…</p>
          ) : auth.status === "check-error" ? (
            <>
              <p role="alert">{auth.error}</p>
              <button type="button" onClick={() => void auth.recheck().catch(() => {})}>
                Retry session check
              </button>
            </>
          ) : (
            forms
          )}
        </div>
      </main>
    );
  }

  return (
    <AccountWorkspace key={auth.user.id}>
      <div className="account-bar">
        <span>
          Signed in as <strong>{auth.user.email}</strong>
        </span>
        <button
          type="button"
          disabled={auth.isLoading}
          onClick={() => void auth.logout().catch(() => {})}
        >
          Sign out
        </button>
      </div>
      {!auth.remoteEnabled && (
        <section className="session-notice" aria-label="Session status">
          <p
            role={auth.status === "logging-out" || auth.status === "checking" ? "status" : "alert"}
          >
            {auth.status === "expired"
              ? "Session expired. Your draft is kept locally; you can keep writing. Sign in to resume saving."
              : auth.status === "logging-out"
                ? "Signing out… Remote work is paused."
                : auth.status === "checking"
                  ? "Checking your session… Your draft is kept locally."
                  : auth.status === "logout-unconfirmed"
                    ? "Sign out is not confirmed. Your draft is kept locally and remote work is paused."
                    : "The session check failed. Your draft is kept locally and remote work is paused."}
          </p>
          {auth.error && <p className="session-error">{auth.error}</p>}
          {auth.status !== "checking" && auth.status !== "logging-out" && (
            <div className="recovery-actions">
              {auth.status === "logout-unconfirmed" && (
                <button type="button" onClick={() => void auth.logout().catch(() => {})}>
                  Retry sign out
                </button>
              )}
              <button type="button" onClick={() => void auth.recheck().catch(() => {})}>
                Check session again
              </button>
              <button type="button" onClick={() => setShowSignIn((v) => !v)}>
                {showSignIn ? "Close sign in" : "Sign in again"}
              </button>
            </div>
          )}
          {showSignIn && <div className="session-sign-in">{forms}</div>}
        </section>
      )}
      {children}
    </AccountWorkspace>
  );
}
