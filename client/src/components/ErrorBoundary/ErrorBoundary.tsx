import { Component, ReactNode } from "react";
import "./ErrorBoundary.css";

/**
 * Props for the ErrorBoundary component.
 */
export interface ErrorBoundaryProps {
  /** Child components to be wrapped by the error boundary */
  children: ReactNode;
  /** Custom fallback UI to render when an error occurs */
  fallback?: ReactNode;
  /** Custom error handler callback */
  onError?: (error: Error, errorInfo: { componentStack: string }) => void;
}

/**
 * State for the ErrorBoundary component.
 */
interface ErrorBoundaryState {
  /** Whether an error has been caught */
  hasError: boolean;
  /** The error that was caught */
  error: Error | null;
}

/**
 * ErrorBoundary component - React error boundary for catching component errors.
 *
 * This class component implements React's error boundary API to catch
 * JavaScript errors anywhere in the child component tree, log those errors,
 * and display a fallback UI instead of the crashed component tree.
 *
 * @example
 * ```tsx
 * <ErrorBoundary
 *   fallback={<div>Something went wrong</div>}
 *   onError={(error, errorInfo) => console.error(error)}>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: { componentStack: string }): void {
    // Log the error to an error reporting service
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="error-boundary" role="alert" aria-live="assertive">
          <div className="error-boundary-content">
            <h2 className="error-boundary-title">Something went wrong</h2>
            <p className="error-boundary-message">
              An unexpected error occurred. Please refresh the page to try again.
            </p>
            {this.state.error && (
              <details className="error-boundary-details">
                <summary className="error-boundary-summary">Error details</summary>
                <pre className="error-boundary-stack">{this.state.error.toString()}</pre>
              </details>
            )}
            <button type="button" className="error-boundary-reset" onClick={this.handleReset}>
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
