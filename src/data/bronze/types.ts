/**
 * Bronze Layer — Core types
 *
 * Bronze records represent raw API responses exactly as received.
 * They are immutable: once created, a bronze record is never modified.
 * Every downstream transformation (Silver, Gold) preserves a pointer
 * back to the originating Provenance so full lineage can always be traced.
 *
 * Naming convention: all Bronze-layer types are prefixed with "Bronze".
 */

// ── Provenance ────────────────────────────────────────────────────────────────

/**
 * Complete provenance for a single API call.
 * Captures everything needed to re-fetch the same data in the future.
 */
export interface BronzeProvenance {
  /** Connector ID, e.g. "cbs" | "kadaster" | "knmi" */
  sourceId: string;
  /** Source-specific dataset identifier, e.g. "85039NED" (CBS), "WOZ" (Kadaster) */
  datasetId: string;
  /** Full API endpoint URL that was called */
  apiEndpoint: string;
  /** Query parameters sent with the request */
  queryParams: Record<string, string>;
  /** ISO 8601 timestamp when this response was retrieved */
  retrievedAt: string;
  /** HTTP status code of the response */
  responseStatus: number;
  /** Source-declared version or release date, if available */
  sourceVersion?: string;
  /**
   * SHA-256 hash of the raw payload (hex).
   * Enables deduplication: identical payloads from different fetches
   * don't need to be stored twice.
   */
  payloadHash?: string;
}

// ── Bronze envelope ───────────────────────────────────────────────────────────

/**
 * Wraps a single raw API response payload with its provenance.
 * TPayload is the exact shape returned by the source API — no field renames.
 *
 * Bronze records must never be mutated. Treat them as append-only.
 */
export interface BronzeRecord<TPayload> {
  /** Full audit trail of where this data came from */
  provenance: BronzeProvenance;
  /** The raw API payload, field names and types exactly as returned */
  payload: TPayload;
}

/**
 * Convenience wrapper for API responses that return an array of records.
 */
export interface BronzeEnvelope<TRecord> {
  provenance: BronzeProvenance;
  /** Raw records, unmodified from the API response */
  records: TRecord[];
  /** Record count as reported by (or computed from) the API response */
  recordCount: number;
}

// ── Connector contract ────────────────────────────────────────────────────────

/**
 * Every Bronze connector must implement this interface.
 * When VITE_USE_REAL_API=true, implementations call the real API.
 * When false, they return mock BronzeEnvelopes that mirror real API schemas.
 */
export interface IBronzeConnector<TRecord> {
  readonly sourceId: string;
  readonly datasetId: string;
  readonly apiEndpoint: string;
  fetch(params?: Record<string, string>): Promise<BronzeEnvelope<TRecord>>;
}
