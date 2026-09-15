import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LockManagerProvider } from "./contexts/LockManagerContext";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

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
      <QueryClientProvider client={queryClient}>
        <LockManagerProvider>{children}</LockManagerProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
