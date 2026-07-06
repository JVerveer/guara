/**
 * Kadaster Mapper — Silver Layer
 *
 * Transforms BronzeEnvelope<KadasterWozRecord> into SilverRecord<SilverWozRecord>[].
 *
 * Key transformations:
 * - Renames Kadaster Dutch camelCase fields to internal vocabulary
 * - Resolves 4-digit gemeente codes to StandardRegion (adds name, province, NUTS3)
 * - Normalizes peildatum string to StandardPeriod
 */

import type { BronzeEnvelope } from "../../bronze/types";
import type { KadasterWozRecord } from "../../bronze/schema/kadaster";
import type { SilverLineage, SilverRecord, SilverWozRecord } from "../types";
import { normalizeKadasterDate } from "../normalizers/periodNormalizer";
import { normalizeKadasterRegion } from "../normalizers/regionNormalizer";

const MAPPER_VERSION = "kadaster-woz@1.0.0";

const FIELD_MAPPINGS = [
  { sourceField: "wozWaarde",          targetField: "wozValueEur",       transformation: "direct copy", sourceUnit: "EUR", targetUnit: "EUR" },
  { sourceField: "oppervlakte",         targetField: "surfaceM2",          transformation: "direct copy", sourceUnit: "m²", targetUnit: "m²" },
  { sourceField: "bouwjaar",            targetField: "constructionYear",   transformation: "direct copy" },
  { sourceField: "peildatum",           targetField: "assessmentDate",     transformation: "preserved as ISO 8601" },
  { sourceField: "gemeenteCode",        targetField: "region",             transformation: "Kadaster 4-digit code → StandardRegion via regionNormalizer" },
] as const;

export function mapKadasterWoz(
  bronze: BronzeEnvelope<KadasterWozRecord>
): SilverRecord<SilverWozRecord>[] {
  const now = new Date().toISOString();

  return bronze.records.map((raw): SilverRecord<SilverWozRecord> => {
    const data: SilverWozRecord = {
      region: normalizeKadasterRegion(raw.gemeenteCode),
      assessmentDate: raw.peildatum,
      wozValueEur: raw.wozWaarde,
      surfaceM2: raw.oppervlakte,
      constructionYear: raw.bouwjaar,
    };

    const lineage: SilverLineage = {
      bronzeProvenance: bronze.provenance,
      fieldMappings: [...FIELD_MAPPINGS],
      enrichments: [
        {
          description: "Municipality code resolved to name and NUTS3 via region registry",
          enrichmentSource: "Internal Kadaster/CBS municipality registry (regionNormalizer)",
        },
        {
          description: `peildatum normalized: ${raw.peildatum} → ${normalizeKadasterDate(raw.peildatum).isoStart}`,
          enrichmentSource: "periodNormalizer.normalizeKadasterDate",
        },
      ],
      processedAt: now,
      mapperVersion: MAPPER_VERSION,
    };

    return { data, lineage };
  });
}
