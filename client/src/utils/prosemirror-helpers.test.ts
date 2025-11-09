/**
 * ProseMirror Helper Utilities Tests
 *
 * Test suite for hasMark and getHeadingLevel helper functions.
 * Following TDD Red-Green-Refactor workflow.
 */

import { describe, it, expect } from "vitest";
import { hasMark, getHeadingLevel, isInBulletList } from "./prosemirror-helpers";
import { EditorState, TextSelection } from "@milkdown/prose/state";
import { MarkType, Schema } from "@milkdown/prose/model";

// Create a basic schema for testing
const basicSchema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block" },
    heading: {
      attrs: { level: { default: 1 } },
      content: "inline*",
      group: "block",
    },
    bullet_list: {
      content: "list_item+",
      group: "block",
    },
    list_item: {
      content: "paragraph block*",
    },
    text: { group: "inline" },
  },
  marks: {
    strong: {},
    em: {},
  },
});

describe("hasMark", () => {
  it("should return false when markType is null or undefined", () => {
    const state = EditorState.create({ schema: basicSchema });
    expect(hasMark(state, null as unknown as MarkType)).toBe(false);
    expect(hasMark(state, undefined as unknown as MarkType)).toBe(false);
  });

  it("should return false when mark is not active in empty selection (cursor position)", () => {
    const state = EditorState.create({
      schema: basicSchema,
      doc: basicSchema.node("doc", null, [
        basicSchema.node("paragraph", null, [basicSchema.text("Hello world")]),
      ]),
    });

    const strongType = basicSchema.marks.strong;
    expect(hasMark(state, strongType)).toBe(false);
  });

  it("should return true when mark is active in empty selection (cursor within marked text)", () => {
    // Create state with cursor inside bold text
    const boldText = basicSchema.text("Bold", [basicSchema.marks.strong.create()]);
    const doc = basicSchema.node("doc", null, [
      basicSchema.node("paragraph", null, [boldText, basicSchema.text(" normal")]),
    ]);
    const state = EditorState.create({
      schema: basicSchema,
      doc,
      selection: TextSelection.create(doc, 2), // Cursor at position 2 (inside "Bold")
    });

    const strongType = basicSchema.marks.strong;
    expect(hasMark(state, strongType)).toBe(true);
  });

  it("should return false when mark is not active in text selection", () => {
    const doc = basicSchema.node("doc", null, [
      basicSchema.node("paragraph", null, [basicSchema.text("Normal text")]),
    ]);
    const state = EditorState.create({
      schema: basicSchema,
      doc,
      selection: TextSelection.create(doc, 1, 7), // Select "Normal"
    });

    const strongType = basicSchema.marks.strong;
    expect(hasMark(state, strongType)).toBe(false);
  });

  it("should return true when mark is active across entire text selection", () => {
    const boldText = basicSchema.text("Bold text", [basicSchema.marks.strong.create()]);
    const doc = basicSchema.node("doc", null, [basicSchema.node("paragraph", null, [boldText])]);
    const state = EditorState.create({
      schema: basicSchema,
      doc,
      selection: TextSelection.create(doc, 1, 10), // Select all "Bold text"
    });

    const strongType = basicSchema.marks.strong;
    expect(hasMark(state, strongType)).toBe(true);
  });
});

describe("getHeadingLevel", () => {
  it("should return null when selection is not inside a heading", () => {
    const state = EditorState.create({
      schema: basicSchema,
      doc: basicSchema.node("doc", null, [
        basicSchema.node("paragraph", null, [basicSchema.text("Normal paragraph")]),
      ]),
    });

    expect(getHeadingLevel(state)).toBe(null);
  });

  it("should return 1 when selection is inside H1 heading", () => {
    const doc = basicSchema.node("doc", null, [
      basicSchema.node("heading", { level: 1 }, [basicSchema.text("Heading 1")]),
    ]);
    const state = EditorState.create({
      schema: basicSchema,
      doc,
      selection: TextSelection.create(doc, 1), // Cursor inside heading
    });

    expect(getHeadingLevel(state)).toBe(1);
  });

  it("should return 2 when selection is inside H2 heading", () => {
    const doc = basicSchema.node("doc", null, [
      basicSchema.node("heading", { level: 2 }, [basicSchema.text("Heading 2")]),
    ]);
    const state = EditorState.create({
      schema: basicSchema,
      doc,
      selection: TextSelection.create(doc, 1), // Cursor inside heading
    });

    expect(getHeadingLevel(state)).toBe(2);
  });

  it("should return correct level for H3-H6 headings", () => {
    for (let level = 3; level <= 6; level++) {
      const doc = basicSchema.node("doc", null, [
        basicSchema.node("heading", { level }, [basicSchema.text(`Heading ${level}`)]),
      ]);
      const state = EditorState.create({
        schema: basicSchema,
        doc,
        selection: TextSelection.create(doc, 1),
      });

      expect(getHeadingLevel(state)).toBe(level);
    }
  });
});

describe("isInBulletList", () => {
  it("should return false when selection is not inside a list", () => {
    const state = EditorState.create({
      schema: basicSchema,
      doc: basicSchema.node("doc", null, [
        basicSchema.node("paragraph", null, [basicSchema.text("Normal paragraph")]),
      ]),
    });

    expect(isInBulletList(state)).toBe(false);
  });

  it("should return true when cursor is inside a bullet list item", () => {
    const doc = basicSchema.node("doc", null, [
      basicSchema.node("bullet_list", null, [
        basicSchema.node("list_item", null, [
          basicSchema.node("paragraph", null, [basicSchema.text("List item 1")]),
        ]),
      ]),
    ]);
    const state = EditorState.create({
      schema: basicSchema,
      doc,
      selection: TextSelection.create(doc, 3), // Cursor inside list item
    });

    expect(isInBulletList(state)).toBe(true);
  });

  it("should return true when text is selected inside a bullet list", () => {
    const doc = basicSchema.node("doc", null, [
      basicSchema.node("bullet_list", null, [
        basicSchema.node("list_item", null, [
          basicSchema.node("paragraph", null, [basicSchema.text("List item 1")]),
        ]),
      ]),
    ]);
    const state = EditorState.create({
      schema: basicSchema,
      doc,
      selection: TextSelection.create(doc, 3, 8), // Select "List "
    });

    expect(isInBulletList(state)).toBe(true);
  });
});
