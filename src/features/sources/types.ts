/**
 * Domain types for the Connectors feature.
 *
 * A Connector represents an external data provider (CBS, Eurostat, etc.)
 * that Guara connects to in order to surface datasets and APIs.
 * The term "Connector" is used throughout the codebase instead of the generic
 * word "Source" to express that these are active integration points.
 */

export interface Connector {
  id: string;
  /** Short display name, e.g. "CBS" */
  name: string;
  /** Full official name, e.g. "Centraal Bureau voor de Statistiek" */
  fullName: string;
  /** Abbreviated label shown in the badge, e.g. "CBS" */
  abbr: string;
  /** Total number of datasets exposed by this connector */
  datasets: number;
  /** Human-readable relative timestamp, e.g. "2 hours ago" */
  lastSync: string;
  /** Geographic or political scope of the data */
  coverage: string;
  /** Data quality score 0–100 */
  reliability: number;
  /** Domain tag keys used for filtering and display */
  tags: string[];
  /** Official brand color (hex) — used only for the connector's identity badge */
  brandColor: string;
  /** Optional layer-specific ingestion metadata displayed in Source Browser. */
  metadata?: Array<{
    label: string;
    value: string;
  }>;
}
