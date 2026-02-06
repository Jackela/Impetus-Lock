/**
 * Toast Notification Components
 *
 * Toast notification system for displaying operation results.
 * Supports success, error, and info types with auto-dismiss.
 *
 * @module components/Toast
 *
 * @example
 * ```tsx
 * import { Toast, ToastContainer, useToast } from './components/Toast';
 *
 * function App() {
 *   const { toasts, add, remove } = useToast();
 *
 *   return (
 *     <>
 *       <button onClick={() => add('Success!', 'success')}>
 *         Show Success
 *       </button>
 *       <ToastContainer toasts={toasts} onRemove={remove} />
 *     </>
 *   );
 * }
 * ```
 */

export { Toast, type ToastProps } from "./Toast";
export { ToastContainer, type ToastContainerProps, type ToastItem } from "./ToastContainer";
