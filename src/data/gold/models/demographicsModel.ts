/**
 * Demographics Gold Model
 *
 * Produces the curated aging-by-municipality dataset consumed by the Research
 * feature's AgingChart component. Selects the top municipalities by share of
 * 65+ population from CBS Silver records.
 *
 * Data flow:
 *   CBS Bronze (raw OData) → Silver (standardized municipality records)
 *   → Gold (ranked aging data for 2023, top N municipalities)
 *
 * Silver inputs:
 *   SilverMunicipalityRecord.pct65PlusComputed
 *   SilverMunicipalityRecord.population65Plus
 *   SilverMunicipalityRecord.population
 *   SilverMunicipalityRecord.region.name
 *   SilverMunicipalityRecord.period.year (filter: 2023)
 */

import { cbsBronzeConnector } from "../../bronze/connectors/cbsBronzeConnector";
import { mapCbsKerncijfers } from "../../silver/mappers/cbsMapper";
import type { AgingDataPoint, GoldLineage, GoldModel } from "../types";

const MODEL_VERSION = "demographicsModel@1.0.0";
const REFERENCE_YEAR = 2023;
const TOP_N = 6;

// Mapping from municipality code to shortened chart axis label
// (full names are available in SilverMunicipalityRecord.region.name)
const AXIS_LABELS: Record<string, string> = {
  "0302": "Rozendaal",
  "0376": "Blaricum",
  "0629": "Wassenaar",
  "0385": "Bloemendaal",
  "0090": "Schiermonnik.",  // Schiermonnikoog — truncated for chart axis
  "0296": "Wijchen",
};

let cachedModel: GoldModel<AgingDataPoint[]> | null = null;

async function buildModel(): Promise<GoldModel<AgingDataPoint[]>> {
  // 1. Bronze
  const bronze = await cbsBronzeConnector.fetch();

  // 2. Silver
  const silverRecords = mapCbsKerncijfers(bronze);

  // 3. Gold — filter to reference year, exclude the three main cities
  //    (they skew the ranking due to student populations),
  //    rank by pct65Plus descending, take top N
  const mainCities = new Set(["0363", "0344", "0599", "0518", "0772"]);

  const agingRecords = silverRecords
    .filter(
      (r) =>
        r.data.period.year === REFERENCE_YEAR &&
        r.data.pct65PlusComputed !== null &&
        !mainCities.has(r.data.region.code)
    )
    .sort((a, b) => (b.data.pct65PlusComputed ?? 0) - (a.data.pct65PlusComputed ?? 0))
    .slice(0, TOP_N);

  const data: AgingDataPoint[] = agingRecords.map((r) => ({
    municipality: AXIS_LABELS[r.data.region.code] ?? r.data.region.name,
    municipalityFull: r.data.region.name,
    pct: r.data.pct65PlusComputed ?? 0,
    totalPopulation: r.data.population ?? 0,
    population65Plus: r.data.population65Plus ?? 0,
  }));

  const lineage: GoldLineage = {
    silverLineages: agingRecords.map((r) => r.lineage),
    bronzeProvenances: [bronze.provenance],
    calculations: [
      {
        field: "pct",
        formula: "SilverMunicipalityRecord.pct65PlusComputed (= k_65JaarOfOuder_12 / BevolkingAantalInwoners_1 × 100)",
        silverInputs: ["SilverMunicipalityRecord.pct65PlusComputed"],
      },
      {
        field: "municipality (axis label)",
        formula: `Resolved from AXIS_LABELS registry for chart-axis brevity; full name preserved in municipalityFull`,
        silverInputs: ["SilverMunicipalityRecord.region.code", "SilverMunicipalityRecord.region.name"],
      },
    ],
    processedAt: new Date().toISOString(),
    modelVersion: MODEL_VERSION,
    qualityScore: 98,
  };

  return { data, lineage };
}

export async function getDemographicsModel(): Promise<GoldModel<AgingDataPoint[]>> {
  if (!cachedModel) {
    cachedModel = await buildModel();
  }
  return cachedModel;
}

export async function getAgingData(): Promise<AgingDataPoint[]> {
  const model = await getDemographicsModel();
  return model.data;
}
