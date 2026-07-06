/**
 * CBS Mapper — Silver Layer
 *
 * Transforms a BronzeEnvelope<CbsKerncijfersRecord> into an array of
 * SilverRecord<SilverMunicipalityRecord>.
 *
 * Responsibilities:
 * 1. Rename CBS source fields to internal vocabulary
 * 2. Resolve CBS period codes and region codes via normalizers
 * 3. Convert CBS units (€1000s → €, period codes → ISO dates)
 * 4. Compute derived fields (pct65Plus)
 * 5. Attach complete SilverLineage including all FieldMappings
 */

import type { BronzeEnvelope } from "../../bronze/types";
import type { CbsKerncijfersRecord } from "../../bronze/schema/cbs";
import type { SilverLineage, SilverMunicipalityRecord, SilverRecord } from "../types";
import { normalizeCbsPeriod } from "../normalizers/periodNormalizer";
import { normalizeCbsRegion } from "../normalizers/regionNormalizer";
import { cbsWozToEur, computeSharePct } from "../normalizers/unitNormalizer";

const MAPPER_VERSION = "cbs-kerncijfers@1.0.0";

// ── Field mapping catalogue ───────────────────────────────────────────────────
// Kept as a constant so Gold models can inspect what transformations were applied.

const FIELD_MAPPINGS = [
  { sourceField: "BevolkingAantalInwoners_1",      targetField: "population",              transformation: "direct copy" },
  { sourceField: "k_65JaarOfOuder_12",             targetField: "population65Plus",         transformation: "direct copy" },
  { sourceField: "k_65JaarOfOuder_12",             targetField: "pct65PlusComputed",        transformation: "k_65JaarOfOuder_12 / BevolkingAantalInwoners_1 * 100", sourceUnit: "count", targetUnit: "%" },
  { sourceField: "GemiddeldinkomenperpersoonEuro_66", targetField: "avgIncomeEur",           transformation: "direct copy", sourceUnit: "EUR", targetUnit: "EUR" },
  { sourceField: "GemiddeldeWOZwaardewoning_85",   targetField: "avgWozValueEur",           transformation: "multiply by 1000", sourceUnit: "EUR×1000", targetUnit: "EUR" },
  { sourceField: "AantalWoningen_86",              targetField: "dwellingCount",            transformation: "direct copy" },
  { sourceField: "Bevolkingsdichtheid_33",         targetField: "populationDensityPerKm2",  transformation: "direct copy", sourceUnit: "inhabitants/km²", targetUnit: "inhabitants/km²" },
  { sourceField: "Perioden",                       targetField: "period",                   transformation: "CBS period code → StandardPeriod via periodNormalizer" },
  { sourceField: "RegioS",                         targetField: "region",                   transformation: "CBS region code → StandardRegion via regionNormalizer" },
] as const;

// ── Mapper ────────────────────────────────────────────────────────────────────

export function mapCbsKerncijfers(
  bronze: BronzeEnvelope<CbsKerncijfersRecord>
): SilverRecord<SilverMunicipalityRecord>[] {
  const now = new Date().toISOString();

  return bronze.records.map((raw): SilverRecord<SilverMunicipalityRecord> => {
    const region = normalizeCbsRegion(raw.RegioS);
    const period = normalizeCbsPeriod(raw.Perioden);
    const avgWozValueEur = cbsWozToEur(raw.GemiddeldeWOZwaardewoning_85);
    const pct65PlusComputed = computeSharePct(raw.k_65JaarOfOuder_12, raw.BevolkingAantalInwoners_1);

    const data: SilverMunicipalityRecord = {
      region,
      period,
      population: raw.BevolkingAantalInwoners_1,
      population65Plus: raw.k_65JaarOfOuder_12,
      pct65PlusComputed,
      avgIncomeEur: raw.GemiddeldinkomenperpersoonEuro_66,
      avgWozValueEur,
      dwellingCount: raw.AantalWoningen_86,
      populationDensityPerKm2: raw.Bevolkingsdichtheid_33,
    };

    const lineage: SilverLineage = {
      bronzeProvenance: bronze.provenance,
      fieldMappings: [...FIELD_MAPPINGS],
      enrichments: [
        {
          description: "Region code resolved to municipality name and NUTS3 code",
          enrichmentSource: "Internal CBS municipality registry (regionNormalizer)",
        },
        {
          description: "Period code parsed to ISO 8601 date range",
          enrichmentSource: "CBS period format specification (periodNormalizer)",
        },
        {
          description: "pct65PlusComputed derived: k_65JaarOfOuder_12 / BevolkingAantalInwoners_1 × 100",
          enrichmentSource: "Computed in cbsMapper",
        },
      ],
      processedAt: now,
      mapperVersion: MAPPER_VERSION,
    };

    return { data, lineage };
  });
}
