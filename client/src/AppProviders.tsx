import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthProvider } from "./contexts/AuthContext";
import { AuthenticatedEntry } from "./AuthenticatedEntry";

interface AppProvidersProps {
  children: React.ReactNode;
}

/**
 * Wraps the app in global providers (error boundary, React Query, lock manager).
 *
 * @param root0 - Component props
 * @param root0.children - Application subtree to wrap
 * @returns The provider-wrapped application subtree
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AuthenticatedEntry>{children}</AuthenticatedEntry>
      </AuthProvider>
    </ErrorBoundary>
  );
}
