export type SearchObjectType =
  | "dataset"
  | "metric"
  | "dimension"
  | "dimension_value"
  | "geography"
  | "category"
  | "source"
  | "entity"
  | "document"
  | "evidence"
  | "claim"
  | "hypothesis"
  | "note"
  | "timeline_event"
  | "saved_analysis"
  | "monitoring_alert"
  | "story_section"
  | "task";

export type RequestIntent =
  | "catalogue_search"
  | "definition_question"
  | "data_availability_question"
  | "analytical_lookup"
  | "analytical_ranking"
  | "analytical_trend"
  | "analytical_comparison"
  | "analytical_change"
  | "analytical_share"
  | "entity_lookup"
  | "investigation_search"
  | "unsupported";

export interface IntentClassification {
  intent: RequestIntent;
  confidence: number;
  language: "nl" | "en" | "unknown";
  reason: string;
}

export interface SearchFilters {
  object_type?: SearchObjectType[];
  investigation_id?: string | null;
  dataset_key?: string;
  dataset_code?: string;
  source?: string;
  language?: "nl" | "en";
  geography_type?: string;
  year?: number;
  topic?: string;
  unit?: string;
  updated_after?: string;
}

export interface SearchResult {
  object_type: SearchObjectType;
  object_id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  source_name: string | null;
  dataset_code: string | null;
  rank_score: number;
  result_reason: string;
  matched_terms: string[];
  available_actions: string[];
  score_explanation?: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export type AnalyticalIntent =
  | "lookup"
  | "ranking"
  | "trend"
  | "comparison"
  | "absolute_change"
  | "percentage_change"
  | "share_of_total";

export interface AnalyticalQueryPlan {
  version: "1";
  intent: AnalyticalIntent;
  metricId: string;
  groupBy: Array<{ dimensionId: string }>;
  filters: Array<{
    dimensionId: string;
    operator: "eq" | "neq" | "in" | "not_in" | "gt" | "gte" | "lt" | "lte" | "between";
    values: Array<string | number | boolean>;
  }>;
  timeRange?: {
    startPeriod?: string;
    endPeriod?: string;
    periods?: string[];
  };
  comparison?: {
    basePeriod?: string;
    comparisonPeriod?: string;
    method?: "absolute" | "percentage";
  };
  orderBy?: Array<{ field: string; direction: "asc" | "desc" }>;
  limit?: number;
  includeMissing?: boolean;
}

export interface ExtractedConcepts {
  metricPhrase?: string;
  groupBy: string[];
  dimensionValues: string[];
  geography: string[];
  timeExpression?: { type: "year" | "after" | "before" | "between"; value: number | [number, number] };
  comparisonEntities: string[];
  calculation?: AnalyticalIntent;
  sortDirection?: "asc" | "desc";
  limit?: number;
  normalization?: "total" | "per_capita" | "percentage" | "index";
  unitPreference?: string;
}

export interface Ambiguity {
  field: string;
  question: string;
  options: Array<{ id: string; label: string }>;
}

export interface RankedSemanticCandidate {
  objectType: SearchObjectType;
  objectId: string;
  title: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface QueryWarning {
  type:
    | "definition_change"
    | "coverage_limitation"
    | "partial_period"
    | "missing_values"
    | "suppressed_values"
    | "preliminary_data"
    | "unit_warning"
    | "comparability_warning"
    | "security_limit"
    | "empty_result";
  severity: "info" | "warning" | "blocking";
  message: string;
  sourceReference?: string;
}

export interface StructuredError {
  code: string;
  message: string;
  field?: string;
}

export interface PlanValidationResult {
  status: "valid" | "needs_resolution" | "invalid";
  errors: StructuredError[];
  warnings: QueryWarning[];
  ambiguities: Ambiguity[];
}

export interface CompiledQuery {
  sql: string;
  parameters: unknown[];
  selectedMetricId: string;
  selectedDimensions: string[];
  expectedColumns: Array<{ name: string; type: string }>;
  maxRows: number;
  timeoutMs: number;
}

export interface QueryExecutionResult {
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  durationMs: number;
  warnings: QueryWarning[];
}

export interface ResultValidationResult {
  status: "valid" | "warning" | "invalid";
  warnings: QueryWarning[];
  errors: StructuredError[];
}

export interface GeneratedAnswer {
  title: string;
  summary: string;
  bullets: string[];
  warnings: QueryWarning[];
}
