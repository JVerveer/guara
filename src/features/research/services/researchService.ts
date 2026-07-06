/**
 * Research service — uses Gold layer models for all data.
 *
 * UI components and hooks call this service; they never import from
 * src/data/gold directly. That keeps the feature decoupled from the
 * data pipeline internals.
 */

import { getHousePriceData, getAgingData } from "../data/chartData";
import type {
  AgingDataPoint,
  EvidenceSource,
  HousePriceDataPoint,
  ResearchQuery,
} from "../types";

const CBS_EVIDENCE_SOURCES: EvidenceSource[] = [
  {
    provider: "CBS",
    dataset: "70072NED Regionale kerncijfers Nederland",
    confidence: 100,
    variables: ["Population", "Municipality", "Age", "Period", "Average WOZ value"],
  },
];

const CBS_RESULT: ResearchQuery = {
  question: "Why are house prices rising faster in Utrecht?",
  sourceCount: CBS_EVIDENCE_SOURCES.length,
  confidenceScore: 100,
  evidenceSources: CBS_EVIDENCE_SOURCES,
};

export const researchService = {
  /**
   * Returns a structured result for a research question.
   *
   */
  async getResult(_question?: string): Promise<ResearchQuery> {
    return Promise.resolve(CBS_RESULT);
  },

  async getEvidenceSources(): Promise<EvidenceSource[]> {
    return Promise.resolve(CBS_EVIDENCE_SOURCES);
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
