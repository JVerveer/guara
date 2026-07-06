/**
 * Gold Layer — Core types
 *
 * Gold models are the final, research-ready, user-facing data layer.
 * They represent curated business entities, indicators, and summaries
 * intended for direct consumption by UI components and services.
 *
 * Rules:
 * - UI components may only consume Gold types (not Silver or Bronze)
 * - Gold may use Silver as its primary input
 * - Gold may use Bronze directly for raw metadata, provenance, or
 *   unmapped original fields — this must be recorded in GoldLineage
 * - Every Gold field carries a CalculationLog for derived values
 * - Full traceback to original Bronze Provenance is always preserved
 *
 * Naming: all Gold-layer type names describe business entities (no "Gold" prefix)
 */

import type { BronzeProvenance } from "../bronze/types";
import type { SilverLineage } from "../silver/types";

// ── Lineage ───────────────────────────────────────────────────────────────────

/** Documents how a single Gold field was computed */
export interface CalculationLog {
  /** Gold output field name */
  field: string;
  /**
   * Human-readable formula or description.
   * Should be specific enough for a domain expert to reproduce the result.
   * Example: "(population65Plus / population) * 100"
   */
  formula: string;
  /** Silver field(s) used as inputs */
  silverInputs: string[];
  /**
   * When a Bronze field was used directly (bypassing Silver normalization),
   * list it here and record the justification.
   */
  bronzeInputsDirect?: Array<{
    field: string;
    reason: string;
  }>;
}

/** Full lineage attached to every Gold model */
export interface GoldLineage {
  /** All Silver lineage records this Gold model was built from */
  silverLineages: SilverLineage[];
  /**
   * Flat list of all original Bronze provenances reachable through the Silver lineages.
   * Enables one-step traceback from any Gold output to its original API call.
   */
  bronzeProvenances: BronzeProvenance[];
  /** Calculation documentation for every derived or computed Gold field */
  calculations: CalculationLog[];
  /** ISO 8601 timestamp when this Gold model was produced */
  processedAt: string;
  /**
   * The name of the Gold model builder that produced this record.
   * Format: "{modelName}@{semver}"
   */
  modelVersion: string;
  /**
   * Optional data quality score (0–100).
   * Computed from the reliability of all contributing sources.
   */
  qualityScore?: number;
}

// ── Gold model wrapper ────────────────────────────────────────────────────────

/**
 * The standard Gold wrapper.
 * TData is the business-domain type consumed by UI components and services.
 */
export interface GoldModel<TData> {
  data: TData;
  lineage: GoldLineage;
}

// ── Indicator ─────────────────────────────────────────────────────────────────

/**
 * A single computed indicator with its value, unit, and full calculation trace.
 * Used for KPIs, rankings, and summary statistics.
 */
export interface Indicator<TValue = number> {
  /** Display label (use i18n key in UI, not raw string) */
  label: string;
  /** The computed value */
  value: TValue;
  /** Unit of the value (e.g. "%", "EUR", "inhabitants/km²") */
  unit: string;
  /** How this indicator was calculated */
  calculation: CalculationLog;
}

// ── Gold domain types — consumed by UI features ───────────────────────────────

/**
 * House price data point for the trend chart.
 * Values are in €000s for chart axis readability.
 */
export interface HousePriceDataPoint {
  year: string;
  Amsterdam: number;
  Utrecht: number;
  Rotterdam: number;
}

/**
 * Aging ranking entry — municipalities ordered by share of 65+ population.
 */
export interface AgingDataPoint {
  /** Shortened display label for chart axes */
  municipality: string;
  /** Full municipality name for tooltips and screen readers */
  municipalityFull: string;
  /** Share of population aged 65 or older (%) */
  pct: number;
  /** Total population used in the calculation */
  totalPopulation: number;
  /** Absolute count of population 65+ */
  population65Plus: number;
}
