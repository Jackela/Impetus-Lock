/**
 * Placeholder Plugin for Milkdown Editor
 *
 * Shows placeholder text when editor is empty.
 * Placeholder disappears when user starts typing.
 *
 * @module components/Editor/PlaceholderPlugin
 */

import { $prose } from "@milkdown/utils";
import { Plugin, PluginKey } from "@milkdown/prose/state";
import { Decoration, DecorationSet } from "@milkdown/prose/view";

export const placeholderPluginKey = new PluginKey("placeholder");

/**
 * Create placeholder plugin for Milkdown editor.
 *
 * Displays placeholder text ("Start writing...") when document is empty.
 * Uses ProseMirror decoration system for performance.
 *
 * @returns Milkdown $prose plugin
 *
 * @example
 * ```typescript
 * // In EditorCore.tsx:
 * const { get } = useEditor((root) => {
 *   return Editor.make()
 *     .use(commonmark)
 *     .use(placeholder); // Add placeholder plugin
 * });
 * ```
 */
export const placeholder = $prose(() => {
  return () => [
    new Plugin({
      key: placeholderPluginKey,
      props: {
        decorations(state) {
          const doc = state.doc;

          // Only show placeholder if document is empty
          // ProseMirror doc structure: 0 [content] docSize
          // Empty doc has size 2 (start + end boundaries)
          if (doc.content.size > 2) {
            return DecorationSet.empty;
          }

          // Check if first child is empty paragraph
          const firstChild = doc.firstChild;
          if (!firstChild || firstChild.content.size > 0) {
            return DecorationSet.empty;
          }

          // Add placeholder decoration at position 1 (after doc start boundary)
          const decoration = Decoration.widget(1, () => {
            const span = document.createElement("span");
            span.className = "placeholder";
            span.textContent = "Start writing...";
            span.style.cssText = `
              color: #6b7280;
              pointer-events: none;
              position: absolute;
              user-select: none;
              font-style: italic;
            `;
            return span;
          });

          return DecorationSet.create(doc, [decoration]);
        },
      },
    }),
  ];
});
