/**
 * Dataset service — API contract for fetching and searching datasets.
 *
 * All methods return Promises. Swap the mock implementations for real
 * API calls without touching the callers.
 *
 * API integration points are marked with TODO comments.
 */

import {
  allDatasets,
  datasetDetailPreviewRows,
  datasetDetailSuggestedJoins,
  datasetDetailVariables,
  variableDescriptions,
} from "../data/datasets";
import type { Dataset } from "../types";

export const datasetService = {
  /**
   * Returns all available datasets.
   *
   * TODO: Replace with real API call:
   * ```
   * return apiClient.get<Dataset[]>('/datasets');
   * ```
   */
  async getAllDatasets(): Promise<Dataset[]> {
    return Promise.resolve(allDatasets);
  },

  /**
   * Returns a single dataset by ID.
   *
   * TODO: Replace with real API call:
   * ```
   * return apiClient.get<Dataset>(`/datasets/${id}`);
   * ```
   */
  async getDatasetById(id: string): Promise<Dataset | undefined> {
    return Promise.resolve(allDatasets.find((d) => d.id === id));
  },

  /**
   * Filters datasets by full-text query and tag list.
   * In production this becomes a server-side search endpoint.
   *
   * TODO: Replace with real API call:
   * ```
   * return apiClient.get<Dataset[]>('/datasets/search', { params: { q: query, tags } });
   * ```
   */
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

  // ── Detail-level data for the featured dataset (CBS-wijken) ────────────────

  getDetailPreviewRows() {
    return datasetDetailPreviewRows;
  },

  getDetailVariables() {
    return datasetDetailVariables;
  },

  getDetailSuggestedJoins() {
    return datasetDetailSuggestedJoins;
  },

  getVariableDescription(key: string): string {
    return variableDescriptions[key] ?? key;
  },
};
