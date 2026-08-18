import { getSupabaseClient, isSupabaseConfigured } from "@/data/supabase/client";

export type SemanticReviewStatus = "generated" | "profiled" | "review_candidate" | "needs_fix" | "promoted" | "deprecated";

export interface SemanticMetricReview {
  review_id: string;
  metric_code: string;
  domain_id: string;
  dataset_code: string;
  measure_key: string;
  measure_code: string | null;
  label: string;
  review_status: SemanticReviewStatus | string;
  execution_recommendation: string;
  risk_level: "low" | "medium" | "high" | "unknown" | string;
  priority_score: number;
  diagnostic_summary: Record<string, unknown>;
  suggested_contract: Record<string, unknown>;
  source_capability: Record<string, unknown>;
  reviewed_by: string | null;
  reviewed_at: string | null;
  promoted_at: string | null;
  updated_at: string;
}

export interface SemanticMetricDiagnostic {
  diagnostic_id: number;
  review_id: string | null;
  metric_code: string;
  diagnostic_code: string;
  severity: "error" | "warning" | "info" | string;
  message: string;
  is_blocking: boolean;
  metadata: Record<string, unknown>;
}

export interface SemanticMetricTestCase {
  metric_contract_test_case_id: number;
  metric_code: string;
  review_id: string | null;
  question: string;
  language_code: string;
  expected_intent: string;
  expected_source: string | null;
  expected_metric_code: string | null;
  expected_dataset_code: string | null;
  expected_grain: string | null;
  expected_year: number | null;
  should_execute: boolean;
  generation_status: string;
  last_run_status: string | null;
  last_run_at: string | null;
  metadata: Record<string, unknown>;
}

export interface SemanticPromotionEvent {
  promotion_event_id: number;
  metric_code: string;
  review_id: string | null;
  from_status: string | null;
  to_status: string;
  from_execution_status: string | null;
  to_execution_status: string;
  promoted_by: string | null;
  event_reason: string | null;
  created_at: string;
}

export interface SemanticWorkbenchFilters {
  domain?: string;
  status?: string;
  risk?: string;
  query?: string;
  limit?: number;
}

export interface SemanticWorkbenchData {
  reviews: SemanticMetricReview[];
  diagnostics: SemanticMetricDiagnostic[];
  testCases: SemanticMetricTestCase[];
  promotionEvents: SemanticPromotionEvent[];
}

export interface SemanticCatalogueItem {
  domain_id: string;
  dataset_code: string;
  dataset_title: string | null;
  measure_key: string;
  measure_code: string | null;
  measure_name: string;
  measure_description: string | null;
  unit_code: string | null;
  unit_name: string | null;
  default_aggregation: string | null;
  value_type: string | null;
  is_additive: boolean | null;
  is_non_additive: boolean | null;
  populated_fact_rows: number;
  loaded_fact_rows: number;
  fact_row_count_status: "counted" | "available_not_counted" | "no_facts_found" | string;
  min_year: number | null;
  max_year: number | null;
  available_years: number[];
  geography_types: string[];
  grains: string[];
  supports_ranking: boolean;
  supports_trend: boolean;
  supports_comparison: boolean;
  executable_candidate: boolean;
  non_executable_reasons: string[];
  source_system: string | null;
  source_organization: string | null;
  source_url: string | null;
  last_updated_at_source: string | null;
  gold_loaded_at: string | null;
  metric_code: string | null;
  contract_status: string | null;
  execution_status: string | null;
  semantic_quality_status: string | null;
  metadata_origin: string | null;
  default_grain: string | null;
  valid_grains: string[] | null;
  supports: Record<string, unknown> | null;
  review_status: string | null;
  risk_level: string | null;
  execution_recommendation: string | null;
  priority_score: number | null;
  diagnostic_summary: Record<string, unknown> | null;
  approval_status: string;
  metadata: Record<string, unknown>;
}

export interface SemanticCatalogueData {
  items: SemanticCatalogueItem[];
  summary: Record<string, number>;
}

export interface SemanticDimensionValue {
  dimension_code: string;
  category_code: string | null;
  category_name: string;
  row_count: number;
  min_year: number | null;
  max_year: number | null;
  value_rank: number;
}

export interface SemanticSampleRow {
  dataset_code: string;
  measure_key: string;
  calendar_year: number | null;
  period_code: string | null;
  geography_type: string | null;
  geography_code: string | null;
  geography_name: string | null;
  observation_value: number | null;
  observation_text: string | null;
  status_code: string | null;
  category_combination_hash: string;
  categories: Record<string, string>;
}

export interface SemanticMetricDetail {
  dimensionValues: SemanticDimensionValue[];
  sampleRows: SemanticSampleRow[];
}

