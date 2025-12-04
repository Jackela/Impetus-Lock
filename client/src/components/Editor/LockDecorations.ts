/**
 * Lock Content Decorations
 *
 * ProseMirror view plugin that applies visual styling to locked content blocks.
 * Decorations are presentation-only (no schema changes required).
 *
 * **Design Pattern**:
 * - Scans document for lock IDs using extractLockId utility
 * - Applies `.locked-content` CSS class to nodes containing locks
 * - Decorations update automatically on document changes
 *
 * **Integration**: Applied directly to EditorView via `view.setProps()`
 *
 * @see specs/chrome-audit-polish/design.md#2-locked-content-styling
 */

import { Decoration, DecorationSet } from "@milkdown/prose/view";
import type { EditorView } from "@milkdown/prose/view";
import type { Node } from "@milkdown/prose/model";
import { Plugin, PluginKey } from "@milkdown/prose/state";
import { extractLockAttributes } from "../../utils/prosemirror-helpers";
import type { LockManager } from "../../services/LockManager";

/**
 * Plugin key for lock decorations.
 * Used to access plugin state and identify the plugin instance.
 */
export const lockDecorationsKey = new PluginKey("lockDecorations");

/**
 * Create decoration set for all locked content blocks in document.
 *
 * Traverses document tree and applies decorations to nodes containing
 * lock IDs (embedded as HTML comments: `<!-- lock:lock_id -->`).
 *
 * @param doc - ProseMirror document node to scan
 * @param lockManager - LockManager instance for metadata lookup
 * @returns DecorationSet with node decorations for locked content
 *
 * @example
 * ```typescript
 * // Document with locked blockquote:
 * // > AI-generated provocation <!-- lock:lock_001 -->
 * const decos = createLockDecorations(doc, lockManager);
 * // Returns decoration with class="locked-content" data-lock-id="lock_001"
 * ```
 */
function createLockDecorations(doc: Node, lockManager: LockManager): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    const metadata = extractLockAttributes(node, lockManager);
    if (!metadata?.lockId) {
      return;
    }

    const lockInfo = lockManager.getLockMetadata(metadata.lockId);
    const source =
      metadata.source ?? lockInfo?.source ?? lockManager.getLockSource(metadata.lockId);

    if (lockInfo?.shape === "block" || node.type.name === "blockquote") {
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          class: `locked-content${source ? ` source-${source}` : ""}`,
          "data-lock-id": metadata.lockId,
          "data-lock-shape": "block",
          role: "note",
          "aria-label": "AI-added content (locked)",
          ...(source ? { "data-source": source } : {}),
        })
      );
      return false;
    }

    const attrs: Record<string, string> = {
      class: `locked-content${source ? ` source-${source}` : ""}`,
      "data-lock-id": metadata.lockId,
      "data-lock-shape": "inline",
      role: "note",
      "aria-label": "AI-added content (locked)",
      ...(source ? { "data-source": source } : {}),
    };

    if (metadata.contentLength !== undefined) {
      const from = pos + 1;
      const to = from + metadata.contentLength;
      decorations.push(Decoration.inline(from, to, attrs));
      // Hide the trailing HTML comment used for persistence so users don't see it
      if (metadata.commentRange) {
        const commentFrom = from + metadata.commentRange.from;
        const commentTo = from + metadata.commentRange.to;
        decorations.push(
          Decoration.inline(commentFrom, commentTo, {
            class: "locked-comment-hidden",
            "data-lock-id": metadata.lockId,
          })
        );
      }
      return;
    }

    if (node.isText || node.isInline) {
      decorations.push(Decoration.inline(pos, pos + node.nodeSize, attrs));
    }
  });

  return DecorationSet.create(doc, decorations);
}

/**
 * ProseMirror view plugin that manages lock content decorations.
 *
 * Automatically updates decorations when document changes, ensuring
 * locked content blocks always have visual styling applied.
 *
 * **State Management**:
 * - On init: Scan full document for lock IDs
 * - On transaction: Update decorations if document changed
 *
 * **Performance**: Only rescans on document changes (not selection changes)
 *
 * @param lockManager - LockManager instance for metadata lookup
 * @returns ProseMirror Plugin instance
 *
 * @example
 * ```typescript
 * // Apply to EditorView (in EditorCore.tsx):
 * editor.action((ctx) => {
 *   const view = ctx.get(editorViewCtx);
 *   const lockPlugin = createLockDecorationsPlugin(lockManager);
 *   // ... add to view plugins
 * });
 * ```
 */
export function createLockDecorationsPlugin(lockManager: LockManager): Plugin {
  return new Plugin({
    key: lockDecorationsKey,

    state: {
      // Initialize decorations on editor load
      init(_, { doc }) {
        return createLockDecorations(doc, lockManager);
      },

      // Update decorations on document changes
      apply(tr, oldDecorations) {
        const refreshMeta = tr.getMeta(lockDecorationsKey);
        if (refreshMeta?.refresh) {
          return createLockDecorations(tr.doc, lockManager);
        }

        if (tr.docChanged) {
          // Document changed - rescan for lock IDs
          return createLockDecorations(tr.doc, lockManager);
        }

        // No document changes - map existing decorations to new positions
        return oldDecorations.map(tr.mapping, tr.doc);
      },
    },

    props: {
      // Apply decorations to editor view
      decorations(state) {
        return this.getState(state);
      },
    },
  });
}

/**
 * Track which EditorView instances have had the plugin installed.
 *
 * CRITICAL: This prevents the race condition where multiple parallel
 * applyLockDecorations() calls check existingPlugins at nearly the same time,
 * both see "no plugin found", and both try to add the plugin.
 */
const lockDecorationsInstalled = new WeakSet<EditorView>();

/**
 * Apply lock decorations plugin to existing EditorView.
 *
 * Helper function for integrating lock decorations into Milkdown editor.
 * Can be called after editor initialization in EditorCore.
 *
 * **Race Condition Prevention**:
 * Uses module-level guard flag to prevent multiple concurrent installations
 * when useEffect runs multiple times due to unstable dependencies.
 *
 * @param view - ProseMirror EditorView instance
 * @param lockManager - LockManager instance for metadata lookup
 *
 * @example
 * ```typescript
 * // In EditorCore.tsx, after editor initialization:
 * editor.action((ctx) => {
 *   const view = ctx.get(editorViewCtx);
 *   applyLockDecorations(view, lockManager);
 * });
 * ```
 */
export function applyLockDecorations(view: EditorView, lockManager: LockManager): void {
  // CRITICAL: Guard flag prevents race condition from multiple parallel calls
  if (lockDecorationsInstalled.has(view)) {
    return;
  }

  const existingPlugins = view.state.plugins;

  // Check if lock decorations plugin already exists in editor state
  const hasLockPlugin = existingPlugins.some((plugin) => plugin.spec.key === lockDecorationsKey);

  if (hasLockPlugin) {
    // Plugin already in editor state, mark as installed
    lockDecorationsInstalled.add(view);
    return;
  }

  // Set guard flag IMMEDIATELY to block concurrent calls for this view
  lockDecorationsInstalled.add(view);

  const lockPlugin = createLockDecorationsPlugin(lockManager);

  // Add lock decorations plugin to editor state
  view.updateState(
    view.state.reconfigure({
      plugins: [...existingPlugins, lockPlugin],
    })
  );
}

/**
 * Force a refresh of lock decorations without mutating the document.
 */
export function refreshLockDecorations(view: EditorView): void {
  const tr = view.state.tr.setMeta(lockDecorationsKey, { refresh: true });
  view.dispatch(tr);
}
