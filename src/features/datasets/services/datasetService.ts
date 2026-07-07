/**
 * Dataset service — API contract for fetching and searching datasets.
 *
 */

import { cbsStatLineClient, toODataString } from "@/data/bronze/clients/cbsStatLineClient";
import type { CbsCatalogTable, CbsDataProperty, CbsDimensionValue } from "@/data/bronze/schema/cbs";
import { qualifyCbsRecord, summarizeGeographicLevels, supportedGeographicLevels } from "@/data/geography/cbsGeography";
import type { GeographicLevel } from "@/data/geography/types";
import type { Dataset, DatasetPreview, DatasetPreviewColumn, DatasetVariable } from "../types";
import { supabaseDatasetRepository } from "./supabaseDatasetRepository";

const CBS_TAGS = ["Population", "Housing", "Economy"];
const GEOGRAPHY_LEVEL_COLUMN: DatasetPreviewColumn = {
  key: "__guaraGeographicLevel",
  title: "Geographic level",
  type: "GuaraQualification",
};
const GEOGRAPHY_SOURCE_COLUMN: DatasetPreviewColumn = {
  key: "__guaraGeographicSource",
  title: "Qualification source",
  type: "GuaraQualification",
};
const GEOGRAPHY_FIELD_KEYS = ["RegioS", "WijkenEnBuurten", "Codering_3", "Gebieden", "Regio", "RegionS"];
const PREVIEW_ROW_LIMIT = 25;
const EMPTY_LEVEL_SUMMARY: Record<GeographicLevel, number> = {
  neighborhood: 0,
  municipality: 0,
  province: 0,
  country: 0,
  other: 0,
};

function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact" }).format(value);
}

function mapTable(table: CbsCatalogTable): Dataset {
  return {
    id: table.Identifier,
    title: table.ShortTitle || table.Title,
    provider: "CBS",
    description: table.ShortDescription?.trim() || table.Title,
    tags: CBS_TAGS,
    updated: table.Updated ? new Date(table.Updated).toLocaleDateString("en-US", { dateStyle: "medium" }) : "CBS API",
    updatedAt: table.Updated,
    records: table.Period ?? "StatLine",
    topics: 0,
    qualification: {
      years: [],
      geographicLevels: [],
      confidence: "unqualified",
      evidence: [],
    },
  };
}

function rankDatasets(datasets: Dataset[], query: string): Dataset[] {
  const normalizedQuery = query.trim().toLowerCase();
  const tokens = normalizedQuery.split(/\s+/).filter((token) => token.length > 2);

  return [...datasets].sort((a, b) => {
    const score = (dataset: Dataset) => {
      const title = dataset.title.toLowerCase();
      const description = dataset.description.toLowerCase();
      let total = 0;
      if (title.includes(normalizedQuery)) total += 100;
      if (description.includes(normalizedQuery)) total += 40;
      total += tokens.filter((token) => title.includes(token)).length * 10;
      total += tokens.filter((token) => description.includes(token)).length * 2;
      if (dataset.id === "85039NED" && tokens.includes("kerncijfers")) total += 50;
      return total;
    };

    return score(b) - score(a);
  });
}

function queryYear(query: string): number | undefined {
  const trimmed = query.trim();
  if (!/^(?:19|20)\d{2}$/.test(trimmed)) return undefined;
  const year = Number(trimmed);
  return year >= 1970 && year <= 2026 ? year : undefined;
}

function datasetCoversYear(dataset: Dataset, year: number): boolean {
  const { qualification } = dataset;
  if (qualification.years.length > 0) return qualification.years.includes(year);
  if (qualification.yearStart === undefined || qualification.yearEnd === undefined) return false;
  return qualification.yearStart <= year && qualification.yearEnd >= year;
}

function isFieldProperty(property: CbsDataProperty): boolean {
  return Boolean(property.Key) && property.Type !== "TopicGroup";
}

