/**
 * Domain types for the Research feature.
 *
 * A ResearchQuery represents a user's research session — the question they
 * asked and the structured result Guara produced (sources, confidence, etc.).
 */

export interface EvidenceSource {
  provider: string;
  dataset: string;
  confidence: number;
  variables: string[];
  provenance?: string;
  api?: string;
  transformation?: string;
}

export interface FollowUpQuestion {
  label: string;
  question: string;
  reason: string;
  status: "answerable_now" | "requires_more_data";
  requiredDomains: string[];
  confidence: number;
}

export interface RelatedDataset {
  datasetCode: string;
  title: string;
  reason: string;
  provider: string | null;
  relationship: string;
}

export interface AnswerCaveat {
  severity: "info" | "warning" | "gap";
  message: string;
}

export interface WorkspaceHandoff {
  title: string;
  question: string;
  recommendedWorkspace: string;
  context: Record<string, unknown>;
}

export interface AvailabilityOption {
  kind: "year" | "geography_type";
  label: string;
  value: string;
  question: string;
  isCurrent: boolean;
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
  answerTitle: string;
  answerSummary: string;
  answerBullets: string[];
  answerId?: string | null;
  intent?: string;
  queryPlan?: Record<string, unknown>;
  provenance?: string[];
  followUpQuestions?: FollowUpQuestion[];
  relatedDatasets?: RelatedDataset[];
  caveats?: AnswerCaveat[];
  nextOperators?: string[];
  availabilityOptions?: AvailabilityOption[];
  workspaceHandoff?: WorkspaceHandoff;
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
