/**
 * Sources feature data — sourced exclusively from the Gold layer.
 *
 * The Connector Gold model holds the curated list of data providers
 * (CBS, Eurostat, Kadaster, etc.) with enriched metadata and lineage.
 *
 * Features access connectors only through this file, never by importing
 * directly from src/data/gold/.
 */

export { getConnectors } from "@/data/gold/models/connectorModel";
export type { Connector } from "@/features/sources/types";
