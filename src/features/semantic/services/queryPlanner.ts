import type { SemanticIntent, SemanticQueryPlan, SemanticSearchResult } from "../types";
import { resolveGeographiesFromQuestion } from "./geographyResolver";
import { normalizeSemanticText, uniqueStrings } from "./semanticUtils";

const MUNICIPALITIES = ["Amsterdam", "Rotterdam", "Utrecht", "Groningen", "Eindhoven", "Den Haag", "Maastricht", "Nijmegen", "Tilburg", "Almere", "Breda", "Haarlem", "Arnhem", "Amersfoort", "Leiden", "Zwolle", "Delft", "Enschede", "Apeldoorn", "Bloemendaal", "Blaricum", "Wassenaar", "Pekela", "Kerkrade"];
const PROVINCES = ["Drenthe", "Flevoland", "Friesland", "Gelderland", "Groningen", "Limburg", "Noord-Brabant", "Noord-Holland", "Overijssel", "Utrecht", "Zeeland", "Zuid-Holland"];

export interface SemanticMetricPreference {
  normalized_metric_label: string;
  geography_type?: string | null;
  calculation_code?: string | null;
  preferred_measure_key: string;
  preferred_dataset_code?: string | null;
  priority?: number | null;
  reason?: string | null;
}

export interface SemanticMetricGrain {
  measure_key: string;
  geography_type: string;
  period_type?: string | null;
  min_year?: number | null;
  max_year?: number | null;
  fact_row_count?: number | null;
  is_supported?: boolean | null;
}

export interface SemanticPlannerCuration {
  metricPreferences?: SemanticMetricPreference[];
  metricGrains?: SemanticMetricGrain[];
}

export function classifySemanticIntent(question: string): SemanticIntent {
  const lower = question.toLowerCase();
  if (/what does|meaning|definition|betekent|definitie/.test(lower)) return "measure_definition";
  if (/which dataset|do we have|dataset|gegevens|data about|data over/.test(lower)) return "dataset_lookup";
  if (/\b(woningtype|woningtypes|type woningen|housing type|housing types)\b/.test(lower) && /\b(regio|region|per)\b/.test(lower)) return "compare_geographies";
  if (/share of|percentage of|what share|aandeel/.test(lower)) return "compare_geographies";
  if (/compare|vergelijk/.test(lower)) return "compare_geographies";
  if (/\b(how many|how much|hoeveel)\b/.test(lower)) return "compare_geographies";
  if (/biggest increase|largest increase|strongest increase|grootste stijging/.test(lower)) return "rank_geographies";
  if (/change|changed|trend|since|after|ontwikkeling|verander/.test(lower)) return "trend";
  if (/which municipalities|find municipalities|municipalities.*most|top|highest|lowest|outliers|rank municipalities|gemeenten|meeste|hoogste|laagste/.test(lower)) return "rank_geographies";
  if (/\b(show|give|list|toon|laat zien)\b/.test(lower) && (MUNICIPALITIES.some((name) => lower.includes(name.toLowerCase())) || /\b(nederland|netherlands)\b/.test(lower))) return "compare_geographies";
  if (MUNICIPALITIES.some((name) => lower.includes(name.toLowerCase())) || PROVINCES.some((name) => lower.includes(name.toLowerCase())) || /\b(nederland|netherlands)\b/.test(lower)) return "compare_geographies";
  return "catalogue_search";
}

export function extractSemanticYears(question: string): { year?: number; year_start?: number; year_end?: number } {
  const years = Array.from(question.matchAll(/\b(19[7-9]\d|20[0-2]\d)\b/g)).map((match) => Number(match[1]));
  if (years.length >= 2) return { year_start: Math.min(...years), year_end: Math.max(...years) };
  if (years[0] && /\b(since|after|na|vanaf)\b/i.test(question)) return { year_start: years[0] };
  return { year: years[0] };
}

