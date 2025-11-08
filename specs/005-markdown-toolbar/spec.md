# Feature Specification: Markdown Toolbar (P4 - Foundational)

**Feature Branch**: `005-markdown-toolbar`  
**Created**: 2025-11-08  
**Status**: Draft  
**Input**: User description: "项目：P4.ImpetusLock.MarkdownToolbar - 此 P4 规范用于补全\"地基\" (Foundational) 功能。P1-P3 交付了核心 Vibe，但编辑器本身缺乏基本的写作功能。此 P4 任务旨在添加一个最小化的 Markdown 工具栏，使产品真正\"可用\"。"

## User Scenarios & Testing *(mandatory)*

<!--
  PRIORITY CLARIFICATION:
  - P1 priority is RESERVED for un-deletable constraint implementation (P1-P3 features)
  - This is P4 (Foundational) - provides essential usability but is NOT core "Vibe" functionality
  - All user stories in this spec are P2 by default (foundational, but not core constraint)
  - Each formatting feature is independently testable and deliverable
-->

### User Story 1 - Text Formatting (Bold & Italic) (Priority: P2)

**小王** (Xiao Wang), the creative writer, is drafting a novel chapter. He wants to emphasize certain words and phrases using **bold** for strong emphasis (e.g., character names on first mention) and *italic* for thoughts or internal dialogue. Without these basic formatting tools, he cannot properly structure his creative writing and must switch to another tool, losing the benefit of the un-deletable constraint system (P1-P3 features).

**Why this priority**: P2 - This is foundational usability. While not part of the core "Vibe" (un-deletable constraints), it's essential for the editor to be a viable writing environment. Bold and italic are the most frequently used formatting options in creative writing.

**Independent Test**: Can be fully tested by selecting text and clicking Bold/Italic buttons. Delivers immediate value by allowing basic text emphasis without keyboard shortcuts.

**Acceptance Scenarios**:

1. **Given** a text selection in the editor, **When** the user clicks the Bold button in the toolbar, **Then** the selected text becomes bold (**text**) and remains editable
2. **Given** a text selection in the editor, **When** the user clicks the Italic button, **Then** the selected text becomes italic (*text*) and remains editable
3. **Given** bold text, **When** the user selects it and clicks the Bold button again, **Then** the bold formatting is removed (toggle behavior)
4. **Given** italic text, **When** the user selects it and clicks the Italic button again, **Then** the italic formatting is removed (toggle behavior)
5. **Given** no text selection, **When** the user clicks Bold or Italic, **Then** the cursor position activates that formatting for subsequent typing
6. **Given** locked content (P1 feature), **When** the user attempts to format it, **Then** the toolbar buttons respect lock enforcement (consistent with un-deletable constraint behavior)

---

### User Story 2 - Document Structure (Headers) (Priority: P2)

**小王** is outlining a story chapter with multiple scenes. He needs clear visual hierarchy to distinguish scene titles (H1) from sub-scene transitions or section breaks (H2). Without heading support, his long-form writing becomes an unstructured wall of text, making it difficult to navigate and organize his creative work.

**Why this priority**: P2 - Headers provide essential document structure for long-form writing. This is foundational for organizing creative content but not part of core "Vibe" functionality.

**Independent Test**: Can be fully tested by placing cursor on a line and clicking H1/H2 buttons. Delivers value by providing visual hierarchy for document organization.

**Acceptance Scenarios**:

1. **Given** the cursor is on a paragraph, **When** the user clicks the H1 button, **Then** the current line becomes a Heading 1 with appropriate visual styling (larger, bold)
2. **Given** the cursor is on a paragraph, **When** the user clicks the H2 button, **Then** the current line becomes a Heading 2 with appropriate visual styling (medium size, bold)
3. **Given** text is already H1, **When** the user clicks H1 again, **Then** the formatting is removed and the line returns to normal paragraph style
4. **Given** text is H1, **When** the user clicks H2, **Then** the formatting changes from H1 to H2 (replacement behavior)
5. **Given** a heading contains locked content (P1 feature), **When** the user attempts to remove the heading style, **Then** the lock enforcement system prevents modification (consistent with un-deletable constraints)

---

### User Story 3 - Lists for Brainstorming (Priority: P2)

**小王** is brainstorming plot points, character traits, or world-building elements. He needs to create bullet lists to organize ideas quickly during the creative process. Without list support, he must manually type dashes or asterisks, breaking his creative flow and making the editor feel like a primitive text box rather than a modern writing tool.

**Why this priority**: P2 - Lists are essential for brainstorming and organizing non-linear creative content. This is foundational usability but not core "Vibe" functionality.

**Independent Test**: Can be fully tested by clicking the Bullet List button and typing multiple items. Delivers value by enabling rapid idea capture in organized format.

**Acceptance Scenarios**:

