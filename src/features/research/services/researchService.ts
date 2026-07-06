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

const DEMO_EVIDENCE_SOURCES: EvidenceSource[] = [
  {
    provider: "CBS",
    dataset: "Kerncijfers wijken en buurten 2023",
    confidence: 95,
    variables: ["Population", "Municipality", "Age", "Period"],
  },
  {
    provider: "KNMI",
    dataset: "Historische klimaatdata",
    confidence: 88,
    variables: ["Temperature", "Precipitation", "Region"],
  },
  {
    provider: "Kadaster",
    dataset: "WOZ-waarden per woning",
    confidence: 99,
    variables: ["Address", "WOZ Value", "Year", "Municipality"],
  },
];

const DEMO_RESULT: ResearchQuery = {
  question: "Why are house prices rising faster in Utrecht?",
  sourceCount: DEMO_EVIDENCE_SOURCES.length,
  confidenceScore: 95,
  evidenceSources: DEMO_EVIDENCE_SOURCES,
};

export const researchService = {
  /**
   * Returns a structured result for a research question.
   *
   * TODO: Replace with real API call:
   * ```
   * return apiClient.post<ResearchQuery>('/research/query', { question });
   * ```
   */
  async getResult(_question?: string): Promise<ResearchQuery> {
    return Promise.resolve(DEMO_RESULT);
  },

  async getEvidenceSources(): Promise<EvidenceSource[]> {
    return Promise.resolve(DEMO_EVIDENCE_SOURCES);
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
