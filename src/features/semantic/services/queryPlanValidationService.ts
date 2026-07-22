import type { SemanticQueryPlan, SemanticSearchResult } from "../types";

export interface SemanticPlanValidationResult {
  ok: boolean;
  confidence: number;
  status: "valid" | "invalid" | "low_confidence";
  errors: string[];
  warnings: string[];
  checks: Record<string, unknown>;
}

const MINIMUM_EXECUTION_CONFIDENCE = 0.75;

function normalize(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function selectedMetric(plan: SemanticQueryPlan, matches: SemanticSearchResult[]): SemanticSearchResult | undefined {
  if (!plan.measure_key) return undefined;
  return matches.find((match) => match.metadata?.measure_key != null && String(match.metadata.measure_key) === String(plan.measure_key));
}

function resolutionMethod(metric: SemanticSearchResult | undefined, plan: SemanticQueryPlan): NonNullable<SemanticQueryPlan["resolution_method"]> {
  if (plan.resolution_method) return plan.resolution_method;
  if (metric?.metadata?.resolution_layer === "semantic_concept") return "semantic_concept";
  if (metric?.metadata?.explicit_metric_contract === true && metric.metadata.metadata_origin === "curated") return "curated_contract";
  if (metric?.metadata?.explicit_metric_contract === true) return "generated_contract";
  if ((plan.warnings ?? []).some((warning) => warning.includes("Applied curated metric preference"))) return "metric_preference";
  if (metric && normalize(metric.title) === normalize(plan.measure_label)) return "catalogue_exact_match";
  if (metric) return "catalogue_lexical_match";
  return "unsafe_fallback";
}

function metricConfidence(metric: SemanticSearchResult | undefined, plan: SemanticQueryPlan): number {
  const method = resolutionMethod(metric, plan);
  if (method === "semantic_contract_engine") return 0.97;
  if (method === "semantic_registry") return 0.98;
  if (method === "semantic_concept") return 0.96;
  if (method === "curated_contract") return 0.95;
  if (method === "metric_preference") return 0.88;
  if (method === "generated_contract") return 0.82;
  if (method === "catalogue_exact_match" && Number(metric?.lexical_score ?? 0) > 0) return 0.78;
  if (method === "catalogue_lexical_match" && Number(metric?.lexical_score ?? 0) > 0) return 0.72;
  return 0.45;
}

function periodTypeFromDisplayGrain(displayGrainValue: string | undefined): string {
  const parts = String(displayGrainValue ?? "").split("_");
  return parts.length > 1 ? parts.slice(1).join("_") : "year";
}

function displayGrain(geographyType: string | undefined, periodType = "year"): string | undefined {
  return geographyType ? `${geographyType}_${periodType}` : undefined;
}

function validGrains(metric: SemanticSearchResult | undefined): string[] {
  const explicit = asStringArray(metric?.metadata?.valid_grains);
  if (explicit.length) return explicit;
  const metadataTypes = asStringArray(metric?.metadata?.geography_types);
  return metadataTypes.map((type) => `${type}_year`);
}

function aggregation(metric: SemanticSearchResult | undefined): string {
  return normalize(String(metric?.metadata?.aggregation ?? metric?.metadata?.default_aggregation ?? ""));
}

function unitCode(metric: SemanticSearchResult | undefined, plan: SemanticQueryPlan): string {
  return normalize(String(metric?.unit_code ?? metric?.metadata?.unit_code ?? plan.measure_label ?? ""));
}

export function withExplicitGrain(plan: SemanticQueryPlan): SemanticQueryPlan {
  const geographyType = plan.geography_type;
  const periodType = plan.grain?.period_type ?? plan.period_type ?? periodTypeFromDisplayGrain(plan.grain?.display_grain);
  const grain = geographyType
    ? {
      geography_type: geographyType,
      period_type: periodType,
      display_grain: plan.grain?.display_grain ?? displayGrain(geographyType, periodType) ?? "unknown_year",
    }
    : plan.grain;
  return {
    ...plan,
    period_type: periodType,
    grain,
    expected_result_grain: plan.expected_result_grain ?? (grain ? ["measure_key", "dataset_code", "geography_code", "calendar_year"] : undefined),
  };
}

export function validateSemanticQueryPlan(plan: SemanticQueryPlan, matches: SemanticSearchResult[]): SemanticPlanValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [...(plan.warnings ?? [])];
  const metric = selectedMetric(plan, matches);
  const confidence = metricConfidence(metric, plan);
  const method = resolutionMethod(metric, plan);
  const configuredGrains = validGrains(metric);
  const requestedGrain = plan.grain?.display_grain ?? displayGrain(plan.geography_type, plan.period_type ?? "year");
  const metricAggregation = aggregation(metric);
  const metricUnit = unitCode(metric, plan);

  const selectedMetricKeys = new Set(
    matches
      .filter((match) => match.metadata?.measure_key != null && String(match.metadata.measure_key) === String(plan.measure_key))
      .map((match) => String(match.metadata.measure_key))
  );

  if (plan.source === "gold_bouwen_wonen") {
    if (!plan.measure_key) errors.push("Exactly one metric is required before Guara can execute a Gold query.");
    if (selectedMetricKeys.size > 1) errors.push("Metric resolution was ambiguous; Guara will not execute until one metric is selected.");
    if (!metric) errors.push("The selected metric is not present in the semantic catalogue response.");
    if (!plan.dataset_code) errors.push("The selected metric must resolve to one deterministic dataset.");
    if (plan.dataset_code && plan.dataset_code.includes(",")) errors.push("Multiple datasets cannot be combined unless an explicit union rule exists.");
    if (!plan.grain?.geography_type || !plan.grain?.period_type || !plan.grain?.display_grain) errors.push("The requested geography and period grain must be explicit in the query plan.");
    if (!requestedGrain) errors.push("The display grain could not be constructed.");
    if (configuredGrains.length > 0 && requestedGrain && !configuredGrains.includes(requestedGrain)) {
      errors.push(`The selected metric does not declare support for ${requestedGrain}.`);
    }
    if (confidence < MINIMUM_EXECUTION_CONFIDENCE) {
      errors.push("Metric confidence is below the execution threshold; Guara needs a clearer indicator or curated semantic definition.");
    }
    if (method === "unsafe_fallback" || (Number(metric?.vector_score ?? 0) > 0 && Number(metric?.lexical_score ?? 0) === 0 && metric?.metadata?.explicit_metric_contract !== true)) {
      errors.push("Metric selection cannot rely on vector similarity alone.");
    }
    if (["percent", "percentage", "ratio", "median", "average", "index"].some((token) => metricUnit.includes(token) || metricAggregation.includes(token)) && metricAggregation === "sum") {
      errors.push("Percentages, ratios, medians, averages and indexes cannot use sum unless explicitly configured.");
    }
    if (plan.calculation_code === "share_of_total" && !plan.secondary_measure_key) {
      errors.push("Share calculations require an explicitly resolved denominator metric.");
    }
    if (plan.category_filter_dimension_code && !plan.category_filter_value) {
      errors.push("A collapsed category dimension must be filtered to a canonical value.");
    }
    if (plan.category_filters) {
      for (const [dimensionCode, categoryValue] of Object.entries(plan.category_filters)) {
        if (!dimensionCode || !categoryValue) errors.push("Every dimension value must resolve to a canonical dimension and category value before execution.");
      }
    }
  }

  if (confidence < 0.9 && plan.source === "gold_bouwen_wonen") {
    warnings.push(`Metric confidence: ${Math.round(confidence * 100)}% via ${method}.`);
  }

  const status = errors.length > 0 ? (confidence < MINIMUM_EXECUTION_CONFIDENCE ? "low_confidence" : "invalid") : "valid";
  return {
    ok: errors.length === 0,
    confidence,
    status,
    errors,
    warnings: Array.from(new Set(warnings)),
    checks: {
      selected_metric_key: plan.measure_key ?? null,
      selected_metric_label: plan.measure_label ?? null,
      selected_concept_code: plan.semantic_concept_code ?? null,
      selected_concept_label: plan.semantic_concept_label ?? null,
      selected_metric_dataset: plan.dataset_code ?? null,
      resolution_method: method,
      minimum_confidence: MINIMUM_EXECUTION_CONFIDENCE,
      confidence,
      requested_grain: requestedGrain ?? null,
      valid_grains: configuredGrains,
      aggregation: metricAggregation || null,
      unit_code: metric?.unit_code ?? metric?.metadata?.unit_code ?? null,
      category_filters: plan.category_filters ?? {},
    },
  };
}

