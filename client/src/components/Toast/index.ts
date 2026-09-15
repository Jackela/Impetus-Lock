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

/** Re-export of the Toast component and its props type. */
export { Toast, type ToastProps } from "./Toast";
/** Re-export of the ToastContainer component and its related types. */
export { ToastContainer, type ToastContainerProps, type ToastItem } from "./ToastContainer";
