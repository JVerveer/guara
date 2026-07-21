import { getSupabaseClient, isSupabaseConfigured } from "@/data/supabase/client";
import type { SemanticAnswer, SemanticIntent, SemanticQueryPlan, SemanticSearchResult } from "../types";
import { enrichSemanticAnswer } from "./answerEnrichmentService";
import { buildSemanticQueryPlan, classifySemanticIntent, extractSemanticMetricPhrase, type SemanticPlannerCuration } from "./queryPlanner";
import { attachSemanticDiagnostics, validateReturnedGrain, validateSemanticQueryPlan, withExplicitGrain } from "./queryPlanValidationService";
import { fetchSemanticContractContext, type SemanticContractContext } from "./semanticContractService";
import { buildContractQueryPlan } from "./semanticContractPlanner";
import { buildRegistryQueryPlan } from "./semanticRegistry";

function hashEmbedding(text: string): string {
  const vector = new Array(64).fill(0);
  const tokens = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  for (const token of tokens) {
    let hash = 2166136261;
    for (let index = 0; index < token.length; index += 1) {
      hash ^= token.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    for (let index = 0; index < 4; index += 1) {
      const slot = Math.abs((hash >> (index * 8)) % vector.length);
      vector[slot] += (hash & (1 << index)) === 0 ? 1 : -1;
    }
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return `[${vector.map((value) => (value / norm).toFixed(6)).join(",")}]`;
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

async function hybridSearch(question: string, objectTypes?: string[]): Promise<SemanticSearchResult[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getSupabaseClient();
  const searchObjectTypes = objectTypes?.map((type) => type === "measure" ? "metric" : type === "category" ? "dimension_value" : type);
  const { data, error } = await (supabase as any).rpc("guara_search_documents", {
    search_query: question,
    query_embedding: hashEmbedding(question),
    match_count: 30,
    object_types: searchObjectTypes ?? null,
    investigation: null,
    filters: {
      strict_gold_only: true,
      domain_id: "bouwen-en-wonen",
    },
    development_mode: false,
  });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    catalogue_item_id: row.search_document_id,
    object_type: row.object_type === "metric" ? "metric" : row.object_type,
    object_id: row.object_id,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    dataset_code: row.dataset_code,
    measure_code: row.metadata?.measure_code ?? row.metadata?.metric_code ?? null,
    geography_code: row.metadata?.geography_code ?? null,
    unit_code: row.metadata?.unit_code ?? null,
    domain_id: row.metadata?.domain_id ?? null,
    provider: row.source_name,
    rank_score: Number(row.rank_score ?? 0),
    lexical_score: Number(row.lexical_score ?? 0),
    vector_score: Number(row.vector_score ?? 0),
    metadata: row.metadata ?? {},
  })) as SemanticSearchResult[];
}

async function safeHybridSearch(question: string, objectTypes?: string[]): Promise<SemanticSearchResult[]> {
  try {
    return await hybridSearch(question, objectTypes);
  } catch (error) {
    console.warn("Semantic hybrid search failed; continuing with generated semantic contracts.", error);
    return [];
  }
}

async function curatedPatternMatches(question: string): Promise<SemanticSearchResult[]> {
  if (!isSupabaseConfigured()) return [];
  if (!/\b(woningtype|woningtypes|type woningen|housing type|housing types)\b/i.test(question)) return [];

  const supabase = await getSupabaseClient();
  const { data } = await (supabase as any)
    .schema("semantic")
    .from("catalogue_item")
    .select("catalogue_item_id, object_type, object_id, title, subtitle, description, dataset_code, measure_code, geography_code, unit_code, domain_id, provider, metadata")
    .eq("object_type", "measure")
    .eq("dataset_code", "85035NED")
    .eq("title", "Beginstand woningvoorraad")
    .eq("is_active", true)
    .limit(1);

  return (data ?? []).map((row: any) => ({
    catalogue_item_id: row.catalogue_item_id,
    object_type: "metric",
    object_id: row.object_id,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    dataset_code: row.dataset_code,
    measure_code: row.measure_code,
    geography_code: row.geography_code,
    unit_code: row.unit_code,
    domain_id: row.domain_id,
    provider: row.provider,
    rank_score: 1,
    lexical_score: 1,
    vector_score: 0,
    metadata: { ...(row.metadata ?? {}), has_fact_data: true },
  })) as SemanticSearchResult[];
}