export interface SemanticSandboxRow {
  calendar_year: number | null;
  geography_type: string | null;
  geography_code: string | null;
  geography_name: string | null;
  group_value: string | null;
  row_count: number;
  aggregate_value: number | null;
}

export interface SemanticSandboxResult {
  rows: SemanticSandboxRow[];
  query: Record<string, unknown>;
  sql: string | null;
}

function matchesQuery(row: SemanticMetricReview, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [row.metric_code, row.label, row.dataset_code, row.domain_id, row.measure_code ?? ""].some((value) =>
    value.toLowerCase().includes(normalized)
  );
}

async function fetchReviewQueue(filters: SemanticWorkbenchFilters = {}): Promise<SemanticWorkbenchData> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await (supabase as any).rpc("guara_semantic_review_queue", {
    p_domain: filters.domain && filters.domain !== "all" ? filters.domain : null,
    p_status: filters.status && filters.status !== "all" ? filters.status : null,
    p_risk: filters.risk && filters.risk !== "all" ? filters.risk : null,
    p_query: filters.query?.trim() || null,
    p_limit: filters.limit ?? 150,
  });
  if (error) throw new Error(error.message);

  const payload = (data ?? {}) as Partial<SemanticWorkbenchData>;
  return {
    reviews: ((payload.reviews ?? []) as SemanticMetricReview[]).filter((row) => matchesQuery(row, filters.query ?? "")),
    diagnostics: (payload.diagnostics ?? []) as SemanticMetricDiagnostic[],
    testCases: (payload.testCases ?? []) as SemanticMetricTestCase[],
    promotionEvents: (payload.promotionEvents ?? []) as SemanticPromotionEvent[],
  };
}

async function fetchCatalogue(filters: Pick<SemanticWorkbenchFilters, "domain" | "status" | "query" | "limit"> = {}): Promise<SemanticCatalogueData> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await (supabase as any).rpc("guara_semantic_workbench_catalogue", {
    p_domain: filters.domain && filters.domain !== "all" ? filters.domain : null,
    p_status: filters.status && filters.status !== "all" ? filters.status : null,
    p_query: filters.query?.trim() || null,
    p_limit: filters.limit ?? 300,
  });
  if (error) throw new Error(error.message);
  const payload = (data ?? {}) as Partial<SemanticCatalogueData>;
  return {
    items: (payload.items ?? []) as SemanticCatalogueItem[],
    summary: (payload.summary ?? {}) as Record<string, number>,
  };
}

async function fetchMetricDetail(item: Pick<SemanticCatalogueItem, "domain_id" | "dataset_code" | "measure_key">): Promise<SemanticMetricDetail> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await (supabase as any).rpc("guara_semantic_metric_detail", {
    p_domain: item.domain_id,
    p_dataset_code: item.dataset_code,
    p_measure_key: item.measure_key,
    p_dimension_limit: 5000,
    p_sample_limit: 25,
  });
  if (error) throw new Error(error.message);
  const payload = (data ?? {}) as Partial<SemanticMetricDetail>;
  return {
    dimensionValues: (payload.dimensionValues ?? []) as SemanticDimensionValue[],
    sampleRows: (payload.sampleRows ?? []) as SemanticSampleRow[],
  };
}

async function runAggregationSandbox({
  item,
  year,
  geographyType,
  aggregation,
  categoryFilters,
  groupDimension,
}: {
  item: Pick<SemanticCatalogueItem, "domain_id" | "dataset_code" | "measure_key">;
  year?: number | null;
  geographyType?: string | null;
  aggregation: string;
  categoryFilters: Record<string, string>;
  groupDimension?: string | null;
}): Promise<SemanticSandboxResult> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await (supabase as any).rpc("guara_semantic_aggregation_sandbox", {
    p_domain: item.domain_id,
    p_dataset_code: item.dataset_code,
    p_measure_key: item.measure_key,
    p_calendar_year: year ?? null,
    p_geography_type: geographyType && geographyType !== "all" ? geographyType : null,
    p_aggregation: aggregation,
    p_category_filters: categoryFilters,
    p_group_dimension: groupDimension || null,
    p_limit: 25,
  });
  if (error) throw new Error(error.message);
  const payload = (data ?? {}) as Partial<SemanticSandboxResult>;
  return {
    rows: (payload.rows ?? []) as SemanticSandboxRow[],
    query: (payload.query ?? {}) as Record<string, unknown>,
    sql: typeof payload.sql === "string" ? payload.sql : null,
  };
}

export const semanticWorkbenchService = {
  fetchReviewQueue,
  fetchCatalogue,
  fetchMetricDetail,
  runAggregationSandbox,
};
