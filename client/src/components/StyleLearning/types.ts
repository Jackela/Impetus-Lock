/* eslint-disable no-restricted-imports -- Type-only barrel: re-exports already-declared service interfaces (no runtime access). */
/**
 * Style Learning Types
 *
 * Type re-exports for the Style Learning feature.
 * The single source of truth for these interfaces lives in the services layer
 * (`services/api/types`); this module only re-exports them so components can
 * keep a feature-local import path without duplicating the definitions.
 *
 * @module components/StyleLearning/types
 */

/**
 * Re-export of the Style Learning API interfaces owned by `services/api/types`.
 */
export type {
  StyleApplyResponse,
  StyleAnalysisResponse,
  StyleVector,
} from "../../services/api/types";