function mapDatatype(datatype?: string): DatasetVariable["type"] {
  if (datatype === "String") return "String";
  if (datatype === "Boolean") return "Boolean";
  if (datatype === "DateTime") return "Date";
  if (datatype === "Long" || datatype === "Integer") return "Integer";
  return "Float";
}

function toPreviewColumns(properties: CbsDataProperty[]): DatasetPreviewColumn[] {
  const fields = properties.filter(isFieldProperty);
  const dimensions = fields.filter((property) => property.Type.includes("Dimension") || property.Type.includes("Geo"));
  const topics = fields.filter((property) => property.Type === "Topic");
  const selected = [...dimensions, ...topics].slice(0, 10);

  return selected.map((property) => ({
    key: property.Key,
    title: property.Title || property.Key,
    type: property.Datatype ?? property.Type,
    unit: property.Unit,
  }));
}

function findGeographyColumn(columns: DatasetPreviewColumn[]): DatasetPreviewColumn | undefined {
  return columns.find((column) => column.type.includes("Geo") || GEOGRAPHY_FIELD_KEYS.includes(column.key));
}

function findProperty(properties: CbsDataProperty[], matcher: (property: CbsDataProperty) => boolean): CbsDataProperty | undefined {
  return properties.find((property) => property.Key && matcher(property));
}

function normalizeCell(value: unknown): string | number | boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

