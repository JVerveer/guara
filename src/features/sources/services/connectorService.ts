/**
 * Connector service — delegates to the Gold connector model.
 *
 * All connector data flows: Gold model → this service → useConnectors hook → UI.
 * No feature component or hook imports from src/data/gold directly.
 */

import { getConnectors } from "../data/sources";
import type { Connector } from "../types";

export const connectorService = {
  /**
   * Returns all registered data connectors from the Gold model.
   *
   * TODO: When the backend is ready, replace getConnectors() with:
   * ```
   * return apiClient.get<Connector[]>('/connectors');
   * ```
   */
  async getAllConnectors(): Promise<Connector[]> {
    return Promise.resolve(getConnectors());
  },

  async getConnectorById(id: string): Promise<Connector | undefined> {
    const all = await this.getAllConnectors();
    return all.find((c) => c.id === id);
  },

  getTotalDatasetCount(): number {
    return getConnectors().reduce((sum, c) => sum + c.datasets, 0);
  },

  getConnectorCount(): number {
    return getConnectors().length;
  },
};
