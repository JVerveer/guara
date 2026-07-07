import type { CbsDataProperty } from "@/data/bronze/schema/cbs";
import type { GeographicLevel, GeographicQualification } from "./types";

const LEVEL_LABELS: Record<GeographicLevel, string> = {
  municipality: "Municipality",
  province: "Province",
  country: "Country",
  other: "Other geography",
};

const GEOGRAPHY_FIELD_CANDIDATES = [
  "RegioS",
  "WijkenEnBuurten",
  "Codering_3",
  "Gebieden",
  "Regio",
  "RegionS",
];

const REGION_TYPE_FIELD_CANDIDATES = ["SoortRegio_2", "SoortRegio", "RegioType", "Gebiedsindeling"];
const REGION_NAME_FIELD_CANDIDATES = ["Gemeentenaam_1", "Naam_2", "RegioNaam", "Regionaam", "Regio"];

function clean(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const cleaned = String(value).trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

function firstValue(row: Record<string, unknown>, keys: string[]): { key: string; value: string } | undefined {
  for (const key of keys) {
    const value = clean(row[key]);
    if (value) return { key, value };
  }
  return undefined;
}

function geographyKeys(properties: CbsDataProperty[]): string[] {
  const fromMetadata = properties
    .filter((property) => property.Key && (property.Type.includes("Geo") || property.Type === "Dimension"))
    .map((property) => property.Key);

  return Array.from(new Set([...GEOGRAPHY_FIELD_CANDIDATES, ...fromMetadata]));
}

export function levelFromCbsCode(rawCode?: string, rawType?: string): GeographicLevel {
  const code = clean(rawCode)?.toUpperCase();
  const type = clean(rawType)?.toLowerCase();

  if (type) {
    if (type === "land" || type.includes("nederland") || type.includes("country")) return "country";
    if (type.includes("provincie") || type.includes("province")) return "province";
    if (type.includes("gemeente") || type.includes("municipality")) return "municipality";
  }

  if (!code) return "other";
  if (code === "NL00" || code === "NL01" || code === "NL" || code === "NEDERLAND") return "country";
  if (code.startsWith("PV")) return "province";
  if (code.startsWith("GM")) return "municipality";
  return "other";
}

export function qualifyCbsRecord(
  row: Record<string, unknown>,
  properties: CbsDataProperty[] = []
): GeographicQualification {
  const geography = firstValue(row, geographyKeys(properties));
  const regionType = firstValue(row, REGION_TYPE_FIELD_CANDIDATES);
  const regionName = firstValue(row, REGION_NAME_FIELD_CANDIDATES);
  const level = levelFromCbsCode(geography?.value, regionType?.value);

  return {
    level,
    label: LEVEL_LABELS[level],
    code: geography?.value,
    name: regionName?.value,
    sourceField: geography?.key,
  };
}

export function summarizeGeographicLevels(
  qualifications: GeographicQualification[]
): Record<GeographicLevel, number> {
  return qualifications.reduce<Record<GeographicLevel, number>>(
    (acc, qualification) => {
      acc[qualification.level] += 1;
      return acc;
    },
    { municipality: 0, province: 0, country: 0, other: 0 }
  );
}

export const supportedGeographicLevels: GeographicLevel[] = ["municipality", "province", "country"];