async function executePlan(plan: SemanticQueryPlan): Promise<Record<string, unknown>> {
  if (!isSupabaseConfigured() || plan.source !== "gold_bouwen_wonen" || !plan.measure_key) return {};
  if (plan.requires_clarification) return {};
  if (plan.semantic_model_diagnostics?.errors.length) return { rows: [], semantic_validation: plan.semantic_model_diagnostics };
  const supabase = await getSupabaseClient();
  const rpcIntent = plan.intent === "measure_definition" ? "lookup_measure" : plan.intent;
  const { data, error } = await (supabase as any).rpc("guara_execute_query_plan", {
    plan: { ...plan, intent: rpcIntent },
  });
  if (error) return { error: error.message };
  return (data ?? {}) as Record<string, unknown>;
}

async function checkDataAvailability(plan: SemanticQueryPlan): Promise<Record<string, unknown>> {
  if (!isSupabaseConfigured() || plan.source !== "gold_bouwen_wonen" || !plan.measure_key) return {};
  const supabase = await getSupabaseClient();
  const { data, error } = await (supabase as any).rpc("guara_check_query_availability", {
    plan,
  });
  if (error) return { error: error.message };
  return (data ?? {}) as Record<string, unknown>;
}

function rows(result: Record<string, unknown>): Array<Record<string, unknown>> {
  return Array.isArray(result.rows) ? (result.rows as Array<Record<string, unknown>>) : [];
}

