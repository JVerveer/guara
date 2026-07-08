import type { Dataset, DatasetPreview, DatasetVariable, SuggestedJoin } from "../types";
import { supabaseDatasetRepository } from "./supabaseDatasetRepository";

const EMPTY_PREVIEW: DatasetPreview = {
  columns: [],
  rows: [],
  geographySummary: {
    neighborhood: 0,
    municipality: 0,
    province: 0,
    country: 0,
    other: 0,
  },
  totalRecordCount: 0,
};

function filterByTags(datasets: Dataset[], tags: string[]): Dataset[] {
  if (tags.length === 0) return datasets;
  return datasets.filter((dataset) => tags.some((tag) => dataset.tags.includes(tag)));
}

async function fromSupabase<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
  if (!supabaseDatasetRepository.isConfigured()) return fallback;
  try {
    return await operation();
  } catch (error) {
    console.warn("Supabase dataset read failed", error);
    return fallback;
  }
}

export const datasetService = {
  async getAllDatasets(): Promise<Dataset[]> {
    return fromSupabase(() => supabaseDatasetRepository.searchDatasets(""), []);
  },

  async getDatasetById(id: string): Promise<Dataset | undefined> {
    return fromSupabase(() => supabaseDatasetRepository.getDatasetById(id), undefined);
  },

  async searchDatasets(query: string, tags: string[]): Promise<Dataset[]> {
    const datasets = await fromSupabase(() => supabaseDatasetRepository.searchDatasets(query), []);
    return filterByTags(datasets, tags);
  },

  async getDetailPreview(datasetId: string): Promise<DatasetPreview> {
    return fromSupabase(() => supabaseDatasetRepository.getDetailPreview(datasetId), EMPTY_PREVIEW);
  },

  async getDetailVariables(datasetId: string): Promise<DatasetVariable[]> {
    return fromSupabase(() => supabaseDatasetRepository.getDetailVariables(datasetId), []);
  },

  getDetailSuggestedJoins(): SuggestedJoin[] {
    return [];
  },

  getVariableDescription(key: string): string {
    return key;
  },
};