function normalizeLookupKey(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function extractYear(value: string | null | undefined): number | undefined {
  const match = value?.match(/(?:19|20)\d{2}/);
  if (!match) return undefined;
  const year = Number(match[0]);
  return year >= 1970 && year <= 2026 ? year : undefined;
}

function extractYears(value: string): number[] {
  return Array.from(value.matchAll(/(?:19|20)\d{2}/g))
    .map((match) => Number(match[0]))
    .filter((year) => year >= 1970 && year <= 2026);
}

function expandYearRange(years: number[]): number[] {
  if (years.length < 2) return years;
  const min = Math.min(...years);
  const max = Math.max(...years);
  if (max - min > 80) return years;
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

function extractPeriodenYears(values: CbsDimensionValue[]): number[] {
  return Array.from(
    new Set(
      values
        .map((value) => Number(value.Key.slice(0, 4)))
        .filter((year) => Number.isInteger(year) && year >= 1970 && year <= 2026)
    )
  ).sort((a, b) => a - b);
}

function spatialCoverageForLevels(levels: GeographicLevel[]): string | undefined {
  const levelSet = new Set(levels);
  if (levelSet.has("country") && levelSet.has("municipality") && levelSet.has("neighborhood")) {
    return "Netherlands — all municipalities, wijken and buurten";
  }
  if (levelSet.has("country") && levelSet.has("province") && levelSet.has("municipality")) {
    return "Netherlands — country, provinces and municipalities";
  }
  if (levelSet.has("province")) return "Netherlands — provinces";
  if (levelSet.has("municipality")) return "Netherlands — municipalities";
  if (levelSet.has("country")) return "Netherlands — country";
  if (levelSet.has("neighborhood")) return "Netherlands — wijken and buurten";
  return undefined;
}

function levelsFromDimensionValues(values: CbsDimensionValue[]): GeographicLevel[] {
  const levelSet = new Set<GeographicLevel>();
  values.forEach((value) => {
    const qualification = qualifyCbsRecord(
      { Geo: value.Key },
      [{ ID: 0, Position: 0, ParentID: null, Type: "GeoDimension", Key: "Geo", Title: "Geo", Description: null }],
      { [normalizeLookupKey(value.Key)]: value }
    );
    if (supportedGeographicLevels.includes(qualification.level)) levelSet.add(qualification.level);
  });
  return Array.from(levelSet);
}

async function getDatasetQualification(dataset: Dataset): Promise<Dataset> {
  try {
    const [properties, recordCount] = await Promise.all([
      cbsStatLineClient.getDataProperties(dataset.id),
      cbsStatLineClient.getTypedDataSetCount(dataset.id).catch(() => undefined),
    ]);
    const timeProperty = findProperty(properties, (property) => property.Key === "Perioden" || property.Type === "TimeDimension");
    const geographyProperty = findProperty(properties, (property) => property.Type.includes("Geo"));
    const [periodValues, geographySamples] = await Promise.all([
      timeProperty
        ? cbsStatLineClient.getDimensionValues(dataset.id, timeProperty.Key, { $top: 5000 }).catch(() => [])
        : Promise.resolve([]),
      geographyProperty
        ? Promise.all(
            [
              `substringof('NL00',Key) or substringof('NL01',Key)`,
              "substringof('PV',Key)",
              "substringof('GM',Key)",
              "substringof('WK',Key) or substringof('BU',Key)",
            ].map((filter) =>
              cbsStatLineClient
                .getDimensionValues(dataset.id, geographyProperty.Key, { $filter: filter, $top: 3 })
                .catch(() => [])
            )
          ).then((groups) => groups.flat())
        : Promise.resolve([]),
    ]);
    const periodenYears = extractPeriodenYears(periodValues);
    const catalogPeriodYears = expandYearRange(extractYears(dataset.records));
    const catalogTextYears = expandYearRange(extractYears(`${dataset.title} ${dataset.description}`));
    const qualifiedYears = periodenYears.length ? periodenYears : catalogPeriodYears.length ? catalogPeriodYears : catalogTextYears;
    const geographicLevels = levelsFromDimensionValues(geographySamples);
    const spatialCoverage = spatialCoverageForLevels(geographicLevels);
    const periodSource = periodenYears.length
      ? "perioden-dimension"
      : catalogPeriodYears.length
        ? "catalog-period"
        : catalogTextYears.length
          ? "catalog-text"
          : "none";
    const evidence = [
      timeProperty ? `Years from CBS ${timeProperty.Key} dimension using first four characters of each key` : "No CBS Perioden dimension found",
      periodSource === "catalog-period" ? "Years expanded from CBS catalog Period" : undefined,
      periodSource === "catalog-text" ? "Years inferred from CBS catalog title/description" : undefined,
      geographyProperty ? `Levels from CBS dimension ${geographyProperty.Key}` : "No CBS geography dimension found",
      spatialCoverage ? `Spatial coverage: ${spatialCoverage}` : undefined,
      recordCount !== undefined ? "Record count from TypedDataSet/$count" : "Record count unavailable",
    ].filter((item): item is string => Boolean(item));

    return {
      ...dataset,
      recordCount,
      records: recordCount !== undefined ? compactNumber(recordCount) : dataset.records,
      qualification: {
        yearStart: qualifiedYears.length ? Math.min(...qualifiedYears) : undefined,
        yearEnd: qualifiedYears.length ? Math.max(...qualifiedYears) : undefined,
        years: qualifiedYears,
        geographicLevels,
        spatialCoverage,
        periodSource,
        confidence: timeProperty || geographyProperty ? "cbs-metadata" : qualifiedYears.length ? "partial-metadata" : "unqualified",
        evidence,
      },
    };
  } catch {
    return dataset;
  }
}

async function qualifyDatasets(datasets: Dataset[]): Promise<Dataset[]> {
  return Promise.all(datasets.map((dataset) => getDatasetQualification(dataset)));
}

async function getDimensionLookup(
  datasetId: string,
  geographyColumn: DatasetPreviewColumn | undefined,
  rows: Array<Record<string, unknown>>
): Promise<Record<string, CbsDimensionValue>> {
  if (!geographyColumn) return {};
  const keys = Array.from(new Set(rows.map((row) => normalizeLookupKey(row[geographyColumn.key])).filter(Boolean)));
  if (keys.length === 0) return {};

  const values = await Promise.all(
    keys.map((key) =>
      cbsStatLineClient
        .getDimensionValues(datasetId, geographyColumn.key, {
          $filter: `Key eq ${toODataString(String(rows.find((row) => normalizeLookupKey(row[geographyColumn.key]) === key)?.[geographyColumn.key] ?? key))}`,
          $top: 1,
        })
        .catch(() => [])
    )
  );

  return values.flat().reduce<Record<string, CbsDimensionValue>>((acc, value) => {
    acc[normalizeLookupKey(value.Key)] = value;
    return acc;
  }, {});
}

export const datasetService = {
  async getAllDatasets(): Promise<Dataset[]> {
    if (supabaseDatasetRepository.isConfigured()) {
      const cached = await supabaseDatasetRepository.searchDatasets("").catch(() => []);
      if (cached.length > 0) return cached;
    }

    const tables = await cbsStatLineClient.getTables({
      $select: ["Identifier", "Title", "ShortTitle", "ShortDescription", "Updated", "Period", "Language", "Catalog"],
      $filter: "Language eq 'nl'",
      $top: 60,
    });
    return qualifyDatasets(tables.map(mapTable).slice(0, 24));
  },

  async getDatasetById(id: string): Promise<Dataset | undefined> {
    if (supabaseDatasetRepository.isConfigured()) {
      const cached = await supabaseDatasetRepository.getDatasetById(id).catch(() => undefined);
      if (cached) return cached;
    }

    const tables = await cbsStatLineClient.getTables({
      $select: ["Identifier", "Title", "ShortTitle", "ShortDescription", "Updated", "Period", "Language", "Catalog"],
      $filter: `Identifier eq '${id.replace(/'/g, "''")}'`,
      $top: 1,
    });
    return tables[0] ? getDatasetQualification(mapTable(tables[0])) : undefined;
  },

  async searchDatasets(query: string, tags: string[]): Promise<Dataset[]> {
    if (query.trim()) {
      if (supabaseDatasetRepository.isConfigured()) {
        const cached = await supabaseDatasetRepository.searchDatasets(query).catch(() => []);
        const taggedCache = tags.length === 0 ? cached : cached.filter((dataset) => tags.some((tag) => dataset.tags.includes(tag)));
        if (taggedCache.length > 0) return taggedCache;
      }

      const year = queryYear(query);
      const tokens = query
        .trim()
        .split(/\s+/)
        .map((token) => token.replace(/[^\p{L}\p{N}-]/gu, ""))
        .filter((token) => token.length > 2)
        .slice(0, 5);
      const searchTerms = tokens.length > 0 ? tokens : [query.trim()];
      const textFilters = searchTerms.flatMap((term) => {
        const escaped = escapeODataString(term);
        return [
          `substringof('${escaped}',Title)`,
          `substringof('${escaped}',ShortTitle)`,
          `substringof('${escaped}',ShortDescription)`,
          `substringof('${escaped}',Period)`,
        ];
      });
      const tables = await cbsStatLineClient.getTables({
        $select: ["Identifier", "Title", "ShortTitle", "ShortDescription", "Updated", "Period", "Language", "Catalog"],
        $filter: `Language eq 'nl' and (${textFilters.join(" or ")})`,
        $top: 60,
      });
      const shouldIncludeKerncijfers =
        query.toLowerCase().includes("kerncijfers") &&
        query.toLowerCase().includes("wijken") &&
        query.toLowerCase().includes("buurten");
      const exactTables = shouldIncludeKerncijfers
        ? await cbsStatLineClient.getTables({
            $filter: "Identifier eq '85039NED'",
            $top: 1,
          })
        : [];
      const uniqueTables = [...exactTables, ...tables].filter(
        (table, index, all) => all.findIndex((candidate) => candidate.Identifier === table.Identifier) === index
      );
      const mapped = rankDatasets(uniqueTables.map(mapTable), query);
      const tagged = tags.length === 0 ? mapped : mapped.filter((dataset) => tags.some((tag) => dataset.tags.includes(tag)));
      const qualified = await qualifyDatasets(tagged.slice(0, year ? 40 : 24));
      return year ? qualified.filter((dataset) => datasetCoversYear(dataset, year)).slice(0, 24) : qualified;
    }

    const all = await this.getAllDatasets();
    return all.filter((d) => {
      const matchSearch =
        !query ||
        d.title.toLowerCase().includes(query.toLowerCase()) ||
        d.description.toLowerCase().includes(query.toLowerCase());
      const matchTags = tags.length === 0 || tags.some((tag) => d.tags.includes(tag));
      return matchSearch && matchTags;
    });
  },

  async getDetailPreview(datasetId = "85039NED"): Promise<DatasetPreview> {
    const [properties, totalRecordCount] = await Promise.all([
      cbsStatLineClient.getDataProperties(datasetId),
      cbsStatLineClient.getTypedDataSetCount(datasetId).catch(() => 0),
    ]);
    const columns = toPreviewColumns(properties);
    const geographyColumn = findGeographyColumn(columns);
    const select = columns.map((column) => column.key);
    const response = geographyColumn
      ? {
          value: (
            await Promise.all(
              [
                { filter: `substringof('NL00',${geographyColumn.key}) or substringof('NL01',${geographyColumn.key})`, top: 1 },
                { filter: `substringof('PV',${geographyColumn.key})`, top: 12 },
                { filter: `substringof('GM',${geographyColumn.key})`, top: 24 },
              ].map(({ filter, top }) =>
                cbsStatLineClient
                  .getTypedDataSet<Record<string, unknown>>(datasetId, {
                    $select: select,
                    $filter: filter,
                    $top: top,
                  })
                  .catch(() => ({ value: [] }))
              )
            )
          ).flatMap((levelResponse) => levelResponse.value),
        }
      : await cbsStatLineClient.getTypedDataSet<Record<string, unknown>>(datasetId, {
          $select: select,
          $top: PREVIEW_ROW_LIMIT,
        });
    const rows = response.value.length > 0
      ? response.value
      : (await cbsStatLineClient.getTypedDataSet<Record<string, unknown>>(datasetId, {
          $select: select,
          $top: PREVIEW_ROW_LIMIT,
        })).value;
    const dimensionLookup = await getDimensionLookup(datasetId, geographyColumn, rows);
    const qualifiedRows = rows.map((row) => ({
      row,
      qualification: qualifyCbsRecord(row, properties, dimensionLookup),
    }));
    const displayRows = qualifiedRows.some(({ qualification }) => supportedGeographicLevels.includes(qualification.level))
      ? qualifiedRows.filter(({ qualification }) => supportedGeographicLevels.includes(qualification.level)).slice(0, PREVIEW_ROW_LIMIT)
      : qualifiedRows.slice(0, PREVIEW_ROW_LIMIT);
    const qualifications = displayRows.map(({ qualification }) => qualification);

    return {
      columns: [GEOGRAPHY_LEVEL_COLUMN, GEOGRAPHY_SOURCE_COLUMN, ...columns],
      geographySummary: { ...EMPTY_LEVEL_SUMMARY, ...summarizeGeographicLevels(qualifications) },
      totalRecordCount,
      rows: displayRows.map(({ row }, index) =>
        columns.reduce<Record<string, string | number | boolean | null>>((acc, column) => {
          acc[GEOGRAPHY_LEVEL_COLUMN.key] = qualifications[index]?.label ?? "Other geography";
          acc[GEOGRAPHY_SOURCE_COLUMN.key] = qualifications[index]?.source ?? "none";
          acc[column.key] = normalizeCell(row[column.key]);
          return acc;
        }, {})
      ),
    };
  },

  async getDetailVariables(datasetId = "85039NED"): Promise<DatasetVariable[]> {
    const properties = await cbsStatLineClient.getDataProperties(datasetId);
    return properties
      .filter(isFieldProperty)
      .map((property: CbsDataProperty) => ({
        name: property.Key,
        title: property.Title,
        type: mapDatatype(property.Datatype),
        descKey: property.Description || property.Title,
        unit: property.Unit,
        role: property.Type,
      }));
  },

  getDetailSuggestedJoins() {
    return [];
  },

  getVariableDescription(key: string): string {
    return key;
  },
};
