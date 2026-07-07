import type { CbsDataProperty, CbsDimensionValue } from "@/data/bronze/schema/cbs";
import type { GeographicLevel, GeographicQualification } from "./types";

const LEVEL_LABELS: Record<GeographicLevel, string> = {
  neighborhood: "Neighborhood",
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

function normalizeKey(value: unknown): string | undefined {
  return clean(value)?.toUpperCase();
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
    if (type.includes("wijk") || type.includes("buurt") || type.includes("neighborhood")) return "neighborhood";
  }

  if (!code) return "other";
  if (code === "NL00" || code === "NL01" || code === "NL" || code === "NEDERLAND") return "country";
  if (code.startsWith("PV")) return "province";
  if (code.startsWith("GM")) return "municipality";
  if (code.startsWith("WK") || code.startsWith("BU")) return "neighborhood";
  return "other";
}

function levelFromDimensionValue(dimension?: CbsDimensionValue): GeographicLevel | undefined {
  if (!dimension) return undefined;

  const key = normalizeKey(dimension.DetailRegionCode || dimension.Key);
  const title = clean(dimension.Title)?.toLowerCase();
  const description = clean(dimension.Description)?.toLowerCase();
  const municipality = clean(dimension.Municipality);

  if (key === "NL00" || key === "NL01" || title === "nederland") return "country";
  if (key?.startsWith("GM")) return "municipality";
  if (key?.startsWith("WK") || key?.startsWith("BU")) return "neighborhood";
  if (description?.includes("pv = provincie") || title?.includes("(pv)")) return "province";
  if (description?.includes("gemeente") && municipality && key?.startsWith("GM")) return "municipality";
  if (description?.includes("land") && title === "nederland") return "country";

  return undefined;
}

export function qualifyCbsRecord(
  row: Record<string, unknown>,
  properties: CbsDataProperty[] = [],
  dimensionValues: Record<string, CbsDimensionValue> = {}
): GeographicQualification {
  const geography = firstValue(row, geographyKeys(properties));
  const regionType = firstValue(row, REGION_TYPE_FIELD_CANDIDATES);
  const regionName = firstValue(row, REGION_NAME_FIELD_CANDIDATES);
  const dimension = geography?.value ? dimensionValues[normalizeKey(geography.value) ?? ""] : undefined;
  const dimensionLevel = levelFromDimensionValue(dimension);
  const rowLevel = regionType?.value ? levelFromCbsCode(undefined, regionType.value) : undefined;
  const level = dimensionLevel ?? rowLevel ?? levelFromCbsCode(geography?.value);
  const source = dimensionLevel
    ? "cbs-dimension"
    : rowLevel
      ? "cbs-row-field"
      : geography?.value
        ? "code-fallback"
        : "none";

  return {
    level,
    label: LEVEL_LABELS[level],
    code: geography?.value,
    name: dimension?.Title || regionName?.value,
    sourceField: geography?.key,
    source,
    evidence: dimension
      ? `${dimension.Key.trim()} ${dimension.Title}${dimension.Description ? ` — ${dimension.Description}` : ""}`
      : regionType?.value,
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
    { neighborhood: 0, municipality: 0, province: 0, country: 0, other: 0 }
  );
}

export const supportedGeographicLevels: GeographicLevel[] = ["neighborhood", "municipality", "province", "country"];
