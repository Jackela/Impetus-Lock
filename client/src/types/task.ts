/**
 * Task-related types.
 *
 * This module re-exports task types from the service layer for use in components.
 * Components should import from here rather than directly from services to maintain
 * proper architecture boundaries.
 */

import type { TaskRecord } from "../services/api/taskClient";

export type { TaskRecord };
