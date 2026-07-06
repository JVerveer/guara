/**
 */

import { cbsStatLineClient } from "@/data/bronze/clients/cbsStatLineClient";
import type { Connector } from "../types";

let cachedConnectors: Connector[] | null = null;

export const connectorService = {
  async getAllConnectors(): Promise<Connector[]> {
    if (cachedConnectors) return cachedConnectors;

    const tables = await cbsStatLineClient.getTables({
      $select: ["Identifier"],
      $filter: "Language eq 'nl'",
    });

    cachedConnectors = [
      {
        id: "cbs",
        name: "CBS",
        fullName: "Centraal Bureau voor de Statistiek",
        abbr: "CBS",
        datasets: tables.length,
        lastSync: new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
        coverage: "Netherlands",
        reliability: 100,
        tags: ["Demographics", "Economy", "Housing"],
        brandColor: "#1C3D8F",
      },
    ];

    return cachedConnectors;
  },

  async getConnectorById(id: string): Promise<Connector | undefined> {
    const all = await this.getAllConnectors();
    return all.find((c) => c.id === id);
  },

  async getTotalDatasetCount(): Promise<number> {
    const connectors = await this.getAllConnectors();
    return connectors.reduce((sum, c) => sum + c.datasets, 0);
  },

  async getConnectorCount(): Promise<number> {
    const connectors = await this.getAllConnectors();
    return connectors.length;
  },
};
