/**
 * Research service — uses Gold layer models for all data.
 *
 * UI components and hooks call this service; they never import from
 * src/data/gold directly. That keeps the feature decoupled from the
 * data pipeline internals.
 */

import { getHousePriceData, getAgingData } from "../data/chartData";
import { datasetService } from "@/features/datasets/services/datasetService";
import type {
  AgingDataPoint,
  EvidenceSource,
  HousePriceDataPoint,
  ResearchQuery,
} from "../types";

export const researchService = {
  /**
   * Returns a structured result for a research question.
   *
   */
  async getResult(question?: string): Promise<ResearchQuery> {
    const normalizedQuestion = question?.trim() || "CBS StatLine datasets";
    const matches = await datasetService.searchDatasets(normalizedQuestion, []);
    const evidenceSources: EvidenceSource[] = matches.slice(0, 3).map((dataset) => ({
      provider: dataset.provider,
      dataset: `${dataset.id} ${dataset.title}`,
      confidence: 100,
      variables: dataset.tags,
    }));

    return {
      question: normalizedQuestion,
      sourceCount: evidenceSources.length,
      confidenceScore: evidenceSources.length > 0 ? 100 : 0,
      evidenceSources,
      answerTitle: `CBS StatLine results for "${normalizedQuestion}"`,
      answerSummary:
        evidenceSources.length > 0
          ? `The answer below is based only on live CBS StatLine catalog results. Atlas found ${matches.length} matching CBS datasets and listed the strongest matches as evidence.`
          : "CBS StatLine did not return matching datasets for this query. Try a Dutch CBS term such as bevolking, inkomen, woningen, gemeente, wijken, or buurten.",
      answerBullets: matches.slice(0, 5).map((dataset) => `${dataset.id}: ${dataset.title}`),
    };
  },

  async getEvidenceSources(): Promise<EvidenceSource[]> {
    const result = await this.getResult();
    return result.evidenceSources;
  },

  /**
   * Returns house price chart data sourced from the Gold pipeline:
   * CBS Bronze → Silver (field mapping + region/period normalization) → Gold (chart-ready)
   */
  async getHousePriceData(): Promise<HousePriceDataPoint[]> {
    return getHousePriceData();
  },

  /**
   * Returns aging-by-municipality data sourced from the Gold pipeline:
   * CBS Bronze → Silver (pct65Plus computed) → Gold (ranked, labelled)
   */
  async getAgingData(): Promise<AgingDataPoint[]> {
    return getAgingData();
  },
};
