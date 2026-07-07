/**
 * Connector Gold Model
 *
 * Produces the curated list of data Connectors shown in the Source Browser.
 *
 * This model uses Bronze directly (not through Silver) because:
 * - Connector metadata (dataset count, reliability, sync status) comes from
 *   an internal registry, not from a mapped field in a CBS/Kadaster dataset
 * - The data is already clean and structured — no field mapping is needed
 * - Lineage is recorded to maintain the Bronze→Gold audit trail
 *
 * When the Guara backend exposes a /connectors endpoint, this model will
 * fetch from that API. The BronzeProvenance documents where each entry came from.
 *
 * Gold → Bronze direct access justification (per data architecture rules):
 *   "Connector metadata is configuration data owned by the Guara platform,
 *    not sourced from a third-party API that requires normalization.
 *    The static registry IS the bronze source for this domain."
 */

import type { Connector } from "@/features/sources/types";
import type { BronzeProvenance } from "../../bronze/types";
import type { CalculationLog, GoldLineage, GoldModel } from "../types";

const MODEL_VERSION = "connectorModel@1.0.0";

// ── Bronze provenance for the connector registry ──────────────────────────────
// The connector list is maintained in Guara's own configuration — the
// "API endpoint" points to where the real connector catalog will be served.
const REGISTRY_PROVENANCE: BronzeProvenance = {
  sourceId: "guara-internal",
  datasetId: "connector-registry-v1",
  apiEndpoint: "https://api.guara.app/v1/connectors",
  queryParams: { version: "1.0.0" },
  retrievedAt: "2024-03-01T00:00:00.000Z",
  responseStatus: 200,
  sourceVersion: "2024-Q1",
};

// ── Static connector registry ─────────────────────────────────────────────────
// TODO: Replace with a real API call to GET /connectors when the backend is ready

const CONNECTOR_RECORDS: Connector[] = [
  { id: "cbs",       name: "CBS",           fullName: "Centraal Bureau voor de Statistiek", abbr: "CBS", datasets: 847,  lastSync: "2 hours ago",  coverage: "Netherlands",   reliability: 98, tags: ["Demographics", "Economy", "Housing"],    brandColor: "#1C3D8F" },
  { id: "eurostat",  name: "Eurostat",       fullName: "European Statistics Office",         abbr: "EU",  datasets: 1240, lastSync: "6 hours ago",  coverage: "European Union", reliability: 97, tags: ["Economy", "Comparative", "EU"],          brandColor: "#003399" },
  { id: "worldbank", name: "World Bank",     fullName: "World Bank Open Data",               abbr: "WB",  datasets: 3200, lastSync: "12 hours ago", coverage: "Global",        reliability: 95, tags: ["Development", "Economy", "Global"],       brandColor: "#006548" },
  { id: "oecd",      name: "OECD",           fullName: "Organisation for Economic Co-operation", abbr: "OE", datasets: 892, lastSync: "1 day ago", coverage: "38 Countries",  reliability: 96, tags: ["Economy", "Policy", "Education"],         brandColor: "#1F3A6E" },
  { id: "knmi",      name: "KNMI",           fullName: "Koninklijk Meteorologisch Instituut", abbr: "KN", datasets: 214, lastSync: "1 hour ago",   coverage: "Netherlands",   reliability: 99, tags: ["Climate", "Weather", "Environment"],      brandColor: "#0369A1" },
  { id: "kadaster",  name: "Kadaster",       fullName: "Dutch Land Registry",                abbr: "KD",  datasets: 156, lastSync: "3 hours ago",  coverage: "Netherlands",   reliability: 99, tags: ["Housing", "Real Estate", "Land"],         brandColor: "#1D4E1A" },
  { id: "rdw",       name: "RDW",            fullName: "Rijksdienst voor het Wegverkeer",    abbr: "RD",  datasets: 89,  lastSync: "4 hours ago",  coverage: "Netherlands",   reliability: 98, tags: ["Transport", "Vehicles"],                  brandColor: "#92400E" },
  { id: "rivm",      name: "RIVM",           fullName: "Rijksinstituut voor Volksgezondheid", abbr: "RI", datasets: 312, lastSync: "8 hours ago",  coverage: "Netherlands",   reliability: 97, tags: ["Health", "Environment"],                  brandColor: "#1E5B8C" },
  { id: "parliament",name: "Parliament",     fullName: "Tweede Kamer der Staten-Generaal",   abbr: "TK",  datasets: 48,  lastSync: "2 days ago",   coverage: "Netherlands",   reliability: 99, tags: ["Policy", "Government", "Law"],            brandColor: "#3B2F7A" },
  { id: "municipal", name: "Municipal Data", fullName: "Gemeentelijke Open Data (52 gemeenten)", abbr: "GM", datasets: 1840, lastSync: "1 day ago", coverage: "Netherlands",  reliability: 88, tags: ["Local", "Housing", "Services"],           brandColor: "#5B4700" },
];

// ── Gold model assembly ───────────────────────────────────────────────────────

const CALCULATIONS: CalculationLog[] = [
  {
    field: "datasets",
    formula: "Source-declared total dataset count as of last synchronization",
    silverInputs: [],
    bronzeInputsDirect: [
      {
        field: "connector-registry-v1.datasets",
        reason: "Connector metadata is internal configuration — no Silver normalization needed",
      },
    ],
  },
  {
    field: "reliability",
    formula: "Editorial quality score 0–100 based on source documentation, update frequency and historical uptime",
    silverInputs: [],
    bronzeInputsDirect: [
      {
        field: "connector-registry-v1.reliability",
        reason: "Reliability is a Guara-assigned score, not computed from source data",
      },
    ],
  },
];

const CONNECTOR_MODEL: GoldModel<Connector[]> = {
  data: CONNECTOR_RECORDS,
  lineage: {
    silverLineages: [], // No Silver transformation — Bronze used directly (justified above)
    bronzeProvenances: [REGISTRY_PROVENANCE],
    calculations: CALCULATIONS,
    processedAt: "2024-03-01T00:00:00.000Z",
    modelVersion: MODEL_VERSION,
    qualityScore: 100,
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

export function getConnectorModel(): GoldModel<Connector[]> {
  return CONNECTOR_MODEL;
}

export function getConnectors(): Connector[] {
  return CONNECTOR_MODEL.data;
}