1. **Given** the cursor is on a paragraph, **When** the user clicks the Bullet List button, **Then** the current line becomes a bullet list item with a bullet point marker
2. **Given** the cursor is at the end of a list item, **When** the user presses Enter, **Then** a new bullet list item is created on the next line
3. **Given** the cursor is on an empty list item, **When** the user presses Enter, **Then** the list exits and returns to normal paragraph mode
4. **Given** multiple lines are selected, **When** the user clicks the Bullet List button, **Then** all selected lines become individual bullet list items
5. **Given** text is already in a bullet list, **When** the user clicks the Bullet List button again, **Then** the list formatting is removed (toggle behavior)
6. **Given** a list item contains locked content (P1 feature), **When** the user attempts to remove the list formatting, **Then** the lock enforcement system prevents modification (consistent with un-deletable constraints)

---

### User Story 4 - Toolbar Visual Design (Zen Mode Compliance) (Priority: P3)

The toolbar must maintain the minimalist, "Zen Mode" aesthetic established in P1-P3 features. **小王** is sensitive to visual clutter and finds traditional WYSIWYG toolbars (e.g., Microsoft Word, Google Docs) overwhelming and distracting. The toolbar must feel intentional, calm, and aligned with the app's philosophy of focused creativity with disciplined constraints.

**Why this priority**: P3 - Visual polish is important for user experience but less critical than functional formatting capabilities. This can be iterated after core functionality is proven.

**Independent Test**: Can be tested through visual design review and user feedback on aesthetic coherence with existing UI.

**Acceptance Scenarios**:

1. **Given** the toolbar is visible, **When** the user views it, **Then** it uses minimal visual elements (simple icons, no text labels, consistent with app's existing UI)
2. **Given** the toolbar is visible, **When** compared to P1-P3 UI elements, **Then** it uses the same color palette, spacing, and typography scale
3. **Given** the user is not actively formatting text, **When** no text is selected in the editor, **Then** the toolbar is hidden and does not appear on screen
4. **Given** the user selects text, **When** the selection is made, **Then** the toolbar appears as a floating element near the text selection
5. **Given** the user hovers over a toolbar button, **When** hover state is triggered, **Then** visual feedback is subtle and consistent with app's minimalist design language

---

### Edge Cases

- What happens when **the user selects text that spans multiple formatting types** (e.g., partially bold, partially normal)? → Toolbar buttons should reflect "mixed state" visually or apply formatting to entire selection consistently
- What happens when **the user attempts to create nested lists**? → P4 scope is limited to simple bullet lists; nested lists are out of scope
- What happens when **the user applies heading formatting to locked content**? → Lock enforcement system (P1) takes precedence; toolbar must respect existing lock behavior
- What happens when **the user tries to use keyboard shortcuts (Ctrl+B, Ctrl+I) instead of toolbar buttons**? → Keyboard shortcuts should work identically to toolbar clicks (Milkdown's built-in behavior)
- What happens when **the user clicks a toolbar button with no cursor or selection in the editor**? → Not applicable - toolbar is hidden when no text is selected
- What happens when **the user deselects text after the toolbar appears**? → Toolbar should hide/disappear when selection is cleared
- What happens when **the toolbar positioning would be cut off by the viewport edge**? → Toolbar should reposition intelligently to remain fully visible (e.g., flip to other side of selection)
- What happens when **the toolbar is rendered on mobile/small screens**? → Toolbar must be responsive and usable on touch devices (icons large enough for touch targets)

## Requirements *(mandatory)*

### Functional Requirements

**Toolbar Presence & Interaction**:
- **FR-001**: The editor MUST display a toolbar with buttons for Bold, Italic, H1, H2, and Bullet List formatting options
- **FR-002**: Toolbar buttons MUST be accessible via mouse/touch interaction (clicking/tapping)
- **FR-003**: Toolbar MUST use visual icons (not text labels) to maintain minimalist design
- **FR-004**: Toolbar buttons MUST provide visual feedback (hover state, active state) for user interactions

**Bold Formatting**:
- **FR-005**: Users MUST be able to apply bold formatting to selected text by clicking the Bold button
- **FR-006**: Users MUST be able to toggle bold formatting off by clicking the Bold button on already-bold text
- **FR-007**: When no text is selected, clicking the Bold button MUST activate bold formatting for subsequent typing

**Italic Formatting**:
- **FR-008**: Users MUST be able to apply italic formatting to selected text by clicking the Italic button
- **FR-009**: Users MUST be able to toggle italic formatting off by clicking the Italic button on already-italic text
- **FR-010**: When no text is selected, clicking the Italic button MUST activate italic formatting for subsequent typing

**Heading Formatting**:
- **FR-011**: Users MUST be able to convert a paragraph to Heading 1 (H1) by clicking the H1 button
- **FR-012**: Users MUST be able to convert a paragraph to Heading 2 (H2) by clicking the H2 button
- **FR-013**: Clicking the same heading button again MUST remove heading formatting and return to normal paragraph style
- **FR-014**: Headings MUST have distinct visual styling (size, weight) that differs from normal paragraphs

**Bullet List Formatting**:
- **FR-015**: Users MUST be able to convert a paragraph to a bullet list item by clicking the Bullet List button
- **FR-016**: Pressing Enter in a list item MUST create a new list item on the next line
- **FR-017**: Pressing Enter on an empty list item MUST exit the list and return to paragraph mode
- **FR-018**: Selecting multiple paragraphs and clicking the Bullet List button MUST convert all selected paragraphs to list items

**Lock Enforcement Integration**:
- **FR-019**: Toolbar formatting actions MUST respect the lock enforcement system from P1-P3 features
- **FR-020**: Attempting to format locked content MUST trigger the same rejection behavior as deletion attempts (consistent with un-deletable constraint)

**Technical Constraints (Milkdown Integration)**:
- **FR-021**: Toolbar MUST use Milkdown's built-in formatting commands (not custom implementations)
- **FR-022**: Toolbar MUST integrate with Milkdown's ProseMirror state to reflect current formatting of selected text
- **FR-023**: Toolbar button states (active/inactive) MUST update dynamically based on cursor position and selection

**Visual Design (Constitution Article I: Simplicity)**:
- **FR-024**: Toolbar MUST use the same color palette as existing UI components from P1-P3 features
- **FR-025**: Toolbar MUST use minimal visual elements (simple icons, consistent spacing, no decorative elements)
- **FR-026**: Toolbar MUST appear as a floating element positioned near the text selection when text is selected
- **FR-026a**: Toolbar MUST be hidden when no text is selected in the editor (context-sensitive visibility)

**Accessibility & Responsiveness**:
- **FR-027**: Toolbar buttons MUST be large enough for touch targets on mobile devices (minimum 44x44px)
- **FR-028**: Toolbar MUST provide ARIA labels for screen readers (no visible tooltips to maintain visual minimalism)

### Key Entities *(this feature involves UI state, not persistent data entities)*

- **Toolbar State**: Represents the current active/inactive state of each formatting button based on cursor position or selection
- **Formatting Command**: Represents a user-initiated action (Bold, Italic, H1, H2, Bullet List) that modifies editor content through Milkdown's command system

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can apply bold, italic, heading, or list formatting to text in under 2 seconds from text selection to formatting applied
- **SC-002**: 90% of users successfully format text on first attempt without errors or confusion
- **SC-003**: Users report the toolbar as "unobtrusive" and "consistent with the app's minimalist design" in qualitative feedback (subjective, post-launch survey)
- **SC-004**: Toolbar buttons correctly reflect current formatting state (active when text is bold, inactive when not) 100% of the time based on cursor position
- **SC-005**: The toolbar does not introduce performance degradation (editor remains responsive with <100ms delay from button click to formatting applied)
- **SC-006**: Zero conflicts between toolbar formatting actions and P1-P3 lock enforcement system (locked content remains locked after formatting attempts)

## Assumptions *(documenting reasonable defaults)*

1. **Toolbar Visibility**: Context-sensitive - toolbar appears only when text is selected, positioned near the selection as a floating element. This maximizes minimalism and content focus (Zen mode compliance). *(Resolved: Q1 Answer C)*
2. **Keyboard Shortcuts**: Assuming Milkdown's built-in keyboard shortcuts (Ctrl+B, Ctrl+I, etc.) continue to work and are not replaced/disabled by toolbar implementation
3. **Nested Lists**: Out of scope for P4. Only simple single-level bullet lists are supported
4. **Numbered Lists**: Out of scope for P4. Only bullet lists (unordered) are supported in this phase
5. **Tooltips**: ARIA labels only (no visible tooltips) to maintain cleanest visual experience. Relies on icon clarity for sighted users while remaining accessible for screen readers. *(Resolved: Q3 Answer B)*
6. **Mobile Experience**: Toolbar must be responsive, but specific mobile-optimized interactions (e.g., swipe gestures, bottom sheet toolbar) are out of scope unless usability testing shows critical issues

## Dependencies

- **P1-P3 Features**: Lock enforcement system must be fully functional for FR-019 and FR-020
- **Milkdown Framework**: Relies on Milkdown's built-in formatting commands and ProseMirror state management
- **Existing UI Components**: Must use the same design system (colors, spacing, typography) as P1-P3 features

## Out of Scope

- **Advanced Formatting**: Strikethrough, underline, code blocks, blockquotes (future phases)
- **Numbered Lists**: Only bullet lists in P4
- **Nested Lists**: Multi-level list indentation (future phase)
- **Text Alignment**: Left/center/right alignment (not requested in user story)
- **Font Size/Family**: Custom typography controls (conflicts with minimalist design constraint)
- **Color/Highlight**: Text color or background color formatting (conflicts with Zen mode aesthetic)
- **Undo/Redo Buttons**: Assuming Milkdown's built-in undo/redo (Ctrl+Z, Ctrl+Y) is sufficient
- **Markdown Syntax Toggle**: Showing/hiding raw Markdown vs. WYSIWYG view (not in user story)
