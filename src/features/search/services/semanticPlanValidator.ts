import { getSupabaseClient, isSupabaseConfigured } from "@/data/supabase/client";
import { validateAnalyticalQueryPlan } from "./queryPlanValidation";
import type { AnalyticalQueryPlan, PlanValidationResult, QueryWarning, StructuredError } from "../types";

const CALCULATION_BY_INTENT: Record<AnalyticalQueryPlan["intent"], string> = {
  lookup: "lookup",
  ranking: "ranking",
  trend: "trend",
  comparison: "comparison",
  absolute_change: "absolute_change",
  percentage_change: "percentage_change",
  share_of_total: "share_of_total",
};

export async function validateSemanticQueryPlan(plan: unknown): Promise<PlanValidationResult> {
  const syntax = validateAnalyticalQueryPlan(plan);
  if (!syntax.ok) {
    return {
      status: "invalid",
      errors: syntax.errors.map((message) => ({ code: "QUERY_PLAN_INVALID", message })),
      warnings: [],
      ambiguities: [],
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      status: "invalid",
      errors: [{ code: "SUPABASE_NOT_CONFIGURED", message: "Supabase is not configured." }],
      warnings: [],
      ambiguities: [],
    };
  }

  const supabase = await getSupabaseClient();
  const errors: StructuredError[] = [];
  const warnings: QueryWarning[] = [];
  const validatedPlan = syntax.plan;

  const { data: metricRows, error: metricError } = await (supabase as any)
    .schema("semantic")
    .from("metric")
    .select("metric_id, metric_code, metric_label, measure_key, aggregation, unit_key, is_enabled, metadata_completeness_status, is_additive, is_non_additive, supports_time_comparison, supports_geography_comparison")
    .or(`metric_id.eq.${validatedPlan.metricId},metric_code.eq.${validatedPlan.metricId}`)
    .limit(2);

  if (metricError) errors.push({ code: "METRIC_NOT_FOUND", message: "Metric validation failed." });
  const metric = metricRows?.[0];
  if (!metric) errors.push({ code: "METRIC_NOT_FOUND", field: "metricId", message: "Metric does not exist." });
  if (metric && !metric.is_enabled) errors.push({ code: "METRIC_NOT_FOUND", field: "metricId", message: "Metric is not enabled." });
  if (metric && !metric.measure_key) errors.push({ code: "METRIC_NOT_FOUND", field: "metricId", message: "Metric has no Gold measure." });
  if (metric && !metric.aggregation) errors.push({ code: "UNSUPPORTED_CALCULATION", field: "metricId", message: "Metric has no known aggregation." });
  if (metric && !metric.unit_key) errors.push({ code: "QUERY_PLAN_INVALID", field: "metricId", message: "Metric has no valid unit." });
  if (metric?.metadata_completeness_status === "incomplete") {
    warnings.push({ type: "coverage_limitation", severity: "warning", message: "Metric semantic metadata is marked incomplete." });
  }
  if (metric?.is_non_additive && ["ranking", "trend", "comparison"].includes(validatedPlan.intent) && metric.aggregation === "sum") {
    errors.push({ code: "UNSUPPORTED_CALCULATION", field: "metricId", message: "Non-additive metrics cannot be summed by default." });
  }
  if (metric && validatedPlan.intent === "trend" && !metric.supports_time_comparison) {
    errors.push({ code: "INCOMPARABLE_PERIODS", message: "Metric does not support time comparison." });
  }
  if (metric && ["ranking", "comparison"].includes(validatedPlan.intent) && !metric.supports_geography_comparison) {
    errors.push({ code: "DIMENSION_NOT_ALLOWED", message: "Metric does not support geography comparison." });
  }

  const calculationCode = CALCULATION_BY_INTENT[validatedPlan.intent];
  const { data: calculationRows } = await (supabase as any)
    .schema("semantic")
    .from("calculation")
    .select("calculation_code, is_enabled, required_period_count")
    .eq("calculation_code", calculationCode)
    .limit(1);
  const calculation = calculationRows?.[0];
  if (!calculation || !calculation.is_enabled) {
    errors.push({ code: "UNSUPPORTED_CALCULATION", field: "intent", message: "Requested calculation is not enabled." });
  }
  if (calculation?.required_period_count && !validatedPlan.timeRange?.periods && !(validatedPlan.comparison?.basePeriod && validatedPlan.comparison?.comparisonPeriod)) {
    errors.push({ code: "INVALID_TIME_RANGE", field: "timeRange", message: "Calculation requires explicit comparable periods." });
  }

  if (metric) {
    for (const group of validatedPlan.groupBy) {
      const { data: dimensionRows } = await (supabase as any)
        .schema("semantic")
        .from("metric_dimension")
        .select("supports_grouping, dimension:dimension_id(dimension_code, is_enabled)")
        .eq("metric_id", metric.metric_id);
      const match = dimensionRows?.find((row: any) => row.dimension?.dimension_code === group.dimensionId);
      if (!match?.dimension?.is_enabled) errors.push({ code: "DIMENSION_NOT_ALLOWED", field: "groupBy", message: `Dimension ${group.dimensionId} is not enabled.` });
      if (!match?.supports_grouping) errors.push({ code: "DIMENSION_NOT_ALLOWED", field: "groupBy", message: `Metric cannot be grouped by ${group.dimensionId}.` });
    }

    for (const filter of validatedPlan.filters) {
      const { data: dimensionRows } = await (supabase as any)
        .schema("semantic")
        .from("metric_dimension")
        .select("supports_filtering, dimension:dimension_id(dimension_code, is_enabled)")
        .eq("metric_id", metric.metric_id);
      const match = dimensionRows?.find((row: any) => row.dimension?.dimension_code === filter.dimensionId);
      if (!match?.dimension?.is_enabled) errors.push({ code: "DIMENSION_NOT_ALLOWED", field: "filters", message: `Dimension ${filter.dimensionId} is not enabled.` });
      if (!match?.supports_filtering) errors.push({ code: "DIMENSION_NOT_ALLOWED", field: "filters", message: `Metric cannot be filtered by ${filter.dimensionId}.` });
    }
  }

  if ((validatedPlan.limit ?? 20) > 100) {
    errors.push({ code: "QUERY_TOO_EXPENSIVE", field: "limit", message: "Maximum output rows is 100." });
  }

  return {
    status: errors.length ? "invalid" : "valid",
    errors,
    warnings,
    ambiguities: [],
  };
}
