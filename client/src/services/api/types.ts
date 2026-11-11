/**
 * Style Learning API Types
 *
 * The interfaces live in the neutral `types/style` module so components and
 * services share one definition without a component→service import. This file
 * remains the services-layer entry point for existing imports.
 *
 * @module services/api/types
 */

/**
 * Re-exports the neutral style interfaces for services-layer consumers.
 */
export type { StyleApplyResponse, StyleAnalysisResponse, StyleVector } from "../../types/style";
