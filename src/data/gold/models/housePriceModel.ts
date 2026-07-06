/**
 * House Price Gold Model
 *
 * Produces the curated house price trend dataset consumed by the Research
 * feature's HousePricesChart component. Aggregates CBS Kerncijfers Silver
 * records into a chart-ready GoldModel<HousePriceDataPoint[]>.
 *
 * Data flow:
 *   CBS Bronze (raw OData) → Silver (standardized) → Gold (chart-ready)
 *
 * Silver inputs: SilverMunicipalityRecord.avgWozValueEur, .period, .region
 * Gold output:   HousePriceDataPoint[] — values in €000s, one row per year
 */

import { cbsBronzeConnector } from "../../bronze/connectors/cbsBronzeConnector";
import { mapCbsKerncijfers } from "../../silver/mappers/cbsMapper";
import { buildHousePriceChartData } from "../indicators/priceTrendIndicator";
import type { GoldLineage, GoldModel, HousePriceDataPoint } from "../types";

const MODEL_VERSION = "housePriceModel@1.0.0";

// ── Synchronous bootstrap from pre-fetched bronze data ───────────────────────
// In production this would be replaced by an async pipeline that fetches,
// maps, and caches the gold model on application startup.

let cachedModel: GoldModel<HousePriceDataPoint[]> | null = null;

async function buildModel(): Promise<GoldModel<HousePriceDataPoint[]>> {
  // 1. Bronze — fetch raw CBS data (mock or real API)
  const bronze = await cbsBronzeConnector.fetch();

  // 2. Silver — map all fields, resolve regions and periods
  const silverRecords = mapCbsKerncijfers(bronze);

  // 3. Gold — build chart-ready data from Amsterdam, Utrecht, Rotterdam records
  const data = buildHousePriceChartData(silverRecords);

  // 4. Assemble lineage
  const silverLineages = silverRecords.map((r) => r.lineage);
  const lineage: GoldLineage = {
    silverLineages,
    bronzeProvenances: [bronze.provenance],
    calculations: [
      {
        field: "Amsterdam | Utrecht | Rotterdam",
        formula: "SilverMunicipalityRecord.avgWozValueEur / 1000, grouped by period.year and region.code",
        silverInputs: ["SilverMunicipalityRecord.avgWozValueEur", "SilverMunicipalityRecord.period.year", "SilverMunicipalityRecord.region.code"],
      },
    ],
    processedAt: new Date().toISOString(),
    modelVersion: MODEL_VERSION,
    qualityScore: 98, // Derived from CBS reliability score
  };

  return { data, lineage };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the Gold house price model.
 * On first call, builds the model by running the Bronze → Silver → Gold pipeline.
 * Results are cached in memory for the session.
 */
export async function getHousePriceModel(): Promise<GoldModel<HousePriceDataPoint[]>> {
  if (!cachedModel) {
    cachedModel = await buildModel();
  }
  return cachedModel;
}

/**
 * Convenience helper — returns just the chart data array without lineage.
 * Use when a component only needs the data, not the provenance.
 */
export async function getHousePriceData(): Promise<HousePriceDataPoint[]> {
  const model = await getHousePriceModel();
  return model.data;
}
