/**
 * Editor module exports.
 *
 * Centralized exports for all editor components and utilities.
 */

/** Re-export of the EditorCore component. */
export { EditorCore } from "./EditorCore";
/** Re-export of the lock transaction filter helpers. */
export {
  createLockTransactionFilter,
  isPositionLocked,
  markNodeAsLocked,
} from "./TransactionFilter";
/** Re-export of the undo/history bypass helpers. */
export {
  deleteWithoutUndo,
  insertWithoutUndo,
  isAIAction,
  configureHistoryBypass,
} from "./UndoBypass";
