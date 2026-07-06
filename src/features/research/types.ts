/**
 * Domain types for the Research feature.
 *
 * A ResearchQuery represents a user's research session — the question they
 * asked and the structured result Atlas produced (sources, confidence, etc.).
 */

export interface EvidenceSource {
  provider: string;
  dataset: string;
  confidence: number;
  variables: string[];
}

export interface AnswerPoint {
  titleKey: string;
  bodyKey: string;
  cite: number;
}

/** The structured result returned for a research question */
export interface ResearchQuery {
  question: string;
  sourceCount: number;
  confidenceScore: number;
  evidenceSources: EvidenceSource[];
}

export interface HousePriceDataPoint {
  year: string;
  Amsterdam: number;
  Utrecht: number;
  Rotterdam: number;
}

export interface AgingDataPoint {
  municipality: string;
  pct: number;
}
