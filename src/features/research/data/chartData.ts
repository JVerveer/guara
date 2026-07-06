/**
 * Research feature chart data — sourced exclusively from the Gold layer.
 *
 * This file is the bridge between the data pipeline and the research feature.
 * It re-exports Gold model helpers so that feature services can call them
 * without importing directly from src/data/gold (which would couple the
 * feature to data infrastructure details).
 *
 * Gold models used:
 *   - housePriceModel  → HousePricesChart
 *   - demographicsModel → AgingChart
 *
 * Type aliases re-exported here keep the feature's own type space clean.
 */

export { getHousePriceData } from "@/data/gold/models/housePriceModel";
export { getAgingData } from "@/data/gold/models/demographicsModel";

// Re-export Gold types so feature services stay decoupled from data/gold paths
export type { AgingDataPoint, HousePriceDataPoint } from "@/data/gold/types";
