import { getSupabaseClient, isSupabaseConfigured } from "@/data/supabase/client";
import type { SemanticAnswer, SemanticIntent, SemanticQueryPlan, SemanticSearchResult } from "../types";
import { enrichSemanticAnswer } from "./answerEnrichmentService";
import { buildSemanticQueryPlan, classifySemanticIntent, extractSemanticMetricPhrase, type SemanticPlannerCuration } from "./queryPlanner";

const MUNICIPALITIES = ["Amsterdam", "Rotterdam", "Utrecht", "Groningen", "Eindhoven", "Den Haag", "Maastricht", "Nijmegen", "Tilburg", "Almere", "Breda", "Haarlem", "Arnhem", "Amersfoort", "Leiden", "Zwolle", "Delft", "Enschede", "Apeldoorn", "Bloemendaal", "Blaricum", "Wassenaar", "Pekela", "Kerkrade"];
const PROVINCES = ["Drenthe", "Flevoland", "Friesland", "Gelderland", "Groningen", "Limburg", "Noord-Brabant", "Noord-Holland", "Overijssel", "Utrecht", "Zeeland", "Zuid-Holland"];

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

function classifyIntent(question: string): SemanticIntent {
  const lower = question.toLowerCase();
  if (/what does|meaning|definition|betekent|definitie/.test(lower)) return "measure_definition";
  if (/which dataset|do we have|dataset|gegevens|data about|data over/.test(lower)) return "dataset_lookup";
  if (/share of|percentage of|what share|aandeel/.test(lower)) return "compare_geographies";
  if (/compare|vergelijk/.test(lower)) return "compare_geographies";
  if (/biggest increase|largest increase|strongest increase|grootste stijging/.test(lower)) return "rank_geographies";
  if (/change|changed|trend|since|after|ontwikkeling|verander/.test(lower)) return "trend";
  if (/which municipalities|find municipalities|municipalities.*most|top|highest|lowest|outliers|rank municipalities|gemeenten|meeste|hoogste|laagste/.test(lower)) return "rank_geographies";
  if (/\b(show|give|list|toon|laat zien)\b/.test(lower) && (MUNICIPALITIES.some((name) => lower.includes(name.toLowerCase())) || /\b(nederland|netherlands)\b/.test(lower))) return "compare_geographies";
  if (MUNICIPALITIES.some((name) => lower.includes(name.toLowerCase())) || PROVINCES.some((name) => lower.includes(name.toLowerCase())) || /\b(nederland|netherlands)\b/.test(lower)) return "compare_geographies";
  return "catalogue_search";
}

function extractYearRange(question: string): { year?: number; year_start?: number; year_end?: number } {
  const years = Array.from(question.matchAll(/\b(19[7-9]\d|20[0-2]\d)\b/g)).map((match) => Number(match[1]));
  if (years.length >= 2) return { year_start: Math.min(...years), year_end: Math.max(...years) };
  if (years[0] && /\b(since|after|na|vanaf)\b/i.test(question)) return { year_start: years[0] };
  return { year: years[0] };
}

