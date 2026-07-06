/**
 * Dataset service — API contract for fetching and searching datasets.
 *
 */

import { cbsStatLineClient } from "@/data/bronze/clients/cbsStatLineClient";
import type { CbsCatalogTable, CbsDataProperty, CbsWijkBuurtRecord } from "@/data/bronze/schema/cbs";
import type { Dataset } from "../types";

const CBS_TAGS = ["Population", "Housing", "Economy"];

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

export const datasetService = {
  async getAllDatasets(): Promise<Dataset[]> {
    const tables = await cbsStatLineClient.getTables({
      $select: ["Identifier", "Title", "ShortTitle", "ShortDescription", "Updated", "Period", "Language", "Catalog"],
      $filter: "Language eq 'nl'",
      $top: 60,
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

  async getDetailPreviewRows() {
    const rows = await cbsStatLineClient.getWijkBuurtMunicipalityFacts({
      municipalityCodes: ["GM0363", "GM0599", "GM0344", "GM0518", "GM0772"],
      select: [
        "ID",
        "WijkenEnBuurten",
        "Gemeentenaam_1",
        "AantalInwoners_5",
        "GemiddeldeWOZWaardeVanWoningen_35",
        "GemiddeldInkomenPerInwoner_72",
      ],
    });
    return rows.map((row: CbsWijkBuurtRecord) => ({
      muni: row.Gemeentenaam_1.trim(),
      year: 2021,
      pop: row.AantalInwoners_5 ?? 0,
      income: Math.round((row.GemiddeldInkomenPerInwoner_72 ?? 0) * 1000),
      woz: (row.GemiddeldeWOZWaardeVanWoningen_35 ?? 0) * 1000,
    }));
  },

  async getDetailVariables() {
    const properties = await cbsStatLineClient.getDataProperties("85039NED", {
      $select: ["Key", "Title", "Datatype", "Description"],
    });
    return properties
      .filter((property: CbsDataProperty) => property.Key)
      .slice(0, 16)
      .map((property: CbsDataProperty) => ({
        name: property.Key,
        type: property.Datatype === "String" ? "String" as const : "Float" as const,
        descKey: property.Description || property.Title,
      }));
  },

  getDetailSuggestedJoins() {
    return [];
  },

  getVariableDescription(key: string): string {
    return key;
  },
};
