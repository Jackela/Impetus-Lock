/**
 * Error Boundary Component
 *
 * React error boundary for catching component errors.
 * Provides fallback UI and error logging capabilities.
 *
 * @module components/ErrorBoundary
 *
 * @example
 * ```tsx
 * import { ErrorBoundary } from './components/ErrorBoundary';
 *
 * function App() {
 *   return (
 *     <ErrorBoundary
 *       fallback={<div>Something went wrong</div>}
 *       onError={(error) => console.error(error)}
 *     >
 *       <YourComponent />
 *     </ErrorBoundary>
 *   );
 * }
 * ```
 */

export { ErrorBoundary } from "./ErrorBoundary";
export type { ErrorBoundaryProps } from "./ErrorBoundary";
