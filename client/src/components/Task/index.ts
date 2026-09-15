/**
 * Task Components Barrel Export
 *
 * Centralized exports for all task-related components.
 *
 * @module components/Task
 *
 * @example
 * ```tsx
 * import { TaskList, TaskItem, NewTaskButton } from "./components/Task";
 * ```
 */

/** Re-export of the TaskList component. */
export { TaskList } from "./TaskList";
/** Re-export of the TaskItem component. */
export { TaskItem } from "./TaskItem";
/** Re-export of the NewTaskButton component. */
export { NewTaskButton } from "./NewTaskButton";

// Sprint 2: Enhanced Task Management Components
/** Re-export of the CategorySelector component. */
export { CategorySelector } from "./CategorySelector";
/** Re-export of the PrioritySelector component. */
export { PrioritySelector } from "./PrioritySelector";
/** Re-export of the DueDatePicker component. */
export { DueDatePicker } from "./DueDatePicker";
/** Re-export of the TemplateGallery and TemplateFilterTabs components. */
export { TemplateGallery, TemplateFilterTabs } from "./TemplateGallery";