function extractMetricPhrase(question: string): string {
  let phrase = question;
  for (const municipality of MUNICIPALITIES) {
    phrase = phrase.replace(new RegExp(`\\b${municipality}\\b`, "gi"), " ");
  }
  for (const province of PROVINCES) {
    phrase = phrase.replace(new RegExp(`\\b${province}\\b`, "gi"), " ");
  }
  return phrase
    .replace(/\b(compare|show|give|list|toon|laat zien|which municipalities have|which municipalities|municipalities|gemeenten|gemeente|highest|lowest|most|least|top|trend|for|in|between|and|since|after|before|from|to|with|the|what does|mean|meaning|what share of|share of|were|was|national average|province|provincie|high|low|but|biggest increase|largest increase|strongest increase)\b/gi, " ")
    .replace(/\b(19[7-9]\d|20[0-2]\d)\b/g, " ")
    .replace(/[?.!,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractGeographies(question: string, results: SemanticSearchResult[]): string[] {
  const lower = question.toLowerCase();
  const provinceMention = /\b(province|provincie)\b/.test(lower);
  const named = provinceMention ? [] : MUNICIPALITIES.filter((name) => lower.includes(name.toLowerCase()));
  const provinces = provinceMention ? PROVINCES.filter((name) => lower.includes(name.toLowerCase())) : [];
  const country = /\b(nederland|netherlands)\b/.test(lower) ? ["Nederland"] : [];
  const retrieved = results
    .filter((result) => result.object_type === "geography" && lower.includes(result.title.toLowerCase()))
    .map((result) => result.title);
  return Array.from(new Set([...named, ...provinces, ...country, ...retrieved])).slice(0, 6);
}

function extractExcludedGeographies(question: string): string[] {
  const lower = question.toLowerCase();
  if (!/\b(excluding|exclude|zonder|behalve)\b/.test(lower)) return [];
  return MUNICIPALITIES.filter((name) => lower.includes(name.toLowerCase()));
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function firstMeasure(question: string, results: SemanticSearchResult[]): SemanticSearchResult | undefined {
  const normalizedQuestion = normalize(question);
  const normalizedMetricPhrase = normalize(extractMetricPhrase(question));
  const metrics = results.filter((result) => ["measure", "metric"].includes(result.object_type) && result.metadata?.measure_key);
  return metrics.find((result) => result.metadata?.has_fact_data === true && normalize(result.title) === normalizedMetricPhrase)
    ?? metrics.find((result) => normalize(result.title) === normalizedMetricPhrase)
    ?? metrics.find((result) => result.metadata?.has_fact_data === true && normalizedQuestion.includes(normalize(result.title)))
    ?? metrics.find((result) => normalizedQuestion.includes(normalize(result.title)))
    ?? metrics.find((result) => result.metadata?.has_fact_data === true)
    ?? results.find((result) => ["measure", "metric"].includes(result.object_type) && result.metadata?.measure_key);
}

function questionMeasures(question: string, results: SemanticSearchResult[]): SemanticSearchResult[] {
  const normalizedQuestion = normalize(question);
  const seenLabels = new Set<string>();
  return results
    .filter((result) => ["measure", "metric"].includes(result.object_type) && result.metadata?.measure_key && result.metadata?.has_fact_data === true)
    .filter((result) => normalizedQuestion.includes(normalize(result.title)))
    .sort((left, right) => normalize(right.title).length - normalize(left.title).length)
    .filter((result) => {
      const label = normalize(result.title);
      if (seenLabels.has(label)) return false;
      seenLabels.add(label);
      return true;
    });
}

function calculationCode(intent: SemanticIntent): string | undefined {
  if (intent === "rank_geographies") return "ranking";
  if (intent === "compare_geographies") return "comparison";
  if (intent === "trend") return "trend";
  if (intent === "measure_definition") return "lookup";
  return undefined;
}

function derivedCalculationCode(question: string, intent: SemanticIntent, measures: SemanticSearchResult[]): string | undefined {
  const lower = question.toLowerCase();
  if (/share of|percentage of|what share|aandeel/.test(lower) && measures.length >= 2) return "share_of_total";
  if (/biggest increase|largest increase|strongest increase|grootste stijging/.test(lower)) return "change_rank";
  if (/national average|landelijk gemiddelde|nationale gemiddelde/.test(lower)) return "compare_to_average";
  if (/\bhigh\b.*\blow\b|\bhoog\b.*\blaag\b/.test(lower) && measures.length >= 2) return "multi_metric_rank";
  if (intent === "compare_geographies" && measures.length >= 2) return "metric_comparison";
  return calculationCode(intent);
}

function calculationNeedsSecondaryMeasure(calculation: string | undefined): boolean {
  return ["share_of_total", "multi_metric_rank", "metric_comparison", "compare_to_average"].includes(calculation ?? "");
}

function rankSortDirection(question: string): "asc" | "desc" {
  return /\b(lowest|least|laagste|minst|smallest|kleinste|below|less than|under|onder|minder dan)\b/i.test(question) ? "asc" : "desc";
}

function extractValueFilter(question: string): { value_filter_operator?: "lt" | "lte" | "gt" | "gte"; value_filter?: number } {
  const match = question.match(/\b(below|under|less than|boven|above|over|more than|greater than|at least|at most|minder dan|meer dan)\s+([0-9][0-9.,]*)\b/i);
  if (!match) return {};
  const phrase = match[1].toLowerCase();
  const value = Number(match[2].replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(value)) return {};
  if (["below", "under", "less than", "minder dan", "at most"].includes(phrase)) return { value_filter_operator: phrase === "at most" ? "lte" : "lt", value_filter: value };
  return { value_filter_operator: phrase === "at least" ? "gte" : "gt", value_filter: value };
}

function extractGeographyType(question: string, intent: SemanticIntent, geographyNames: string[]): string | undefined {
  const lower = question.toLowerCase();
  if (/\b(province|provincie)\b/.test(lower)) return "province";
  if (geographyNames.includes("Nederland")) return "country";
  if (intent === "rank_geographies" || geographyNames.length > 0) return "municipality";
  return undefined;
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

function buildPlan(question: string, intent: SemanticIntent, results: SemanticSearchResult[]): SemanticQueryPlan {
  const measure = firstMeasure(question, results);
  const measures = questionMeasures(question, results);
  const primaryMeasure = measures[0] ?? measure;
  const yearRange = extractYearRange(question);
  const geographyNames = extractGeographies(question, results);
  const excludedGeographyNames = extractExcludedGeographies(question);
  const valueFilter = extractValueFilter(question);
  const geographyType = extractGeographyType(question, intent, geographyNames);
  const resolvedCalculationCode = derivedCalculationCode(question, intent, measures);
  const secondaryMeasure = calculationNeedsSecondaryMeasure(resolvedCalculationCode) ? measures[1] : undefined;
  const [mainMeasure, comparisonMeasure] =
    resolvedCalculationCode === "share_of_total" && primaryMeasure && secondaryMeasure && normalize(primaryMeasure.title).includes("totaal") && !normalize(secondaryMeasure.title).includes("totaal")
      ? [secondaryMeasure, primaryMeasure]
      : [primaryMeasure, secondaryMeasure];
  const analytical = ["rank_geographies", "compare_geographies", "trend", "measure_definition"].includes(intent);

  if (!analytical || !mainMeasure) {
    return {
      intent,
      source: "semantic_catalogue",
      ...yearRange,
      geography_names: geographyNames,
      limit: 10,
      explanation: [
        "Classified as catalogue retrieval or unresolved analytical request.",
        "No database fact query was compiled unless a Gold measure was resolved with sufficient confidence.",
      ],
    };
  }

  return {
    intent: intent === "measure_definition" ? "measure_definition" : intent,
    source: "gold_bouwen_wonen",
    measure_key: String(mainMeasure.metadata.measure_key),
    secondary_measure_key: comparisonMeasure?.metadata.measure_key == null ? undefined : String(comparisonMeasure.metadata.measure_key),
    metric_id: mainMeasure.metadata.metric_id == null ? undefined : String(mainMeasure.metadata.metric_id),
    metric_code: typeof mainMeasure.metadata.metric_code === "string" ? mainMeasure.metadata.metric_code : undefined,
    calculation_code: resolvedCalculationCode ?? "lookup",
    measure_label: mainMeasure.title,
    secondary_measure_label: comparisonMeasure?.title,
    ...yearRange,
    geography_names: geographyNames,
    excluded_geography_names: excludedGeographyNames,
    limit: intent === "trend" ? 50 : 10,
    geography_type: geographyType,
    ...valueFilter,
    sort_direction: intent === "rank_geographies" ? rankSortDirection(question) : undefined,
    explanation: [
      `Resolved measure "${mainMeasure.title}" from the semantic catalogue.`,
      comparisonMeasure ? `Resolved secondary measure "${comparisonMeasure.title}" for the derived calculation.` : "",
      "Compiled to an allowlisted Bouwen en wonen query plan using an approved semantic calculation.",
      "The database RPC validates intent, metric availability, metric-dimension compatibility, approved joins and result limits before execution.",
    ].filter(Boolean),
  };
}

async function executePlan(plan: SemanticQueryPlan): Promise<Record<string, unknown>> {
  if (!isSupabaseConfigured() || plan.source !== "gold_bouwen_wonen" || !plan.measure_key) return {};
  const supabase = await getSupabaseClient();
  const rpcIntent = plan.intent === "measure_definition" ? "lookup_measure" : plan.intent;
  const { data, error } = await (supabase as any).rpc("guara_execute_query_plan", {
    plan: { ...plan, intent: rpcIntent },
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
    const top = first.geography_name ? `${first.geography_name}` : "The highest-ranked municipality";
    const value = formatMeasureValue(first);
    return {
      title: `${top} ranked highest for ${measure} in ${period}`,
      summary: `The highest value found was ${value} for ${top}. The ranking below shows the top ${Math.min(resultRows.length, 10)} results from the Gold mart.`,
      bullets: resultRows.slice(0, 10).map((row, index) => `${index + 1}. ${geographyLabel(plan, row)}: ${formatMeasureValue(row)}`),
    };
  }

  return {
    title: `${plan.measure_label ?? "Result"} for ${period}`,
    summary: `Guara found ${resultRows.length} matching Gold result${resultRows.length === 1 ? "" : "s"} for the requested question.`,
    bullets: resultRows.slice(0, 10).map((row) => `${geographyLabel(plan, row)}: ${formatMeasureValue(row)}${row.calendar_year ? ` (${row.calendar_year})` : ""}`),
  };
}

function siblingMeasures(plan: SemanticQueryPlan, results: SemanticSearchResult[]): SemanticSearchResult[] {
  if (!plan.measure_label || !plan.measure_key) return [];
  const normalizedLabel = normalize(plan.measure_label);
  const seen = new Set([plan.measure_key]);
  return results
    .filter((result) => ["measure", "metric"].includes(result.object_type))
    .filter((result) => result.metadata?.measure_key && result.metadata?.has_fact_data === true)
    .filter((result) => normalize(result.title) === normalizedLabel)
    .filter((result) => {
      const key = String(result.metadata.measure_key);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function executePlanWithFallback(plan: SemanticQueryPlan, matches: SemanticSearchResult[]): Promise<{ plan: SemanticQueryPlan; execution: Record<string, unknown> }> {
  const execution = await executePlan(plan);
  if (rows(execution).length > 0 || plan.source !== "gold_bouwen_wonen" || !plan.measure_key) return { plan, execution };

  if (plan.geography_names?.some((name) => normalize(name) === "nederland" || normalize(name) === "netherlands")) {
    const nationalFallbackPlan = {
      ...plan,
      geography_names: [],
      geography_type: undefined,
      explanation: [
        ...plan.explanation,
        "Requested country-level geography returned no rows; retried as an unfiltered national/source-total series because some CBS Gold rows are currently loaded as Unknown geography.",
      ],
    };
    const nationalFallbackExecution = await executePlan(nationalFallbackPlan);
    if (rows(nationalFallbackExecution).length > 0) return { plan: nationalFallbackPlan, execution: nationalFallbackExecution };
  }

  for (const sibling of siblingMeasures(plan, matches)) {
    const fallbackPlan = {
      ...plan,
      measure_key: String(sibling.metadata.measure_key),
      metric_id: sibling.metadata.metric_id == null ? undefined : String(sibling.metadata.metric_id),
      metric_code: typeof sibling.metadata.metric_code === "string" ? sibling.metadata.metric_code : undefined,
      measure_label: sibling.title,
      explanation: [
        ...plan.explanation,
        `Initial exact metric returned no rows; retried sibling metric "${sibling.title}" from dataset ${sibling.dataset_code ?? "unknown"}.`,
      ],
    };
    const fallbackExecution = await executePlan(fallbackPlan);
    if (rows(fallbackExecution).length > 0) return { plan: fallbackPlan, execution: fallbackExecution };
  }

  return { plan, execution };
}

export function answerText(question: string, plan: SemanticQueryPlan, result: Record<string, unknown>, matches: SemanticSearchResult[]) {
  const resultRows = rows(result);
  if (resultRows.length > 0) {
    const businessText = businessAnswerText(question, plan, resultRows);
    return {
      title: businessText.title,
      summary: businessText.summary,
      bullets: businessText.bullets,
      confidence: 82,
    };
  }

  if (plan.source === "gold_bouwen_wonen" && plan.measure_key) {
    const geographies = plan.geography_names?.length ? plan.geography_names.join(", ") : "the requested geography";
    const period =
      plan.year_start && plan.year_end ? `${plan.year_start}-${plan.year_end}`
        : plan.year ? String(plan.year)
          : "";
    const missingPeriod = !period;
    return {
      title: missingPeriod
        ? `Which year should Guara use for ${plan.measure_label ?? "this figure"} in ${geographies}?`
        : `No loaded value found for ${plan.measure_label ?? "this figure"} in ${geographies} for ${period}`,
      summary: missingPeriod
        ? `I found the indicator "${plan.measure_label}" and the place "${geographies}", but the question does not include a year. Public datasets often have different values per year, so Guara needs a year to return one clear number.`
        : `I found the indicator "${plan.measure_label}" and the place "${geographies}", but Guara does not currently have a loaded Gold value for ${period}. Try a nearby year or open the related dataset to inspect available periods.`,
      bullets: [
        `Indicator found: ${plan.measure_label}`,
        `Place found: ${geographies}`,
        missingPeriod ? "Add a year, for example: Totaal huurwoningen Rotterdam 2023." : `Year checked: ${period}`,
        "Guara only answers from values that are already loaded into the trusted Gold layer.",
      ],
      confidence: 72,
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

async function fetchPlannerCuration(matches: SemanticSearchResult[]): Promise<SemanticPlannerCuration> {
  if (!isSupabaseConfigured()) return {};
  const supabase = await getSupabaseClient();
  const curation: SemanticPlannerCuration = {};

  const { data: preferences } = await (supabase as any)
    .schema("semantic")
    .from("metric_preference")
    .select("normalized_metric_label, geography_type, calculation_code, preferred_measure_key, preferred_dataset_code, priority, reason")
    .eq("domain_id", "bouwen-en-wonen")
    .eq("is_active", true)
    .order("priority", { ascending: true });

  curation.metricPreferences = (preferences ?? []).map((row: any) => ({
    normalized_metric_label: String(row.normalized_metric_label ?? ""),
    geography_type: row.geography_type ?? null,
    calculation_code: row.calculation_code ?? null,
    preferred_measure_key: String(row.preferred_measure_key ?? ""),
    preferred_dataset_code: row.preferred_dataset_code ?? null,
    priority: Number(row.priority ?? 100),
    reason: row.reason ?? null,
  }));

  const measureKeys = measureKeysFromMatches(matches);
  if (measureKeys.length > 0) {
    const { data: grains } = await (supabase as any)
      .schema("semantic")
      .from("metric_grain")
      .select("measure_key, geography_type, period_type, min_year, max_year, fact_row_count, is_supported")
      .in("measure_key", measureKeys);

    curation.metricGrains = (grains ?? []).map((row: any) => ({
      measure_key: String(row.measure_key ?? ""),
      geography_type: String(row.geography_type ?? ""),
      period_type: row.period_type ?? null,
      min_year: row.min_year == null ? null : Number(row.min_year),
      max_year: row.max_year == null ? null : Number(row.max_year),
      fact_row_count: row.fact_row_count == null ? null : Number(row.fact_row_count),
      is_supported: row.is_supported ?? null,
    }));
  }

  return curation;
}

export const semanticSearchService = {
  async answer(question: string): Promise<SemanticAnswer> {
    const normalized = question.trim() || "Dutch public data";
    const intent = classifySemanticIntent(normalized);
    const objectTypes =
      intent === "dataset_lookup" ? ["dataset"]
        : intent === "measure_definition" ? ["measure"]
          : ["measure", "dataset", "geography"];
    const matches = await hybridSearch(normalized, objectTypes);
    const metricPhrase = extractSemanticMetricPhrase(normalized);
    const metricMatches =
      metricPhrase && metricPhrase.length >= 3 && metricPhrase.toLowerCase() !== normalized.toLowerCase()
        ? await hybridSearch(metricPhrase, ["measure"])
        : [];
    const curatedMatches = await curatedPatternMatches(normalized);
    const mergedMatches = Array.from(new Map([...curatedMatches, ...metricMatches, ...matches].map((match) => [`${match.object_type}:${match.object_id}`, match])).values());
    const curation = await fetchPlannerCuration(mergedMatches);
    const plan = buildSemanticQueryPlan(normalized, intent, mergedMatches, curation);
    const { plan: executedPlan, execution } = await executePlanWithFallback(plan, mergedMatches);
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