export function extractSemanticMetricPhrase(question: string): string {
  let phrase = question;
  for (const name of [...MUNICIPALITIES, ...PROVINCES]) {
    phrase = phrase.replace(new RegExp(`\\b${name}\\b`, "gi"), " ");
  }
  return phrase
    .replace(/\b(compare|show|give|list|toon|laat zien|which municipalities have|which municipalities|municipalities|gemeenten|gemeente|highest|lowest|most|least|top|trend|for|in|between|and|since|after|before|from|to|with|the|what does|mean|meaning|what share of|share of|were|was|national average|province|provincie|high|low|but|biggest increase|largest increase|strongest increase)\b/gi, " ")
    .replace(/\b(19[7-9]\d|20[0-2]\d)\b/g, " ")
    .replace(/[?.!,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractNamedGeographies(question: string): string[] {
  const lower = question.toLowerCase();
  const provinceMention = /\b(province|provincie)\b/.test(lower);
  const names = provinceMention ? [] : MUNICIPALITIES.filter((name) => lower.includes(name.toLowerCase()));
  const provinces = provinceMention ? PROVINCES.filter((name) => lower.includes(name.toLowerCase())) : [];
  const country = /\b(nederland|netherlands)\b/.test(lower) ? ["Nederland"] : [];
  return Array.from(new Set([...names, ...provinces, ...country, ...extractPlacePhrases(question)]));
}

function cleanPlacePhrase(value: string): string {
  return value
    .replace(/\b(19[7-9]\d|20[0-2]\d)\b/g, " ")
    .replace(/\b(province|provincie|municipality|gemeente|city|stad|plaats|the|de|het|een|of|van|in)\b/gi, " ")
    .replace(/[?.!,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPlacePhrases(question: string): string[] {
  const phrases: string[] = [];
  const prepositionMatches = question.matchAll(/\b(?:in|for|voor)\s+(.+?)(?=\s+\b(?:in|between|from|since|after|before|during|voor|tussen|vanaf|na)\b\s+(?:19[7-9]\d|20[0-2]\d)|\s+\b(?:between|from|since|after|before|during|tussen|vanaf|na)\b|\s+\b(?:19[7-9]\d|20[0-2]\d)\b|[?.!,;:]|$)/gi);
  for (const match of prepositionMatches) {
    const cleaned = cleanPlacePhrase(match[1] ?? "");
    if (!cleaned || normalizeSemanticText(cleaned) === "the national average") continue;
    phrases.push(...cleaned.split(/\s+(?:and|en|or|of)\s+|,/i).map(cleanPlacePhrase).filter(Boolean));
  }

  const provinceMatch = question.match(/\b(?:province|provincie)\s+(.+?)(?=\s+\b(?:in|between|from|since|after|before|during|voor|tussen|vanaf|na)\b|\s+\b(?:19[7-9]\d|20[0-2]\d)\b|[?.!,;:]|$)/i);
  if (provinceMatch?.[1]) phrases.push(cleanPlacePhrase(provinceMatch[1]));

  return uniqueStrings(phrases)
    .filter((phrase) => !/^(?:the requested period|national average|landelijk gemiddelde)$/i.test(phrase))
    .slice(0, 6);
}

export function extractExcludedGeographies(question: string): string[] {
  const lower = question.toLowerCase();
  if (!/\b(excluding|exclude|zonder|behalve)\b/.test(lower)) return [];
  return MUNICIPALITIES.filter((name) => lower.includes(name.toLowerCase()));
}

export function rankSortDirection(question: string): "asc" | "desc" {
  return /\b(lowest|least|laagste|minst|smallest|kleinste|below|less than|under|onder|minder dan)\b/i.test(question) ? "asc" : "desc";
}

export function extractValueFilter(question: string): { value_filter_operator?: "lt" | "lte" | "gt" | "gte"; value_filter?: number } {
  const match = question.match(/\b(below|under|less than|boven|above|over|more than|greater than|at least|at most|minder dan|meer dan)\s+([0-9][0-9.,]*)\b/i);
  if (!match) return {};
  const phrase = match[1].toLowerCase();
  const value = Number(match[2].replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(value)) return {};
  if (["below", "under", "less than", "minder dan", "at most"].includes(phrase)) return { value_filter_operator: phrase === "at most" ? "lte" : "lt", value_filter: value };
  return { value_filter_operator: phrase === "at least" ? "gte" : "gt", value_filter: value };
}

export function questionMeasures(question: string, results: SemanticSearchResult[]): SemanticSearchResult[] {
  const normalizedQuestion = normalizeSemanticText(question);
  const seenLabels = new Set<string>();
  return results
    .filter((result) => ["measure", "metric"].includes(result.object_type) && result.metadata?.measure_key && result.metadata?.has_fact_data === true)
    .filter((result) => normalizedQuestion.includes(normalizeSemanticText(result.title)))
    .sort((left, right) => normalizeSemanticText(right.title).length - normalizeSemanticText(left.title).length)
    .filter((result) => {
      const label = normalizeSemanticText(result.title);
      if (seenLabels.has(label)) return false;
      seenLabels.add(label);
      return true;
    });
}

function measureKey(result: SemanticSearchResult | undefined): string | undefined {
  const key = result?.metadata?.measure_key;
  return key == null ? undefined : String(key);
}

function essentialMetricLabel(title: string): string {
  return normalizeSemanticText(title).replace(/\b(totaal|total)\b/g, " ").replace(/\s+/g, " ").trim();
}

export function firstMeasure(question: string, results: SemanticSearchResult[]): SemanticSearchResult | undefined {
  const normalizedQuestion = normalizeSemanticText(question);
  const normalizedMetricPhrase = normalizeSemanticText(extractSemanticMetricPhrase(question));
  const metrics = results.filter((result) => ["measure", "metric"].includes(result.object_type) && result.metadata?.measure_key);
  if (/\b(woningtype|woningtypes|type woningen|housing type|housing types)\b/i.test(question)) {
    const housingStock = metrics.find((result) => result.dataset_code === "85035NED" && normalizeSemanticText(result.title) === "beginstand woningvoorraad");
    if (housingStock) return housingStock;
  }
  return metrics.find((result) => result.metadata?.has_fact_data === true && normalizeSemanticText(result.title) === normalizedMetricPhrase)
    ?? metrics.find((result) => normalizeSemanticText(result.title) === normalizedMetricPhrase)
    ?? metrics.find((result) => result.metadata?.has_fact_data === true && normalizedQuestion.includes(normalizeSemanticText(result.title)))
    ?? metrics.find((result) => normalizedQuestion.includes(normalizeSemanticText(result.title)))
    ?? metrics.find((result) => result.metadata?.has_fact_data === true && essentialMetricLabel(result.title).length >= 3 && normalizedQuestion.includes(essentialMetricLabel(result.title)))
    ?? metrics.find((result) => essentialMetricLabel(result.title).length >= 3 && normalizedQuestion.includes(essentialMetricLabel(result.title)))
    ?? metrics.find((result) => result.metadata?.has_fact_data === true)
    ?? metrics[0];
}

export function derivedCalculationCode(question: string, intent: SemanticIntent, measures: SemanticSearchResult[]): string | undefined {
  const lower = question.toLowerCase();
  if (/\b(woningtype|woningtypes|type woningen|housing type|housing types)\b/.test(lower) && /\b(regio|region|per)\b/.test(lower)) return "category_breakdown";
  if (/share of|percentage of|what share|aandeel/.test(lower) && measures.length >= 2) return "share_of_total";
  if (/biggest increase|largest increase|strongest increase|grootste stijging/.test(lower)) return "change_rank";
  if (/national average|landelijk gemiddelde|nationale gemiddelde/.test(lower)) return "compare_to_average";
  if (/\bhigh\b.*\blow\b|\bhoog\b.*\blaag\b/.test(lower) && measures.length >= 2) return "multi_metric_rank";
  if (intent === "compare_geographies" && measures.length >= 2) return "metric_comparison";
  if (intent === "rank_geographies") return "ranking";
  if (intent === "compare_geographies") return "comparison";
  if (intent === "trend") return "trend";
  if (intent === "measure_definition") return "lookup";
  return undefined;
}

function grainStatus(
  metric: SemanticSearchResult | undefined,
  geographyType: string | undefined,
  years: { year?: number; year_start?: number; year_end?: number },
  grains: SemanticMetricGrain[] = []
): "supported" | "unsupported" | "unknown" {
  const key = measureKey(metric);
  if (!key || !geographyType) return "unknown";
  const metricGrains = grains.filter((grain) => String(grain.measure_key) === key);
  if (metricGrains.length === 0) return "unknown";
  const start = years.year_start ?? years.year;
  const end = years.year_end ?? years.year;
  const matches = metricGrains.some((grain) => {
    if (grain.geography_type !== geographyType || grain.is_supported === false) return false;
    if (start != null && grain.max_year != null && start > grain.max_year) return false;
    if (end != null && grain.min_year != null && end < grain.min_year) return false;
    return true;
  });
  return matches ? "supported" : "unsupported";
}

function matchingPreferences(
  label: string,
  geographyType: string | undefined,
  calculation: string | undefined,
  preferences: SemanticMetricPreference[] = []
): SemanticMetricPreference[] {
  const normalizedLabel = normalizeSemanticText(label);
  return preferences
    .filter((preference) => preference.normalized_metric_label === normalizedLabel)
    .filter((preference) => !preference.geography_type || !geographyType || preference.geography_type === geographyType)
    .filter((preference) => !preference.calculation_code || !calculation || preference.calculation_code === calculation)
    .sort((left, right) => (left.priority ?? 100) - (right.priority ?? 100));
}

function metricCandidatesForLabel(label: string, results: SemanticSearchResult[]): SemanticSearchResult[] {
  const normalizedLabel = normalizeSemanticText(label);
  return results
    .filter((result) => ["measure", "metric"].includes(result.object_type) && result.metadata?.measure_key && result.metadata?.has_fact_data === true)
    .filter((result) => normalizeSemanticText(result.title) === normalizedLabel);
}

function chooseCuratedMetric(
  label: string,
  results: SemanticSearchResult[],
  geographyType: string | undefined,
  calculation: string | undefined,
  years: { year?: number; year_start?: number; year_end?: number },
  curation: SemanticPlannerCuration,
  warnings: string[]
): SemanticSearchResult | undefined {
  const candidates = metricCandidatesForLabel(label, results);
  if (candidates.length === 0) return undefined;

  for (const preference of matchingPreferences(label, geographyType, calculation, curation.metricPreferences)) {
    const preferred = candidates.find((candidate) => measureKey(candidate) === String(preference.preferred_measure_key))
      ?? candidates.find((candidate) => candidate.dataset_code === preference.preferred_dataset_code);
    if (!preferred) continue;
    const status = grainStatus(preferred, geographyType, years, curation.metricGrains);
    warnings.push(`Applied curated metric preference: ${label} -> ${preferred.dataset_code ?? "unknown dataset"}${preference.reason ? ` (${preference.reason})` : ""}.`);
    if (status === "unsupported") {
      warnings.push(`Curated metric preference for "${label}" does not advertise ${geographyType} grain for the requested period.`);
    }
    return preferred;
  }

  const supported = candidates.find((candidate) => grainStatus(candidate, geographyType, years, curation.metricGrains) === "supported");
  if (supported) return supported;

  const unknown = candidates.find((candidate) => grainStatus(candidate, geographyType, years, curation.metricGrains) === "unknown");
  if (unknown && geographyType) warnings.push(`No generated grain metadata found for "${label}" at ${geographyType} grain; proceeding with best semantic match.`);
  return unknown ?? candidates[0];
}

function calculationNeedsSecondaryMeasure(calculation: string | undefined): boolean {
  return ["share_of_total", "multi_metric_rank", "metric_comparison", "compare_to_average"].includes(calculation ?? "");
}

function categoryBreakdownDefaults(question: string, calculation: string | undefined): Partial<SemanticQueryPlan> {
  if (calculation !== "category_breakdown") return {};
  if (!/\b(woningtype|woningtypes|type woningen|housing type|housing types)\b/i.test(question)) return {};
  return {
    dataset_code: "85035NED",
    category_dimension_code: "Woningtype",
    category_filter_dimension_code: "Woningkenmerk",
    category_filter_value: "Totaal woningen",
    geography_type: "municipality",
  };
}

function latestSupportedYear(
  metric: SemanticSearchResult | undefined,
  geographyType: string | undefined,
  grains: SemanticMetricGrain[] = []
): number | undefined {
  const key = measureKey(metric);
  if (!key) return undefined;
  const years = grains
    .filter((grain) => String(grain.measure_key) === key)
    .filter((grain) => !geographyType || grain.geography_type === geographyType)
    .filter((grain) => grain.is_supported !== false)
    .map((grain) => grain.max_year)
    .filter((year): year is number => typeof year === "number" && Number.isFinite(year));
  return years.length ? Math.max(...years) : undefined;
}

export function buildSemanticQueryPlan(question: string, intent: SemanticIntent, results: SemanticSearchResult[], curation: SemanticPlannerCuration = {}): SemanticQueryPlan {
  const measures = questionMeasures(question, results);
  const geographyResolutions = resolveGeographiesFromQuestion(question, extractNamedGeographies(question));
  const geographyNames = geographyResolutions.map((resolution) => resolution.resolved_name);
  const geographyType = geographyResolutions[0]?.geography_type ?? (intent === "rank_geographies" ? "municipality" : undefined);
  let yearRange = extractSemanticYears(question);
  const warnings: string[] = [];
  const fallbackPrimary = measures[0] ?? firstMeasure(question, results);
  const calculation = derivedCalculationCode(question, intent, measures);
  const primaryMeasure = fallbackPrimary
    ? chooseCuratedMetric(fallbackPrimary.title, results, geographyType, calculation, yearRange, curation, warnings) ?? fallbackPrimary
    : undefined;
  const fallbackSecondary = calculationNeedsSecondaryMeasure(calculation)
    ? measures.find((measure) => normalizeSemanticText(measure.title) !== normalizeSemanticText(primaryMeasure?.title ?? ""))
    : undefined;
  const secondaryMeasure = fallbackSecondary
    ? chooseCuratedMetric(fallbackSecondary.title, results, geographyType, calculation, yearRange, curation, warnings) ?? fallbackSecondary
    : undefined;
  const [mainMeasure, comparisonMeasure] =
    calculation === "share_of_total" && primaryMeasure && secondaryMeasure && normalizeSemanticText(primaryMeasure.title).includes("totaal") && !normalizeSemanticText(secondaryMeasure.title).includes("totaal")
      ? [secondaryMeasure, primaryMeasure]
      : [primaryMeasure, secondaryMeasure];
  const categoryDefaults = categoryBreakdownDefaults(question, calculation);

  if (!yearRange.year && !yearRange.year_start && !yearRange.year_end) {
    const latestYear = latestSupportedYear(mainMeasure, geographyType, curation.metricGrains);
    if (latestYear) {
      yearRange = { year: latestYear };
      warnings.push(`No year was specified, so Guara used the latest available year in Gold: ${latestYear}.`);
    }
  }

  if (!mainMeasure) {
    return {
      intent,
      source: "semantic_catalogue",
      ...yearRange,
      geography_names: geographyNames,
      warnings,
      explanation: ["No Gold metric could be resolved."],
    };
  }

  const mainGrainStatus = grainStatus(mainMeasure, geographyType, yearRange, curation.metricGrains);
  if (mainGrainStatus === "unsupported") warnings.push(`Resolved metric "${mainMeasure.title}" has no generated support for ${geographyType ?? "requested"} grain in the requested period.`);
  if (mainGrainStatus === "unknown" && geographyType) warnings.push(`Generated grain metadata is missing for "${mainMeasure.title}" at ${geographyType} grain.`);
  if (comparisonMeasure) {
    const secondaryGrainStatus = grainStatus(comparisonMeasure, geographyType, yearRange, curation.metricGrains);
    if (secondaryGrainStatus === "unsupported") warnings.push(`Secondary metric "${comparisonMeasure.title}" has no generated support for ${geographyType ?? "requested"} grain in the requested period.`);
    if (secondaryGrainStatus === "unknown" && geographyType) warnings.push(`Generated grain metadata is missing for secondary metric "${comparisonMeasure.title}" at ${geographyType} grain.`);
  }

  return {
    intent: intent === "measure_definition" ? "measure_definition" : intent,
    source: "gold_bouwen_wonen",
    measure_key: String(mainMeasure.metadata.measure_key),
    secondary_measure_key: comparisonMeasure?.metadata.measure_key == null ? undefined : String(comparisonMeasure.metadata.measure_key),
    calculation_code: calculation ?? "lookup",
    measure_label: mainMeasure.title,
    secondary_measure_label: comparisonMeasure?.title,
    dataset_code: categoryDefaults.dataset_code,
    category_dimension_code: categoryDefaults.category_dimension_code,
    category_filter_dimension_code: categoryDefaults.category_filter_dimension_code,
    category_filter_value: categoryDefaults.category_filter_value,
    ...yearRange,
    geography_names: geographyNames,
    geography_type: categoryDefaults.geography_type ?? geographyType,
    excluded_geography_names: extractExcludedGeographies(question),
    ...extractValueFilter(question),
    sort_direction: intent === "rank_geographies" ? rankSortDirection(question) : undefined,
    limit: intent === "trend" ? 50 : 10,
    warnings,
    explanation: [
      `Resolved measure "${mainMeasure.title}".`,
      comparisonMeasure ? `Resolved secondary measure "${comparisonMeasure.title}".` : "",
      geographyResolutions.length ? `Resolved geography ${geographyResolutions.map((item) => `${item.input} -> ${item.resolved_name}`).join(", ")}.` : "",
    ].filter(Boolean),
  };
}
