export type SemanticObjectType = "dataset" | "measure" | "geography" | "category" | "analysis" | "evidence";

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
  measure_key?: number;
  measure_label?: string;
  year?: number;
  geography_names?: string[];
  limit?: number;
  explanation: string[];
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
}