function numberValue(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatNumber(value: unknown, maximumFractionDigits = 0): string {
  const numeric = numberValue(value);
  if (numeric == null) return String(value ?? "unknown");
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(numeric);
}

function formatMeasureValue(row: Record<string, unknown>): string {
  const value = row.value ?? row.observation_value ?? row.raw_value;
  return formatTypedValue(value, row.unit_code, row.unit_name);
}

function formatTypedValue(value: unknown, unitCodeValue?: unknown, unitNameValue?: unknown): string {
  const numeric = numberValue(value);
  const unitCode = String(unitCodeValue ?? "").toUpperCase();
  const unitName = String(unitNameValue ?? "");
  if (numeric == null) return String(value ?? "unknown");

  if (unitCode.includes("EUR")) return `€${formatNumber(numeric)}`;
  if (unitCode.includes("PERCENT") || unitName.toLowerCase().includes("percent")) return `${formatNumber(numeric, 1)}%`;
  return formatNumber(numeric, Number.isInteger(numeric) ? 0 : 1);
}

function humanMeasureName(plan: SemanticQueryPlan, row?: Record<string, unknown>): string {
  const label = String(row?.measure_name ?? plan.measure_label ?? "the requested measure");
  const normalized = normalize(label);
  if (normalized === "totaal huurwoningen") return "rental homes";
  if (normalized === "gemiddelde woz waarde van woningen") return "average WOZ home value";
  return label;
}

function periodLabel(plan: SemanticQueryPlan, row?: Record<string, unknown>): string {
  return String(row?.calendar_year ?? row?.year ?? plan.year ?? (plan.year_start && plan.year_end ? `${plan.year_start}-${plan.year_end}` : "the requested period"));
}

function geographyLabel(plan: SemanticQueryPlan, row?: Record<string, unknown>): string {
  return String(row?.geography_name ?? plan.geography_names?.[0] ?? "the requested geography");
}

function planPeriodLabel(plan: SemanticQueryPlan): string {
  if (plan.year_start && plan.year_end) return `${plan.year_start}-${plan.year_end}`;
  if (plan.year) return String(plan.year);
  return "latest available year when available";
}

function interpretationBullet(plan: SemanticQueryPlan, row?: Record<string, unknown>): string {
  const unit = String(row?.unit_code ?? row?.unit_name ?? "source unit");
  const grain = plan.grain?.display_grain ?? (plan.geography_type ? `${plan.geography_type}_year` : "declared Gold grain");
  const concept = plan.semantic_concept_label ? `${plan.semantic_concept_label} (${plan.semantic_concept_code ?? "concept"}) -> ` : "";
  return `Interpretation: ${concept}${plan.measure_label ?? "selected metric"} at ${grain}, period ${planPeriodLabel(plan)}, unit ${unit}, dataset ${plan.dataset_code ?? "selected Gold dataset"}.`;
}

function secondaryMeasureName(plan: SemanticQueryPlan): string {
  const normalized = normalize(plan.secondary_measure_label ?? "");
  if (normalized === "totaal huurwoningen") return "rental homes";
  if (normalized === "gemiddelde woz waarde van woningen") return "average WOZ home value";
  return plan.secondary_measure_label ?? "the comparison measure";
}

function unitCodeForLabel(label: string | undefined): string | undefined {
  const normalized = normalize(label ?? "");
  if (normalized.includes("woz") || normalized.includes("verkoopprijs")) return "EUR";
  if (normalized.includes("percentage") || normalized.includes("aandeel")) return "PERCENT";
  return undefined;
}

function percentage(value: unknown): string {
  const numeric = numberValue(value);
  return numeric == null ? "unknown" : `${formatNumber(numeric, 1)}%`;
}

function changeLabel(value: unknown, unitCode?: unknown): string {
  const numeric = numberValue(value);
  if (numeric == null) return String(value ?? "unknown");
  const prefix = numeric > 0 ? "+" : "";
  return `${prefix}${formatTypedValue(numeric, unitCode)}`;
}

function businessAnswerText(_question: string, plan: SemanticQueryPlan, resultRows: Array<Record<string, unknown>>) {
  const first = resultRows[0] ?? {};
  const measure = humanMeasureName(plan, first);
  const period = periodLabel(plan, first);

  if (plan.calculation_code === "share_of_total") {
    const geography = geographyLabel(plan, first);
    const share = percentage(first.share_percent);
    const numerator = formatTypedValue(first.numerator_value, "COUNT");
    const denominator = formatTypedValue(first.denominator_value, "COUNT");
    const part = plan.measure_label ?? "the selected part";
    const total = plan.secondary_measure_label ?? "the total";
    return {
      title: `${share} of ${total} in ${geography} were ${part} in ${period}`,
      summary: `In ${geography}, ${numerator} out of ${denominator} ${total} were ${part} in ${period}.`,
      bullets: [
        `${part}: ${numerator}`,
        `${total}: ${denominator}`,
        `Share: ${share}`,
      ],
    };
  }

  if (plan.calculation_code === "compare_to_average") {
    const geography = geographyLabel(plan, first);
    const value = formatTypedValue(first.value, first.unit_code);
    const average = formatTypedValue(first.average_value, first.unit_code);
    const difference = changeLabel(first.difference_from_average, first.unit_code);
    const ratio = numberValue(first.ratio_to_average);
    const direction = numberValue(first.difference_from_average) == null
      ? "compared with"
      : Number(first.difference_from_average) >= 0 ? "above" : "below";
    return {
      title: `${geography} was ${direction} the comparable average for ${measure} in ${period}`,
      summary: `${geography} had ${value} ${measure} in ${period}. The average across comparable geographies was ${average}, a difference of ${difference}.`,
      bullets: [
        `${geography}: ${value}`,
        `Comparable average: ${average}`,
        `Difference: ${difference}`,
        ratio == null ? "Ratio to average: unknown" : `Ratio to average: ${formatNumber(ratio, 2)}x`,
      ],
    };
  }

  if (plan.calculation_code === "multi_metric_rank") {
    const secondary = secondaryMeasureName(plan);
    const top = geographyLabel(plan, first);
    const primaryUnit = unitCodeForLabel(plan.measure_label);
    const secondaryUnit = unitCodeForLabel(plan.secondary_measure_label);
    return {
      title: `${top} best matches high ${measure} and low ${secondary} in ${period}`,
      summary: `Guara ranked municipalities by high ${plan.measure_label ?? measure} and low ${plan.secondary_measure_label ?? secondary}. The lower combined score is the stronger match.`,
      bullets: resultRows.slice(0, 10).map((row, index) => {
        const primary = formatTypedValue(row.primary_value, primaryUnit);
        const secondaryValue = formatTypedValue(row.secondary_value, secondaryUnit ?? "COUNT");
        return `${index + 1}. ${geographyLabel(plan, row)}: ${plan.measure_label ?? measure} ${primary}; ${plan.secondary_measure_label ?? secondary} ${secondaryValue}`;
      }),
    };
  }

  if (plan.calculation_code === "change_rank") {
    const top = geographyLabel(plan, first);
    const startYear = first.start_year ?? plan.year_start ?? "start";
    const endYear = first.end_year ?? plan.year_end ?? "end";
    const unitCode = first.unit_code ?? unitCodeForLabel(plan.measure_label);
    const startValue = formatTypedValue(first.start_value, unitCode);
    const endValue = formatTypedValue(first.end_value, unitCode);
    const absolute = changeLabel(first.absolute_change, unitCode);
    const pct = percentage(first.percentage_change);
    return {
      title: `${top} had the biggest increase in ${measure} between ${startYear} and ${endYear}`,
      summary: `${top} went from ${startValue} in ${startYear} to ${endValue} in ${endYear}: a change of ${absolute} (${pct}).`,
      bullets: resultRows.slice(0, 10).map((row, index) => `${index + 1}. ${geographyLabel(plan, row)}: ${changeLabel(row.absolute_change, row.unit_code ?? unitCode)} (${percentage(row.percentage_change)})`),
    };
  }

  if (plan.calculation_code === "metric_comparison") {
    return {
      title: `Comparison of ${plan.measure_label ?? measure} and ${plan.secondary_measure_label ?? "the second measure"}`,
      summary: `Guara compared both indicators for the requested place${(plan.geography_names?.length ?? 0) > 1 ? "s" : ""} and period.`,
      bullets: resultRows.slice(0, 10).map((row) => `${geographyLabel(plan, row)} ${row.calendar_year ?? period}, ${row.measure_name ?? "measure"}: ${formatMeasureValue(row)}`),
    };
  }

  if (plan.calculation_code === "category_breakdown") {
    const category = plan.category_dimension_code ?? "category";
    return {
      title: `${plan.measure_label ?? measure} by ${category} in ${period}`,
      summary: `Guara found ${resultRows.length} loaded ${category} result${resultRows.length === 1 ? "" : "s"} for ${period}. These rows come from ${plan.dataset_code ?? "the selected Gold dataset"}.`,
      bullets: resultRows.slice(0, 10).map((row) => `${geographyLabel(plan, row)} · ${row.category_name ?? category}: ${formatTypedValue(row.value, row.unit_code, row.unit_name)}`),
    };
  }

  if (plan.intent === "trend") {
    const firstYear = resultRows[0]?.calendar_year ?? plan.year_start ?? "first year";
    const last = resultRows[resultRows.length - 1] ?? first;
    const lastYear = last.calendar_year ?? plan.year_end ?? "last year";
    const firstValue = formatMeasureValue(first);
    const lastValue = formatMeasureValue(last);
    const firstNumeric = numberValue(first.value ?? first.raw_value);
    const lastNumeric = numberValue(last.value ?? last.raw_value);
    const delta = firstNumeric == null || lastNumeric == null ? null : lastNumeric - firstNumeric;
    return {
      title: `${measure} changed from ${firstValue} in ${firstYear} to ${lastValue} in ${lastYear}`,
      summary: delta == null
        ? `Guara found a time series for ${measure} from ${firstYear} to ${lastYear}.`
        : `Across the loaded period, ${measure} changed by ${changeLabel(delta, last.unit_code)}.`,
      bullets: resultRows.slice(0, 10).map((row) => `${row.calendar_year}: ${formatMeasureValue(row)}`),
    };
  }

  if (resultRows.length === 1) {
    const geography = geographyLabel(plan, first);
    const value = formatMeasureValue(first);
    return {
      title: `${geography} had ${value} ${measure} in ${period}`,
      summary: `For ${geography}, ${plan.measure_label ?? measure} was ${value} in ${period}.`,
      bullets: [
        `Geography: ${geography} (${first.geography_type ?? plan.geography_type ?? "available Gold grain"})`,
        `Measure: ${first.measure_name ?? plan.measure_label ?? measure}`,
        `Source layer: Gold Bouwen en wonen mart`,
      ],
    };
  }

  if (plan.intent === "rank_geographies") {
    const ascending = plan.sort_direction === "asc";
    const top = first.geography_name ? `${first.geography_name}` : ascending ? "The lowest-ranked municipality" : "The highest-ranked municipality";
    const value = formatMeasureValue(first);
    const rankWord = ascending ? "lowest" : "highest";
    const scope = plan.geography_type === "municipality" ? "municipalities" : `${plan.geography_type ?? "geographies"}`;
    const drillOptions = plan.geography_type === "municipality"
      ? "I can also show the same ranking at province or regional level."
      : "I can also show the same ranking at another geographic level.";
    return {
      title: `${top} had the ${rankWord} ${measure} among ${scope} in ${period}`,
      summary: `The ${rankWord} value found was ${value} for ${top}. The ranking below shows the ${ascending ? "lowest" : "highest"} ${Math.min(resultRows.length, 10)} results from the Gold mart.`,
      bullets: [
        ...resultRows.slice(0, 10).map((row, index) => `${index + 1}. ${geographyLabel(plan, row)}: ${formatMeasureValue(row)}`),
        drillOptions,
      ],
    };
  }

  return {
    title: `${plan.measure_label ?? "Result"} for ${period}`,
    summary: `Guara found ${resultRows.length} matching Gold result${resultRows.length === 1 ? "" : "s"} for the requested question.`,
    bullets: resultRows.slice(0, 10).map((row) => `${geographyLabel(plan, row)}: ${formatMeasureValue(row)}${row.calendar_year ? ` (${row.calendar_year})` : ""}`),
  };
}

async function executePlanWithFallback(plan: SemanticQueryPlan, _matches: SemanticSearchResult[]): Promise<{ plan: SemanticQueryPlan; execution: Record<string, unknown> }> {
  const availability = plan.source === "gold_bouwen_wonen" && plan.measure_key ? await checkDataAvailability(plan) : {};
  const hasAvailabilityError = typeof availability.error === "string" && availability.error.length > 0;
  const unavailable =
    !hasAvailabilityError
    && Object.keys(availability).length > 0
    && (
      availability.metric_available === false
      || availability.dataset_available === false
      || availability.grain_available === false
      || availability.period_available === false
    );
  if (unavailable) {
    return {
      plan,
      execution: {
        rows: [],
        availability_check: availability,
        no_data_reason: "availability_check_failed",
      },
    };
  }

  const execution = await executePlan(plan);
  const resultRows = rows(execution);
  if (resultRows.length > 0) {
    const returnedGrainWarnings = validateReturnedGrain(plan, resultRows);
    return {
      plan: returnedGrainWarnings.length
        ? {
          ...plan,
          warnings: Array.from(new Set([...(plan.warnings ?? []), ...returnedGrainWarnings])),
        }
        : plan,
      execution: {
        ...execution,
        availability_check: availability,
        ...(returnedGrainWarnings.length ? { returned_grain_warnings: returnedGrainWarnings } : {}),
      },
    };
  }

  if (plan.source !== "gold_bouwen_wonen" || !plan.measure_key || plan.semantic_model_diagnostics?.errors.length) return { plan, execution };
  return { plan, execution: { ...execution, availability_check: availability } };
}

export function answerText(question: string, plan: SemanticQueryPlan, result: Record<string, unknown>, matches: SemanticSearchResult[]) {
  const resultRows = rows(result);
  const diagnostics = plan.semantic_model_diagnostics;
  if (diagnostics?.errors.length) {
    return {
      title: `Guara needs a safer interpretation before answering "${question}"`,
      summary: `I found a possible interpretation, but it did not pass Guara's Gold execution rules. No analytical query was executed.`,
      bullets: [
        `Interpreted metric: ${plan.measure_label ?? "not resolved"}`,
        `Requested grain: ${plan.grain?.display_grain ?? "not explicit"}`,
        `Dataset: ${plan.dataset_code ?? "not resolved"}`,
        ...diagnostics.errors.slice(0, 5),
      ],
      confidence: Math.round((plan.semantic_confidence ?? 0) * 100),
    };
  }

  if (resultRows.length > 0) {
    const businessText = businessAnswerText(question, plan, resultRows);
    const warnings = Array.from(new Set([...(plan.warnings ?? []), ...((result.returned_grain_warnings as string[] | undefined) ?? [])]));
    return {
      title: businessText.title,
      summary: businessText.summary,
      bullets: [
        interpretationBullet(plan, resultRows[0]),
        ...businessText.bullets,
        ...warnings.slice(0, 3).map((warning) => `Warning: ${warning}`),
      ],
      confidence: Math.round((plan.semantic_confidence ?? 0.82) * 100),
    };
  }

  if (plan.requires_clarification === "geography") {
    return {
      title: `Which municipalities should Guara use for the ${plan.measure_label ?? "selected indicator"} trend?`,
      summary: `I understood the indicator and the time period, but "these municipalities" depends on previous context that is not attached to this request. Name the municipalities and Guara can show the trend from ${plan.year_start ?? "the selected start year"} onward.`,
      bullets: [
        `Indicator found: ${plan.measure_label ?? "the selected indicator"}`,
        plan.year_start ? `Start year found: ${plan.year_start}` : "Start year: not specified",
        "Example: Show the trend for Beginstand woningvoorraad in Schiermonnikoog, Vlieland and Rozendaal since 2021.",
      ],
      confidence: 74,
    };
  }

  if (plan.source === "gold_bouwen_wonen" && plan.measure_key) {
    const geographies = plan.geography_names?.length ? plan.geography_names.join(", ") : "the requested geography";
    const period =
      plan.year_start && plan.year_end ? `${plan.year_start}-${plan.year_end}`
        : plan.year ? String(plan.year)
          : "";
    const missingPeriod = !period;
    const availability = (result.availability_check ?? {}) as Record<string, unknown>;
    const matchingRows = Number(availability.matching_rows ?? 0);
    const metricRows = Number(availability.metric_row_count ?? 0);
    const grainRows = Number(availability.grain_row_count ?? 0);
    const availableYears = Array.isArray(availability.available_years) ? availability.available_years.join(", ") : "";
    const availableGrains = Array.isArray(availability.available_geography_types) ? availability.available_geography_types.join(", ") : "";
    const availabilityKnown = Object.keys(availability).length > 0 && !availability.error;
    const noDataReason =
      availabilityKnown && metricRows === 0
        ? "This metric is defined semantically, but no matching Gold facts are loaded for it yet."
        : availabilityKnown && grainRows === 0
          ? `This metric has loaded Gold facts, but not at ${plan.grain?.display_grain ?? plan.geography_type ?? "the requested grain"}.`
          : availabilityKnown && matchingRows === 0
            ? "The metric and grain exist in Gold, but this exact filter combination did not return rows."
            : "Guara could not complete the deterministic availability check.";
    return {
      title: missingPeriod
        ? `Which year should Guara use for ${plan.measure_label ?? "this figure"} in ${geographies}?`
        : `No loaded value found for ${plan.measure_label ?? "this figure"} in ${geographies} for ${period}`,
      summary: missingPeriod
        ? `I found the indicator "${plan.measure_label}" and the place "${geographies}", but the question does not include a year. Public datasets often have different values per year, so Guara needs a year to return one clear number.`
        : `${noDataReason} No substitute metric or dataset was used.`,
      bullets: [
        interpretationBullet(plan),
        `Indicator found: ${plan.measure_label}`,
        `Place found: ${geographies}`,
        missingPeriod ? "Add a year, for example: Totaal huurwoningen Rotterdam 2023." : `Period checked: ${period}`,
        availableYears ? `Available years for this metric/grain: ${availableYears}` : "",
        availableGrains ? `Available geography levels for this metric: ${availableGrains}` : "",
        "Guara only answers from values that are already loaded into the trusted Gold layer.",
      ].filter(Boolean),
      confidence: Math.round((plan.semantic_confidence ?? 0.72) * 100),
    };
  }

  const bullets = matches.slice(0, 6).map((match) => `${match.object_type}: ${match.title}${match.subtitle ? ` (${match.subtitle})` : ""}`);
  const executionError = typeof result.error === "string" ? result.error : "";
  return {
    title: `Semantic catalogue results for "${question}"`,
    summary:
      executionError
        ? `Guara resolved a controlled query plan, but did not execute a fact answer: ${executionError}. The catalogue matches below show what is available for inspection.`
        : 
      bullets.length > 0
        ? "Guara found relevant catalogue objects, but did not execute an analytical fact query because the request did not resolve to a complete allowlisted query plan."
        : "No matching semantic catalogue objects were found. Load Gold dimensions and refresh the semantic catalogue.",
    bullets,
    confidence: bullets.length > 0 ? 65 : 0,
  };
}

async function recordProvenance(
  question: string,
  intent: SemanticIntent,
  plan: SemanticQueryPlan,
  result: Record<string, unknown>,
  matches: SemanticSearchResult[],
  confidence: number
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await getSupabaseClient();
  const sources = matches.slice(0, 8).map((match) => ({
    object_type: match.object_type,
    object_id: match.object_id,
    title: match.title,
    dataset_code: match.dataset_code,
    measure_code: match.measure_code,
    rank_score: match.rank_score,
  }));
  const { data, error } = await (supabase as any).rpc("guara_record_answer_provenance", {
    question,
    intent,
    query_plan: plan,
    result_summary: result,
    sources,
    confidence,
  });
  if (error) return null;
  return data as string;
}

function measureKeysFromMatches(matches: SemanticSearchResult[]): string[] {
  return Array.from(new Set(matches.map((match) => match.metadata?.measure_key).filter((key): key is string | number => key != null).map(String))).slice(0, 100);
}

function resultKey(match: SemanticSearchResult): string {
  const measureKey = match.metadata?.measure_key == null ? "" : String(match.metadata.measure_key);
  return measureKey ? `measure:${measureKey}` : `${match.object_type}:${match.object_id}`;
}

function resultReadiness(match: SemanticSearchResult): number {
  if (match.metadata?.is_contract_default_measure === true) return 60;
  const depth = String(match.metadata?.profile_depth ?? "");
  if (depth === "fact_profiled") return 40;
  if (depth === "sample_profiled") return 30;
  if (depth === "metadata_only") return 5;
  return match.metadata?.has_fact_data === true ? 10 : 0;
}

function mergeSemanticResults(...groups: SemanticSearchResult[][]): SemanticSearchResult[] {
  const merged = new Map<string, SemanticSearchResult>();
  for (const match of groups.flat()) {
    const key = resultKey(match);
    const existing = merged.get(key);
    if (!existing || resultReadiness(match) + match.rank_score >= resultReadiness(existing) + existing.rank_score) {
      merged.set(key, match);
    }
  }
  return Array.from(merged.values()).sort((left, right) => {
    return resultReadiness(right) - resultReadiness(left) || right.rank_score - left.rank_score;
  });
}

function mergeMetricGrains(primary: SemanticPlannerCuration["metricGrains"], generated: SemanticContractContext["metricGrains"]) {
  const byKey = new Map<string, NonNullable<SemanticPlannerCuration["metricGrains"]>[number]>();
  for (const grain of [...(primary ?? []), ...generated]) {
    byKey.set(`${grain.measure_key}:${grain.geography_type}:${grain.period_type ?? ""}`, grain);
  }
  return Array.from(byKey.values());
}

function plannerCurationFromContractContext(
  matches: SemanticSearchResult[],
  contractContext: SemanticContractContext
): SemanticPlannerCuration {
  const measureKeys = new Set(measureKeysFromMatches(matches));
  const metricGrains = measureKeys.size
    ? contractContext.metricGrains.filter((grain) => measureKeys.has(String(grain.measure_key)))
    : contractContext.metricGrains;

  return {
    metricPreferences: contractContext.metricPreferences,
    metricGrains,
    datasetContracts: contractContext.contracts,
  };
}

export const semanticSearchService = {
  async answer(question: string): Promise<SemanticAnswer> {
    const normalized = question.trim() || "Dutch public data";
    const intent = classifySemanticIntent(normalized);
    const objectTypes =
      intent === "dataset_lookup" ? ["dataset"]
        : intent === "measure_definition" ? ["measure"]
          : ["measure", "dataset", "geography"];
    const [matches, contractContext] = await Promise.all([
      safeHybridSearch(normalized, objectTypes),
      fetchSemanticContractContext(normalized),
    ]);
    const metricPhrase = extractSemanticMetricPhrase(normalized);
    const metricMatches =
      metricPhrase && metricPhrase.length >= 3 && metricPhrase.toLowerCase() !== normalized.toLowerCase()
        ? await safeHybridSearch(metricPhrase, ["measure"])
        : [];
    const curatedMatches = await curatedPatternMatches(normalized);
    const contractPlanResult = buildContractQueryPlan(normalized, intent, contractContext);
    const mergedMatches = mergeSemanticResults(
      contractPlanResult.match ? [contractPlanResult.match] : [],
      contractContext.results,
      metricMatches,
      matches,
      curatedMatches
    );
    const curation = plannerCurationFromContractContext(mergedMatches, contractContext);
    curation.metricGrains = mergeMetricGrains(curation.metricGrains, contractContext.metricGrains);
    const registryPlan = buildRegistryQueryPlan(normalized, intent, mergedMatches, curation);
    const rawPlan = withExplicitGrain(contractPlanResult.plan ?? registryPlan ?? buildSemanticQueryPlan(normalized, intent, mergedMatches, curation));
    const validation = validateSemanticQueryPlan(rawPlan, mergedMatches);
    const plan = attachSemanticDiagnostics(rawPlan, validation);
    const { plan: executedPlan, execution } = validation.ok
      ? await executePlanWithFallback(plan, mergedMatches)
      : { plan, execution: { rows: [], semantic_validation: plan.semantic_model_diagnostics } };
    const text = answerText(normalized, executedPlan, execution, mergedMatches);
    const enrichment = enrichSemanticAnswer(normalized, executedPlan, execution, mergedMatches);
    const answerId = await recordProvenance(normalized, intent, executedPlan, execution, mergedMatches, text.confidence);

    return {
      question: normalized,
      intent,
      answerId,
      title: text.title,
      summary: text.summary,
      bullets: text.bullets,
      confidence: text.confidence,
      searchResults: mergedMatches,
      queryPlan: executedPlan,
      executionResult: execution,
      enrichment,
      provenance: [
        "Guara read the question and identified the requested indicator, place and period.",
        "Guara searched the trusted semantic catalogue for matching CBS definitions.",
        executedPlan.source === "gold_bouwen_wonen" ? "Guara checked the trusted Bouwen en wonen data mart for matching values." : "Guara found catalogue matches but no complete data question.",
        "Guara kept the source references so the answer can be inspected later.",
      ],
    };
  },
};
