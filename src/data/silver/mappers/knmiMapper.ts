/**
 * KNMI Mapper — Silver Layer
 *
 * Transforms BronzeEnvelope<KnmiDailyRecord> into SilverRecord<SilverClimateRecord>[].
 *
 * Key transformations:
 * - YYYYMMDD integer → ISO 8601 date string via periodNormalizer
 * - Temperature values: divide by 10 (0.1°C → °C)
 * - Precipitation values: divide by 10 (0.1mm → mm), -1 → 0 (trace)
 */

import type { BronzeEnvelope } from "../../bronze/types";
import type { KnmiDailyRecord } from "../../bronze/schema/knmi";
import type { SilverClimateRecord, SilverLineage, SilverRecord } from "../types";
import { normalizeKnmiDate } from "../normalizers/periodNormalizer";
import { knmiPrecipToMm, knmiTempToCelsius } from "../normalizers/unitNormalizer";

const MAPPER_VERSION = "knmi-daily@1.0.0";

const FIELD_MAPPINGS = [
  { sourceField: "STN",       targetField: "stationId",         transformation: "direct copy" },
  { sourceField: "YYYYMMDD",  targetField: "observationDate",   transformation: "YYYYMMDD integer → ISO 8601 date string" },
  { sourceField: "TG",        targetField: "meanTempC",         transformation: "divide by 10", sourceUnit: "0.1°C", targetUnit: "°C" },
  { sourceField: "TX",        targetField: "maxTempC",          transformation: "divide by 10", sourceUnit: "0.1°C", targetUnit: "°C" },
  { sourceField: "TN",        targetField: "minTempC",          transformation: "divide by 10", sourceUnit: "0.1°C", targetUnit: "°C" },
  { sourceField: "RH",        targetField: "precipitationMm",   transformation: "divide by 10; -1 → 0 (trace)", sourceUnit: "0.1mm", targetUnit: "mm" },
] as const;

export function mapKnmiDaily(
  bronze: BronzeEnvelope<KnmiDailyRecord>
): SilverRecord<SilverClimateRecord>[] {
  const now = new Date().toISOString();

  return bronze.records.map((raw): SilverRecord<SilverClimateRecord> => {
    const period = normalizeKnmiDate(raw.YYYYMMDD);

    const data: SilverClimateRecord = {
      stationId: raw.STN,
      observationDate: period.isoStart,
      meanTempC: knmiTempToCelsius(raw.TG),
      maxTempC: knmiTempToCelsius(raw.TX),
      minTempC: knmiTempToCelsius(raw.TN),
      precipitationMm: knmiPrecipToMm(raw.RH),
    };

    const lineage: SilverLineage = {
      bronzeProvenance: bronze.provenance,
      fieldMappings: [...FIELD_MAPPINGS],
      enrichments: [
        {
          description: `Date normalized: ${raw.YYYYMMDD} → ${period.isoStart}`,
          enrichmentSource: "periodNormalizer.normalizeKnmiDate",
        },
        {
          description: "Temperature values divided by 10 to convert 0.1°C to °C",
          enrichmentSource: "unitNormalizer.knmiTempToCelsius",
        },
        {
          description: "Precipitation: divided by 10 for mm; -1 (trace) mapped to 0",
          enrichmentSource: "unitNormalizer.knmiPrecipToMm",
        },
      ],
      processedAt: now,
      mapperVersion: MAPPER_VERSION,
    };

    return { data, lineage };
  });
}
