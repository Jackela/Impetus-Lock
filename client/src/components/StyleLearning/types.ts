/**
 * Style Learning Types
 *
 * Type definitions for the Style Learning feature.
 * Re-exported from services layer to avoid direct service imports in components.
 *
 * @module components/StyleLearning/types
 */

/**
 * Style vector representing analyzed writing style characteristics.
 */
export interface StyleVector {
  /** Average sentence length in words */
  avg_sentence_length?: number;
  /** Vocabulary richness (unique words / total words) */
  vocab_richness?: number;
  /** Punctuation density (punctuation marks / total characters) */
  punctuation_density?: number;
  /** Average paragraph length in sentences */
  paragraph_length_avg?: number;
  /** Ratio of dialogue to narrative text */
  dialogue_ratio?: number;
  /** Text complexity level (0-1) */
  complexity?: number;
  /** Emotional intensity (0-1) */
  emotion?: number;
  /** Formality level (0-1) */
  formality?: number;
  /** Descriptiveness level (0-1) */
  descriptiveness?: number;
  /** Writing rhythm score (0-1) */
  rhythm?: number;
  /** Allow additional numeric properties */
  [key: string]: number | undefined;
}

/**
 * Response from style analysis endpoint.
 */
export interface StyleAnalysisResponse {
  /** User identifier for the analyzed style */
  user_id: string;
  /** Analyzed style vector */
  style_vector: StyleVector;
  /** Confidence score of the analysis (0-1) */
  confidence: number;
  /** ISO timestamp of analysis */
  analyzed_at: string;
}

/**
 * Response from style application endpoint.
 */
export interface StyleApplyResponse {
  /** Text transformed with the user's style */
  transformed_text: string;
  /** User ID whose style was applied */
  style_user_id: string;
  /** Intensity of style application (0-1) */
  intensity: number;
  /** ISO timestamp of transformation */
  applied_at: string;
}
