import type { Dataset } from "@/features/datasets/types";

export interface DetectedEntity {
  id: string;
  label: string;
  type: "municipality" | "province" | "organization" | "political-party" | "topic";
}

export interface DetectedConcept {
  id: string;
  label: string;
  matchedTerms: string[];
}

export interface PlannedDataset {
  dataset: Dataset;
  reason: string;
  selectedVariables: string[];
}

export interface ResearchPlan {
  question: string;
  entities: DetectedEntity[];
  concepts: DetectedConcept[];
  hypotheses: string[];
  datasets: PlannedDataset[];
  expectedConfidence: number;
  strategy: string[];
}

export interface EvidenceItem {
  id: string;
  statement: string;
  source: string;
  dataset: string;
  variables: string[];
  transformation: string;
  confidence: number;
  api: string;
  lastUpdated: string;
  license: string;
  provenance: string;
}

export interface InvestigationState {
  plan: ResearchPlan;
  selectedMunicipalityId: string | null;
  selectedDatasetId: string | null;
  selectedConceptId: string | null;
  comparedMunicipalityIds: string[];
  notes: string;
}
