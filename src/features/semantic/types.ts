export type SemanticObjectType = "dataset" | "measure" | "metric" | "geography" | "category" | "dimension_value" | "analysis" | "evidence";

export type SemanticIntent =
  | "catalogue_search"
  | "dataset_lookup"
  | "measure_definition"
  | "rank_geographies"
  | "compare_geographies"
  | "trend";

export interface SemanticSearchResult {
  catalogue_item_id: string;
  object_type: SemanticObjectType;
  object_id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  dataset_code: string | null;
  measure_code: string | null;
  geography_code: string | null;
  unit_code: string | null;
  domain_id: string | null;
  provider: string | null;
  rank_score: number;
  lexical_score: number;
  vector_score: number;
  metadata: Record<string, unknown>;
}

export interface SemanticQueryPlan {
  intent: SemanticIntent;
  source: "semantic_catalogue" | "gold_bouwen_wonen";
  measure_key?: string;
  secondary_measure_key?: string;
  metric_id?: string;
  metric_code?: string;
  semantic_concept_code?: string;
  semantic_concept_label?: string;
  calculation_code?: string;
  measure_label?: string;
  secondary_measure_label?: string;
  year?: number;
  year_start?: number;
  year_end?: number;
  geography_names?: string[];
  geography_type?: string;
  excluded_geography_names?: string[];
  value_filter_operator?: "lt" | "lte" | "gt" | "gte";
  value_filter?: number;
  dataset_code?: string;
  grain?: {
    geography_type: string;
    period_type: "year";
    display_grain: string;
  };
  period_type?: "year";
  expected_result_grain?: string[];
  semantic_confidence?: number;
  resolution_method?: "semantic_contract_engine" | "semantic_registry" | "semantic_concept" | "curated_contract" | "generated_contract" | "metric_preference" | "catalogue_exact_match" | "catalogue_lexical_match" | "unsafe_fallback";
  category_dimension_code?: string;
  category_filter_dimension_code?: string;
  category_filter_value?: string;
  category_filters?: Record<string, string>;
  contract_status?: string;
  profile_depth?: string;
  sort_direction?: "asc" | "desc";
  requires_clarification?: "geography" | "period";
  limit?: number;
  warnings?: string[];
  semantic_model_diagnostics?: {
    status: "valid" | "invalid" | "low_confidence";
    errors: string[];
    warnings: string[];
    checks: Record<string, unknown>;
  };
  explanation: string[];
}

export interface SemanticFollowUpQuestion {
  label: string;
  question: string;
  reason: string;
  status: "answerable_now" | "requires_more_data";
  required_domains: string[];
  confidence: number;
}

export interface SemanticRelatedDataset {
  dataset_code: string;
  title: string;
  reason: string;
  provider: string | null;
  relationship: "source" | "same_domain" | "same_metric_family" | "next_investigation_step";
}

export interface SemanticCaveat {
  severity: "info" | "warning" | "gap";
  message: string;
}

export interface SemanticWorkspaceHandoff {
  title: string;
  question: string;
  recommended_workspace: "trigger" | "orientation" | "hypotheses" | "evidence" | "data" | "entities" | "timeline" | "gaps" | "verification";
  context: Record<string, unknown>;
}

export interface SemanticAvailabilityOption {
  kind: "year" | "geography_type";
  label: string;
  value: string;
  question: string;
  is_current: boolean;
}

export interface SemanticAnswerEnrichment {
  follow_up_questions: SemanticFollowUpQuestion[];
  related_datasets: SemanticRelatedDataset[];
  caveats: SemanticCaveat[];
  next_operators: string[];
  availability_options: SemanticAvailabilityOption[];
  workspace_handoff: SemanticWorkspaceHandoff;
}

export interface SemanticAnswer {
  question: string;
  intent: SemanticIntent;
  answerId: string | null;
  title: string;
  summary: string;
  bullets: string[];
  confidence: number;
  searchResults: SemanticSearchResult[];
  queryPlan: SemanticQueryPlan;
  executionResult: Record<string, unknown>;
  provenance: string[];
  enrichment?: SemanticAnswerEnrichment;
}