export function attachSemanticDiagnostics(plan: SemanticQueryPlan, validation: SemanticPlanValidationResult): SemanticQueryPlan {
  return {
    ...plan,
    semantic_confidence: validation.confidence,
    semantic_model_diagnostics: {
      status: validation.status,
      errors: validation.errors,
      warnings: validation.warnings,
      checks: validation.checks,
    },
    warnings: validation.warnings,
  };
}

export function validateReturnedGrain(plan: SemanticQueryPlan, resultRows: Array<Record<string, unknown>>): string[] {
  const warnings: string[] = [];
  const expectedGeographyType = plan.grain?.geography_type ?? plan.geography_type;
  const seen = new Set<string>();

  for (const row of resultRows) {
    const rowGeographyType = row.geography_type == null ? undefined : String(row.geography_type);
    if (expectedGeographyType && rowGeographyType && rowGeographyType !== expectedGeographyType) {
      warnings.push(`Returned grain mismatch: expected ${expectedGeographyType}, received ${rowGeographyType}.`);
    }
    const key = [
      row.measure_key ?? plan.measure_key ?? "",
      plan.dataset_code ?? "",
      row.geography_code ?? row.geography_name ?? "",
      row.calendar_year ?? "",
      row.category_name ?? "",
    ].join("|");
    if (seen.has(key)) warnings.push("Returned result is not unique at the expected display grain.");
    seen.add(key);
  }

  return Array.from(new Set(warnings));
}
