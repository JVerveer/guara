/**
 * Silver Layer — Core types
 *
 * Silver records hold cleaned, standardized, and enriched data.
 * Every Silver record carries a SilverLineage that traces it back to its
 * originating Bronze envelope, making the full provenance chain auditable.
 *
 * Conventions:
 * - Field names use camelCase internal vocabulary (not source API names)
 * - Dates are ISO 8601 strings
 * - Currency is always EUR
 * - Regions carry both code and resolved name
 * - Every derived/calculated field is documented in FieldMapping
 */

import type { BronzeProvenance } from "../bronze/types";

// ── Lineage ───────────────────────────────────────────────────────────────────

/** Documents how a single source field was mapped to a Silver field */
export interface FieldMapping {
  /** Original field name as it appeared in the Bronze payload */
  sourceField: string;
  /** Internal Silver field name */
  targetField: string;
  /** Description of any transformation applied (e.g. "divided by 1000") */
  transformation?: string;
  /** Unit of the source value before transformation */
  sourceUnit?: string;
  /** Unit of the target value after transformation */
  targetUnit?: string;
}

/** Enrichment applied to a record after field mapping */
export interface SilverEnrichment {
  /** What was added or resolved */
  description: string;
  /** Source of the enrichment (e.g. "CBS region registry", "ISO 3166 lookup") */
  enrichmentSource: string;
}

/** Complete lineage record attached to every Silver item */
export interface SilverLineage {
  /** Provenance of the Bronze record this Silver record was derived from */
  bronzeProvenance: BronzeProvenance;
  /** All field-level mappings applied */
  fieldMappings: FieldMapping[];
  /** Enrichments applied beyond field mapping */
  enrichments: SilverEnrichment[];
  /** ISO 8601 timestamp when this Silver transformation was run */
  processedAt: string;
  /** Name and version of the mapper that produced this record */
  mapperVersion: string;
}

/** Wraps any cleaned/standardized record with its full lineage */
export interface SilverRecord<TData> {
  data: TData;
  lineage: SilverLineage;
}

// ── Standard internal types ───────────────────────────────────────────────────

/** Standardized municipality or region, resolved from a source-specific code */
export interface StandardRegion {
  /** Source-format code preserved exactly (e.g. "GM0363" from CBS) */
  sourceCode: string;
  /** Internal code stripped of prefix (e.g. "0363") */
  code: string;
  /** Resolved display name */
  name: string;
  /** ISO 3166-2:NL province code */
  province?: string;
  /** NUTS3 regional code for EU comparisons */
  nuts3?: string;
}

/** Standardized time period, resolved from a source-specific period code */
export interface StandardPeriod {
  /** Source-format period code preserved exactly (e.g. "2023JJ00" from CBS) */
  sourceCode: string;
  year: number;
  month?: number;
  quarter?: number;
  /** Granularity of the measurement */
  granularity: "annual" | "quarterly" | "monthly" | "daily";
  /** ISO 8601 start of the period */
  isoStart: string;
  /** ISO 8601 end of the period */
  isoEnd: string;
}

// ── Standardized CBS domain record ───────────────────────────────────────────

/**
 * Cleaned, standardized CBS municipality record.
 * All CBS-specific field names have been replaced with internal vocabulary.
 * All CBS-specific period/region codes have been resolved and normalized.
 */
export interface SilverMunicipalityRecord {
  region: StandardRegion;
  period: StandardPeriod;
  /** Total resident population */
  population: number | null;
  /** Population aged 65 and over */
  population65Plus: number | null;
  /** Share of population aged 65+ (computed: population65Plus / population) */
  pct65PlusComputed: number | null;
  /** Average disposable income per person (EUR) */
  avgIncomeEur: number | null;
  /**
   * Average WOZ property value (EUR).
   * Converted from CBS's thousands-of-euros unit.
   */
  avgWozValueEur: number | null;
  /** Total number of registered dwellings */
  dwellingCount: number | null;
  /** Population density (inhabitants per km²) */
  populationDensityPerKm2: number | null;
}

// ── Standardized Kadaster WOZ record ─────────────────────────────────────────

export interface SilverWozRecord {
  region: StandardRegion;
  /** ISO 8601 assessment reference date */
  assessmentDate: string;
  /** WOZ assessed value (EUR) — unchanged from Kadaster */
  wozValueEur: number;
  /** Property surface area (m²) */
  surfaceM2: number | null;
  /** Year the building was constructed */
  constructionYear: number | null;
}

// ── Standardized KNMI climate record ─────────────────────────────────────────

export interface SilverClimateRecord {
  /** KNMI station number */
  stationId: number;
  /** ISO 8601 observation date */
  observationDate: string;
  /** Daily mean temperature (°C, rounded to 1 decimal) */
  meanTempC: number | null;
  /** Daily maximum temperature (°C) */
  maxTempC: number | null;
  /** Daily minimum temperature (°C) */
  minTempC: number | null;
  /** Daily precipitation (mm, rounded to 1 decimal) */
  precipitationMm: number | null;
}
