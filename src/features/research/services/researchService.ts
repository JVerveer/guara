/**
 * Research service — uses Gold layer models for all data.
 *
 * UI components and hooks call this service; they never import from
 * src/data/gold directly. That keeps the feature decoupled from the
 * data pipeline internals.
 */

import { getHousePriceData, getAgingData } from "../data/chartData";
import { datasetService } from "@/features/datasets/services/datasetService";
import { semanticSearchService } from "@/features/semantic/services/semanticSearchService";
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

    try {
      const semanticAnswer = await semanticSearchService.answer(normalizedQuestion);
      const evidenceSources: EvidenceSource[] = semanticAnswer.searchResults.slice(0, 3).map((item) => ({
        provider: item.provider ?? "CBS",
        dataset: `${item.dataset_code ?? item.object_type} ${item.title}`,
        confidence: Math.round(Math.max(0, Math.min(100, item.rank_score * 100))),
        variables: [item.object_type, item.measure_code, item.unit_code, item.domain_id].filter(Boolean) as string[],
        provenance: `semantic.catalogue_item:${item.catalogue_item_id}`,
        api: item.dataset_code ? `Supabase RPC guara_hybrid_search / dataset ${item.dataset_code}` : "Supabase RPC guara_hybrid_search",
        transformation: "Hybrid lexical/vector catalogue retrieval followed by allowlisted query-plan resolution.",
      }));

      return {
        question: semanticAnswer.question,
        sourceCount: evidenceSources.length,
        confidenceScore: semanticAnswer.confidence,
        evidenceSources,
        answerTitle: semanticAnswer.title,
        answerSummary: semanticAnswer.summary,
        answerBullets: semanticAnswer.bullets,
        answerId: semanticAnswer.answerId,
        intent: semanticAnswer.intent,
        queryPlan: semanticAnswer.queryPlan as unknown as Record<string, unknown>,
        provenance: semanticAnswer.provenance,
      };
    } catch (error) {
      console.warn("Semantic answer failed; falling back to dataset catalogue search.", error);
    }

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
          ? `The answer below is based only on Supabase silver metadata. Guara found ${matches.length} matching silver datasets and listed the strongest matches as evidence.`
          : "No matching silver datasets are available for this query yet. Load the relevant CBS data into silver and refresh the public Supabase projections.",
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
