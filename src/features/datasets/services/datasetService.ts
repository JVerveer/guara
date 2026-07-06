/**
 * Dataset service — API contract for fetching and searching datasets.
 *
 */

import { cbsStatLineClient } from "@/data/bronze/clients/cbsStatLineClient";
import type { CbsCatalogTable, CbsDataProperty } from "@/data/bronze/schema/cbs";
import type { Dataset, DatasetPreview, DatasetPreviewColumn, DatasetVariable } from "../types";

const CBS_TAGS = ["Population", "Housing", "Economy"];

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
    records: table.Period ?? "StatLine",
    topics: 0,
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

function normalizeCell(value: unknown): string | number | boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

export const datasetService = {
  async getAllDatasets(): Promise<Dataset[]> {
    const tables = await cbsStatLineClient.getTables({
      $select: ["Identifier", "Title", "ShortTitle", "ShortDescription", "Updated", "Period", "Language", "Catalog"],
      $filter: "Language eq 'nl'",
    });
    return tables.map(mapTable);
  },

  async getDatasetById(id: string): Promise<Dataset | undefined> {
    const tables = await cbsStatLineClient.getTables({
      $select: ["Identifier", "Title", "ShortTitle", "ShortDescription", "Updated", "Period", "Language", "Catalog"],
      $filter: `Identifier eq '${id.replace(/'/g, "''")}'`,
      $top: 1,
    });
    return tables[0] ? mapTable(tables[0]) : undefined;
  },

  async searchDatasets(query: string, tags: string[]): Promise<Dataset[]> {
    if (query.trim()) {
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
      return tags.length === 0 ? mapped : mapped.filter((dataset) => tags.some((tag) => dataset.tags.includes(tag)));
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
    const properties = await cbsStatLineClient.getDataProperties(datasetId);
    const columns = toPreviewColumns(properties);
    const response = await cbsStatLineClient.getTypedDataSet<Record<string, unknown>>(datasetId, {
      $select: columns.map((column) => column.key),
      $top: 8,
    });

    return {
      columns,
      rows: response.value.map((row) =>
        columns.reduce<Record<string, string | number | boolean | null>>((acc, column) => {
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
