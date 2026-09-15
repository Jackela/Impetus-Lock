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

/** Re-export of the ErrorBoundary component. */
export { ErrorBoundary } from "./ErrorBoundary";
/** Re-export of the ErrorBoundaryProps type. */
export type { ErrorBoundaryProps } from "./ErrorBoundary";
