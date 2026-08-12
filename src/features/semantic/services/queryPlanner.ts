import type { SemanticIntent, SemanticQueryPlan, SemanticSearchResult } from "../types";
import { resolveGeographiesFromQuestion } from "./geographyResolver";
import type { SemanticDatasetContract } from "./semanticContractService";
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
  profile_depth?: string | null;
}

export interface SemanticPlannerCuration {
  metricPreferences?: SemanticMetricPreference[];
  metricGrains?: SemanticMetricGrain[];
  datasetContracts?: SemanticDatasetContract[];
}

export function classifySemanticIntent(question: string): SemanticIntent {
  const lower = question.toLowerCase();
  if (/what does|meaning|definition|betekent|definitie/.test(lower)) return "measure_definition";
  if (/which dataset|do we have|dataset|gegevens|data about|data over/.test(lower)) return "dataset_lookup";
  if (/biggest increase|largest increase|strongest increase|grootste stijging|grootste toename|grootste daling|grootste afname|sterkst(?:e)? toe|sterkst(?:e)? toegenomen|hardst(?:e)? gestegen|stegen .*hardst|steeg .*hardst|nam .*toe|namen .*toe|daalde|daalden|decrease|decline|increase .*since|increased .*since/.test(lower)) return "rank_geographies";
  if (/change|changed|trend|since|after|ontwikkeling|ontwikkel|verander|sinds|vanaf/.test(lower)) return "trend";
  if (/\b(waar|where)\b.*\b(minste|minst|meeste|meest|hoogste|hoogst|laagste|laagst|duurste|goedkoopste|least|most|highest|lowest)\b/.test(lower)) return "rank_geographies";
  if (/\b(woningtype|woningtypes|type woningen|housing type|housing types)\b/.test(lower) && /\b(regio|region|per)\b/.test(lower)) return "compare_geographies";
  if (/\b(per|by|naar)\b/.test(lower)) return "compare_geographies";
  if (/share of|percentage of|what share|aandeel/.test(lower)) return "compare_geographies";
  if (/compare|vergelijk/.test(lower)) return "compare_geographies";
  if (/\b(how many|how much|hoeveel|what is|what are|what was|what were|wat is|wat zijn|wat was|wat waren)\b/.test(lower)) return "compare_geographies";
  if (/biggest increase|largest increase|strongest increase|grootste stijging|grootste toename|grootste daling|grootste afname|sterkst(?:e)? toe|sterkst(?:e)? toegenomen|hardst(?:e)? gestegen|stegen .*hardst|steeg .*hardst|nam .*toe|namen .*toe|daalde|daalden|decrease|decline|increase .*since|increased .*since/.test(lower)) return "rank_geographies";
  if (/change|changed|trend|since|after|ontwikkeling|ontwikkel|verander|sinds|vanaf/.test(lower)) return "trend";
  if (/which municipalities|find municipalities|municipalities.*most|top|highest|lowest|outliers|rank municipalities|gemeenten|meeste|hoogste|laagste/.test(lower)) return "rank_geographies";
  if (/\b(show|give|list|toon|laat zien)\b/.test(lower) && (MUNICIPALITIES.some((name) => lower.includes(name.toLowerCase())) || /\b(nederland|netherlands)\b/.test(lower))) return "compare_geographies";
  if (MUNICIPALITIES.some((name) => lower.includes(name.toLowerCase())) || PROVINCES.some((name) => lower.includes(name.toLowerCase())) || /\b(nederland|netherlands)\b/.test(lower)) return "compare_geographies";
  return "catalogue_search";
}

export function extractSemanticYears(question: string): { year?: number; year_start?: number; year_end?: number } {
  const years = Array.from(question.matchAll(/\b(19[7-9]\d|20[0-2]\d)\b/g))
    .filter((match) => {
      const before = question.slice(Math.max(0, match.index - 24), match.index).toLowerCase();
      const after = question.slice(match.index + match[0].length, Math.min(question.length, match.index + match[0].length + 24)).toLowerCase();
      const constructionContext = /(bouwjaar|gebouwd|bouwperiode|bouwjaarklasse)/.test(before) || /(bouwjaar|gebouwd|bouwperiode|bouwjaarklasse)/.test(after);
      return !constructionContext;
    })
    .map((match) => Number(match[1]));
  if (years.length >= 2) return { year_start: Math.min(...years), year_end: Math.max(...years) };
  if (years[0] && /\b(since|after|na|vanaf|sinds)\b/i.test(question)) return { year_start: years[0] };
  return { year: years[0] };
}

export function extractSemanticMetricPhrase(question: string): string {
  let phrase = question;
  for (const name of [...MUNICIPALITIES, ...PROVINCES]) {
    phrase = phrase.replace(new RegExp(`\\b${name}\\b`, "gi"), " ");
  }
  return phrase
    .replace(/\b(compare|show|give|list|toon|laat zien|which municipalities have|which municipalities|municipalities|gemeenten|gemeente|highest|lowest|most|least|top|trend|for|in|between|and|since|after|before|from|to|with|the|what does|mean|meaning|what share of|share of|were|was|national average|province|provincie|high|low|but|biggest increase|largest increase|strongest increase|waar|where|staan|staat|liggen|ligt|zijn|is|de|het|een|minste|minst|meeste|meest|hoogste|laagste|nederland|netherlands)\b/gi, " ")
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

function isUnresolvedGeographyReference(value: string): boolean {
  const normalized = normalizeSemanticText(value);
  return /^(these|those|selected|above|same|this|that)\s+(municipalities|gemeenten|places|geographies|regions|regios|provinces)$/.test(normalized)
    || /^(these|those|selected|above|same|this|that)$/.test(normalized)
    || /\b(these municipalities|those municipalities|selected municipalities|deze gemeenten|die gemeenten|bovenstaande gemeenten)\b/.test(normalized);
}

function containsMetricTerms(value: string): boolean {
  return /\b(beginstand|woningvoorraad|huurwoningen|woningen|woz|nieuwbouw|verkoopprijs|betalingsachterstand|betalingsachterstanden|zorgpremie|consumentenvertrouwen|woontevredenheid|indicator|metric|measure)\b/i.test(value);
}

function cleanPlacePhrase(value: string): string {
  return value
    .replace(/\b(19[7-9]\d|20[0-2]\d)\b/g, " ")
    .replace(/\b(province|provincie|municipality|municipalities|gemeente|gemeenten|city|stad|plaats|places|geographies|regions|regios|people|persons|residents|mensen|personen|inwoners|huishoudens|these|those|selected|above|same|this|that|deze|die|bovenstaande|the|de|het|een|of|van|in|met|meer|minder|veel|sinds|vanaf|na|tussen)\b/gi, " ")
    .replace(/[?.!,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPlacePhrases(question: string): string[] {
  const phrases: string[] = [];
  const prepositionMatches = question.matchAll(/\b(?:in|for|voor)\s+(.+?)(?=\s+\b(?:in|between|from|since|after|before|during|voor|tussen|vanaf|sinds|na)\b\s+(?:19[7-9]\d|20[0-2]\d)|\s+\b(?:between|from|since|after|before|during|tussen|vanaf|sinds|na)\b|\s+\b(?:19[7-9]\d|20[0-2]\d)\b|[?.!,;:]|$)/gi);
  for (const match of prepositionMatches) {
    const cleaned = cleanPlacePhrase(match[1] ?? "");
    if (!cleaned || normalizeSemanticText(cleaned) === "the national average") continue;
    if (isUnresolvedGeographyReference(match[1] ?? "") || containsMetricTerms(cleaned)) continue;
    phrases.push(...cleaned.split(/\s+(?:and|en|or|of)\s+|,/i).map(cleanPlacePhrase).filter(Boolean));
  }

  const provinceMatch = question.match(/\b(?:province|provincie)\s+(.+?)(?=\s+\b(?:in|between|from|since|after|before|during|voor|tussen|vanaf|sinds|na)\b|\s+\b(?:19[7-9]\d|20[0-2]\d)\b|[?.!,;:]|$)/i);
  if (provinceMatch?.[1]) phrases.push(cleanPlacePhrase(provinceMatch[1]));

  return uniqueStrings(phrases)
    .filter((phrase) => !/^(?:the requested period|national average|landelijk gemiddelde)$/i.test(phrase))
    .filter((phrase) => !isUnresolvedGeographyReference(phrase))
    .slice(0, 6);
}

function hasUnresolvedGeographyReference(question: string): boolean {
  return /\b(these|those|selected|above|same|this|that)\s+(municipalities|places|geographies|regions|provinces)\b/i.test(question)
    || /\b(deze|die|bovenstaande)\s+(gemeenten|plaatsen|regios|provincies)\b/i.test(question);
}

export function extractExcludedGeographies(question: string): string[] {
  const lower = question.toLowerCase();
  if (!/\b(excluding|exclude|zonder|behalve)\b/.test(lower)) return [];
  return MUNICIPALITIES.filter((name) => lower.includes(name.toLowerCase()));
}

export function rankSortDirection(question: string): "asc" | "desc" {
  return /\b(lowest|least|laagste|laagst|minst|minste|smallest|kleinste|goedkoopste|below|less than|under|onder|minder dan|grootste daling|grootste afname|sterkste daling|sterkste afname|daalde|daalden|decrease|decline)\b/i.test(question) ? "asc" : "desc";
}

export function extractValueFilter(question: string): { value_filter_operator?: "lt" | "lte" | "gt" | "gte"; value_filter?: number } {
  const match = question.match(/\b(below|under|less than|boven|above|over|more than|greater than|at least|at most|minder dan|meer dan)\s+([0-9][0-9.,]*)\b/i);
  if (!match) return {};
  const phrase = (match[1] ?? "").toLowerCase();
  const value = Number((match[2] ?? "").replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(value)) return {};
  if (["below", "under", "less than", "minder dan", "at most"].includes(phrase)) return { value_filter_operator: phrase === "at most" ? "lte" : "lt", value_filter: value };
  return { value_filter_operator: phrase === "at least" ? "gte" : "gt", value_filter: value };
}

export function questionMeasures(question: string, results: SemanticSearchResult[]): SemanticSearchResult[] {
  const normalizedQuestion = normalizeSemanticText(question);
  const seenLabels = new Set<string>();
  return results
    .filter((result) => ["measure", "metric"].includes(result.object_type) && result.metadata?.measure_key)
    .filter((result) => result.metadata?.resolution_layer === "semantic_concept" ? conceptMatchScore(result) > 0 : normalizedQuestion.includes(normalizeSemanticText(result.title)))
    .sort((left, right) =>
      (right.metadata?.resolution_layer === "semantic_concept" ? 1 : 0) - (left.metadata?.resolution_layer === "semantic_concept" ? 1 : 0)
      || conceptMatchScore(right) - conceptMatchScore(left)
      || readinessScore(right) - readinessScore(left)
      || right.rank_score - left.rank_score
      || normalizeSemanticText(right.title).length - normalizeSemanticText(left.title).length
    )
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

function readinessScore(result: SemanticSearchResult | undefined): number {
  if (result?.metadata?.explicit_metric_contract === true && result.metadata?.metadata_origin === "curated") return 100;
  if (result?.metadata?.explicit_metric_contract === true) return 70;
  if (result?.metadata?.is_contract_default_measure === true) return 60;
  const depth = String(result?.metadata?.profile_depth ?? "");
  const status = String(result?.metadata?.contract_status ?? "");
  if (depth === "fact_profiled") return 40;
  if (depth === "sample_profiled") return 30;
  if (status === "complete") return 25;
  if (status === "usable") return 20;
  if (depth === "metadata_only") return 5;
  return result?.metadata?.has_fact_data === true ? 10 : 0;
}

function conceptMatchScore(result: SemanticSearchResult | undefined): number {
  const value = result?.metadata?.concept_match_score;
  const score = typeof value === "number" ? value : Number(value);
  return Number.isFinite(score) ? score : 0;
}

function housingStockQuestion(question: string): boolean {
  const normalized = normalizeSemanticText(question);
  if (!/\b(woning|woningen|huis|huizen|house|houses|home|homes)\b/.test(normalized)) return false;
  if (/\b(woz|waarde|verkoopprijs|price|prices|euro|eur)\b/.test(normalized)) return false;
  return /\b(waar|where|staan|staat|liggen|ligt|hoeveel|how many|minste|minst|meeste|meest|least|most|highest|lowest|gemeenten|municipalities)\b/.test(normalized);
}

function housingValueQuestion(question: string): boolean {
  const normalized = normalizeSemanticText(question);
  if (/\b(verkoopprijs|koopprijs|sale price|transaction price)\b/.test(normalized)) return false;
  return /\b(woningwaarde|woz|woz waarde|waarde van woningen|home value|house value|property value)\b/.test(normalized);
}

function housingSatisfactionQuestion(question: string): boolean {
  const normalized = normalizeSemanticText(question);
  return /\b(tevreden|tevredenheid|satisfied|satisfaction)\b/.test(normalized)
    && /\b(woning|woningen|huis|huizen|woonomgeving|neighbourhood|omgeving|home|house)\b/.test(normalized);
}

function rentIncreaseQuestion(question: string): boolean {
  const normalized = normalizeSemanticText(question);
  return /\b(huurverhoging|huurverhogingen|rent increase|rent increases)\b/.test(normalized);
}

function housingStockScore(question: string, result: SemanticSearchResult): number {
  if (!housingStockQuestion(question)) return 0;
  const title = normalizeSemanticText(result.title);
  const unit = normalizeSemanticText(String(result.unit_code ?? result.metadata?.unit_code ?? ""));
  const datasetTitle = normalizeSemanticText(String(result.subtitle ?? result.metadata?.dataset_title ?? ""));
  let score = 0;
  if (unit === "count") score += 80;
  if (title.includes("woningvoorraad")) score += 60;
  if (title === "woningen") score += unit === "count" ? 35 : -80;
  if (title.includes("huur") || title.includes("woz") || title.includes("waarde") || title.includes("verkoopprijs")) score -= 60;
  if (datasetTitle.includes("waarde onroerende zaken")) score -= 100;
  return score;
}

function maxYearScore(result: SemanticSearchResult): number {
  const value = result.metadata?.max_year;
  const maxYear = typeof value === "number" ? value : Number(value);
  return Number.isFinite(maxYear) ? maxYear : 0;
}

function housingValueScore(question: string, result: SemanticSearchResult): number {
  if (!housingValueQuestion(question)) return 0;
  const title = normalizeSemanticText(result.title);
  const dataset = normalizeSemanticText(String(result.dataset_code ?? result.metadata?.dataset_code ?? ""));
  const datasetTitle = normalizeSemanticText(String(result.subtitle ?? result.metadata?.dataset_title ?? ""));
  const unit = normalizeSemanticText(String(result.unit_code ?? result.metadata?.unit_code ?? ""));
  let score = 0;
  if (title.includes("woz")) score += 120;
  if (title.includes("woningwaarde")) score += 40;
  if (title.includes("waarde") && title.includes("woningen")) score += 60;
  if (dataset === "85036ned") score += 100;
  if (unit.includes("eur")) score += 20;
  if (datasetTitle.includes("1997 2020")) score -= 80;
  if (datasetTitle.includes("waarde onroerende zaken") && !title.includes("woz")) score -= 40;
  score += Math.max(0, maxYearScore(result) - 2020) * 10;
  return score;
}

function housingSatisfactionScore(question: string, result: SemanticSearchResult): number {
  if (!housingSatisfactionQuestion(question)) return 0;
  const title = normalizeSemanticText(result.title);
  const dataset = normalizeSemanticText(String(result.dataset_code ?? result.metadata?.dataset_code ?? ""));
  const unit = normalizeSemanticText(String(result.unit_code ?? result.metadata?.unit_code ?? ""));
  let score = 0;
  if (title.includes("tevredenheid")) score += 120;
  if (title.includes("huidige woning")) score += 80;
  if (title.includes("woonomgeving")) score += /\b(omgeving|buurt|neighbourhood)\b/i.test(question) ? 60 : -20;
  if (dataset === "84571ned") score += 100;
  if (dataset === "84570ned") score += 50;
  if (dataset === "84569ned") score += 20;
  if (unit.includes("percent")) score += 30;
  score += Math.max(0, maxYearScore(result) - 2020) * 5;
  return score;
}

function rentIncreaseScore(question: string, result: SemanticSearchResult): number {
  if (!rentIncreaseQuestion(question)) return 0;
  const title = normalizeSemanticText(result.title);
  const dataset = normalizeSemanticText(String(result.dataset_code ?? result.metadata?.dataset_code ?? ""));
  const unit = normalizeSemanticText(String(result.unit_code ?? result.metadata?.unit_code ?? ""));
  const geographies = Array.isArray(result.metadata?.geography_types) ? result.metadata.geography_types.map(String) : [];
  let score = 0;
  if (title.includes("huurverhoging")) score += 80;
  if (title.includes("inclusief huurharmonisatie")) score += 80;
  if (title === "huurverhoging") score -= 40;
  if (dataset === "83162ned") score += 140;
  if (geographies.includes("municipality")) score += 100;
  if (unit.includes("percent")) score += 20;
  return score;
}

export function firstMeasure(question: string, results: SemanticSearchResult[]): SemanticSearchResult | undefined {
  const normalizedQuestion = normalizeSemanticText(question);
  const normalizedMetricPhrase = normalizeSemanticText(extractSemanticMetricPhrase(question));
  const metrics = results.filter((result) => ["measure", "metric"].includes(result.object_type) && result.metadata?.measure_key);
  if (/\b(woningtype|woningtypes|type woningen|housing type|housing types)\b/i.test(question)) {
    const housingStock = metrics.find((result) => result.dataset_code === "85035NED" && normalizeSemanticText(result.title) === "beginstand woningvoorraad");
    if (housingStock) return housingStock;
  }
  const ranked = [...metrics].sort((left, right) =>
    rentIncreaseScore(question, right) - rentIncreaseScore(question, left)
    || housingSatisfactionScore(question, right) - housingSatisfactionScore(question, left)
    || housingValueScore(question, right) - housingValueScore(question, left)
    || maxYearScore(right) - maxYearScore(left)
    || housingStockScore(question, right) - housingStockScore(question, left)
    || readinessScore(right) - readinessScore(left)
    || right.rank_score - left.rank_score
  );
  if (rentIncreaseQuestion(question)) return ranked[0];
  if (housingSatisfactionQuestion(question)) return ranked[0];
  if (housingValueQuestion(question)) return ranked[0];
  if (housingStockQuestion(question)) return ranked[0];
  return ranked.find((result) => normalizeSemanticText(result.title) === normalizedMetricPhrase)
    ?? ranked.find((result) => normalizedQuestion.includes(normalizeSemanticText(result.title)))
    ?? ranked.find((result) => essentialMetricLabel(result.title).length >= 3 && normalizedQuestion.includes(essentialMetricLabel(result.title)))
    ?? ranked[0];
}

export function derivedCalculationCode(question: string, intent: SemanticIntent, measures: SemanticSearchResult[]): string | undefined {
  const lower = question.toLowerCase();
  if (/\b(woningtype|woningtypes|type woningen|housing type|housing types)\b/.test(lower) && /\b(regio|region|per)\b/.test(lower)) return "category_breakdown";
  if (/\b(per|by|naar)\b/.test(lower)) return "category_breakdown";
  if (/share of|percentage of|what share|aandeel/.test(lower) && measures.length >= 2) return "share_of_total";
  if (/biggest increase|largest increase|strongest increase|grootste stijging|grootste toename|grootste daling|grootste afname|sterkst(?:e)? toe|sterkst(?:e)? toegenomen|hardst(?:e)? gestegen|stegen .*hardst|steeg .*hardst|nam .*toe|namen .*toe|daalde|daalden|decrease|decline|increase .*since|increased .*since/.test(lower)) return "change_rank";
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
    .filter((result) => ["measure", "metric"].includes(result.object_type) && result.metadata?.measure_key)
    .filter((result) => normalizeSemanticText(result.title) === normalizedLabel)
    .sort((left, right) => readinessScore(right) - readinessScore(left) || right.rank_score - left.rank_score);
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

function contractForMeasure(metric: SemanticSearchResult | undefined, contracts: SemanticDatasetContract[] = []): SemanticDatasetContract | undefined {
  const metricDatasetCode = metric?.dataset_code ?? (typeof metric?.metadata?.dataset_code === "string" ? metric.metadata.dataset_code : undefined);
  const metricMeasureKey = metric?.metadata?.measure_key == null ? undefined : String(metric.metadata.measure_key);
  return contracts.find((contract) => contract.dataset_code === metricDatasetCode)
    ?? contracts.find((contract) => contract.default_measure_key != null && String(contract.default_measure_key) === metricMeasureKey);
}

function categoryContractScore(question: string, metric: SemanticSearchResult, contracts: SemanticDatasetContract[] = []): number {
  const contract = contractForMeasure(metric, contracts);
  if (!contract?.default_breakdown_dimension) return 0;
  const normalizedQuestion = normalizeSemanticText(question);
  const normalizedBreakdown = normalizeSemanticText(contract.default_breakdown_dimension);
  const normalizedFilter = normalizeSemanticText(contract.default_filter_dimension ?? "");
  const normalizedDataset = normalizeSemanticText(contract.dataset_title ?? "");
  const normalizedDefaultValue = normalizeSemanticText(contract.default_filter_value ?? "");
  const breakdownStem = normalizedBreakdown.replace(/s$/, "");
  let score = 0;
  if (normalizedQuestion.includes(normalizedBreakdown) || normalizedQuestion.includes(`${breakdownStem}s`) || normalizedQuestion.includes(breakdownStem)) score += 50;
  if (normalizedFilter && normalizedQuestion.includes(normalizedFilter)) score += 15;
  if (normalizedDefaultValue && normalizedQuestion.includes(normalizedDefaultValue)) score += 10;
  for (const token of normalizedDataset.split(" ").filter((value) => value.length >= 3)) {
    if (normalizedQuestion.includes(token)) score += 3;
  }
  return score;
}

function categoryGeographyType(question: string, contract: SemanticDatasetContract): string | undefined {
  const types = contract.geography_types ?? [];
  if (/\b(regio|region|regional)\b/i.test(question) && types.includes("region")) return "region";
  if (/\b(municipalit|municipalities|gemeente|gemeenten)\b/i.test(question) && types.includes("municipality")) return "municipality";
  if (/\b(province|provincie)\b/i.test(question) && types.includes("province")) return "province";
  if (/\b(nederland|netherlands|country|landelijk)\b/i.test(question) && types.includes("country")) return "country";
  if (types.includes("municipality")) return "municipality";
  if (types.includes("region")) return "region";
  return types[0];
}

function categoryBreakdownDefaults(question: string, calculation: string | undefined, metric: SemanticSearchResult | undefined, contracts: SemanticDatasetContract[] = []): Partial<SemanticQueryPlan> {
  if (calculation !== "category_breakdown") return {};
  const contract = contractForMeasure(metric, contracts);
  if (contract?.default_breakdown_dimension) {
    return {
      dataset_code: contract.dataset_code,
      category_dimension_code: contract.default_breakdown_dimension,
      category_filter_dimension_code: contract.default_filter_dimension ?? undefined,
      category_filter_value: contract.default_filter_value ?? undefined,
      geography_type: categoryGeographyType(question, contract),
      contract_status: contract.contract_status ?? undefined,
      profile_depth: contract.profile_depth ?? undefined,
    };
  }
  if (!/\b(woningtype|woningtypes|type woningen|housing type|housing types)\b/i.test(question)) return {};
  return {
    dataset_code: "85035NED",
    category_dimension_code: "Woningtype",
    category_filter_dimension_code: "Woningkenmerk",
    category_filter_value: "Totaal woningen",
    geography_type: "municipality",
  };
}

function defaultCategoryFilters(question: string, metric: SemanticSearchResult | undefined, contract: SemanticDatasetContract | undefined): Record<string, string> | undefined {
  const filters: Record<string, string> = {};
  if (metric?.metadata?.category_filters && typeof metric.metadata.category_filters === "object" && !Array.isArray(metric.metadata.category_filters)) {
    Object.assign(filters, metric.metadata.category_filters as Record<string, string>);
  }
  if (contract?.default_filter_dimension && contract.default_filter_value) {
    filters[contract.default_filter_dimension] = contract.default_filter_value;
  }

  if (housingSatisfactionQuestion(question)) {
    filters.EigenaarOfHuurder = "Totaal";
    filters.Marges = "Waarde";
    const datasetCode = normalizeSemanticText(String(metric?.dataset_code ?? contract?.dataset_code ?? ""));
    if (datasetCode === "84571ned" || datasetCode === "84569ned") filters.Woningkenmerken = "Totaal woningen";
    if (datasetCode === "84570ned") filters.Huishoudkenmerken = "Type: Paar, totaal";
  }

  return Object.keys(filters).length ? filters : undefined;
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

function earliestSupportedYear(
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
    .map((grain) => grain.min_year)
    .filter((year): year is number => typeof year === "number" && Number.isFinite(year));
  return years.length ? Math.min(...years) : undefined;
}

function completeChangeRankYears(
  years: { year?: number; year_start?: number; year_end?: number },
  metric: SemanticSearchResult | undefined,
  geographyType: string | undefined,
  grains: SemanticMetricGrain[] = [],
  warnings: string[]
): { year?: number; year_start?: number; year_end?: number } {
  if (years.year_start == null || years.year_end != null) return years;
  const latestYear = latestSupportedYear(metric, geographyType, grains);
  if (!latestYear || latestYear <= years.year_start) return years;
  warnings.push(`No end year was specified, so Guara compared ${years.year_start} with the latest available year in Gold: ${latestYear}.`);
  return { year_start: years.year_start, year_end: latestYear };
}

function defaultChangeRankYears(
  years: { year?: number; year_start?: number; year_end?: number },
  metric: SemanticSearchResult | undefined,
  geographyType: string | undefined,
  grains: SemanticMetricGrain[] = [],
  warnings: string[]
): { year?: number; year_start?: number; year_end?: number } {
  if (years.year_start != null || years.year_end != null || years.year != null) return completeChangeRankYears(years, metric, geographyType, grains, warnings);
  const earliestYear = earliestSupportedYear(metric, geographyType, grains);
  const latestYear = latestSupportedYear(metric, geographyType, grains);
  if (!earliestYear || !latestYear || earliestYear >= latestYear) return years;
  warnings.push(`No period was specified, so Guara compared the earliest and latest available years in Gold: ${earliestYear}-${latestYear}.`);
  return { year_start: earliestYear, year_end: latestYear };
}

function geographyFromDefaultGrain(metric: SemanticSearchResult | undefined): string | undefined {
  const grain = typeof metric?.metadata?.default_grain === "string" ? metric.metadata.default_grain : "";
  if (grain.startsWith("municipality_")) return "municipality";
  if (grain.startsWith("province_")) return "province";
  if (grain.startsWith("region_")) return "region";
  if (grain.startsWith("national_")) return "country";
  return undefined;
}

function goldSourceForMetric(metric: SemanticSearchResult | undefined): SemanticQueryPlan["source"] {
  return metric?.domain_id === "inkomen-en-bestedingen" || metric?.metadata?.domain_id === "inkomen-en-bestedingen"
    ? "gold_inkomen_bestedingen"
    : "gold_bouwen_wonen";
}

export function buildSemanticQueryPlan(question: string, intent: SemanticIntent, results: SemanticSearchResult[], curation: SemanticPlannerCuration = {}): SemanticQueryPlan {
  const measures = questionMeasures(question, results);
  const geographyResolutions = resolveGeographiesFromQuestion(question, extractNamedGeographies(question));
  const countryScopeRanking = intent === "rank_geographies" && geographyResolutions.some((resolution) => resolution.geography_type === "country");
  const scopedGeographyResolutions = countryScopeRanking ? geographyResolutions.filter((resolution) => resolution.geography_type !== "country") : geographyResolutions;
  const geographyNames = scopedGeographyResolutions.map((resolution) => resolution.resolved_name);
  const geographyType = scopedGeographyResolutions[0]?.geography_type ?? (intent === "rank_geographies" ? "municipality" : undefined);
  const unresolvedGeographyReference = hasUnresolvedGeographyReference(question) && geographyNames.length === 0;
  let yearRange = extractSemanticYears(question);
  const warnings: string[] = [];
  const fallbackPrimary = housingStockQuestion(question) || housingValueQuestion(question) || housingSatisfactionQuestion(question) || rentIncreaseQuestion(question)
    ? firstMeasure(question, results) ?? measures[0]
    : measures[0] ?? firstMeasure(question, results);
  const calculation = derivedCalculationCode(question, intent, measures);
  const contractDefaultPrimary = calculation === "category_breakdown"
    ? results
      .filter((result) => ["measure", "metric"].includes(result.object_type) && result.metadata?.is_contract_default_measure === true)
      .sort((left, right) => categoryContractScore(question, right, curation.datasetContracts) - categoryContractScore(question, left, curation.datasetContracts) || right.rank_score - left.rank_score)[0]
    : undefined;
  const selectedPrimaryCandidate = contractDefaultPrimary ?? fallbackPrimary;
  const primaryMeasure = selectedPrimaryCandidate
    ? chooseCuratedMetric(selectedPrimaryCandidate.title, results, geographyType, calculation, yearRange, curation, warnings) ?? selectedPrimaryCandidate
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
  const categoryDefaults = categoryBreakdownDefaults(question, calculation, mainMeasure, curation.datasetContracts);
  const selectedContract = contractForMeasure(mainMeasure, curation.datasetContracts);
  const filters = defaultCategoryFilters(question, mainMeasure, selectedContract);
  const defaultGrainGeography = geographyFromDefaultGrain(mainMeasure);
  const effectiveGeographyType = geographyType ?? defaultGrainGeography ?? (intent === "rank_geographies" ? "municipality" : undefined);

  if (calculation === "change_rank") {
    yearRange = defaultChangeRankYears(yearRange, mainMeasure, effectiveGeographyType, curation.metricGrains, warnings);
  }

  if (!yearRange.year && !yearRange.year_start && !yearRange.year_end) {
    const latestYear = latestSupportedYear(mainMeasure, effectiveGeographyType, curation.metricGrains);
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
  const finalGeographyType = categoryDefaults.geography_type ?? effectiveGeographyType;
  const finalDatasetCode = categoryDefaults.dataset_code ?? mainMeasure.dataset_code ?? selectedContract?.dataset_code;
  const resolutionMethod =
    mainMeasure.metadata?.resolution_layer === "semantic_concept"
      ? "semantic_concept"
      : mainMeasure.metadata?.explicit_metric_contract === true && mainMeasure.metadata?.metadata_origin === "curated"
      ? "curated_contract"
      : mainMeasure.metadata?.explicit_metric_contract === true
        ? "generated_contract"
        : warnings.some((warning) => warning.includes("Applied curated metric preference"))
          ? "metric_preference"
          : normalizeSemanticText(mainMeasure.title) === normalizeSemanticText(extractSemanticMetricPhrase(question))
            ? "catalogue_exact_match"
            : "catalogue_lexical_match";

  return {
    intent: intent === "measure_definition" ? "measure_definition" : intent,
    source: goldSourceForMetric(mainMeasure),
    measure_key: String(mainMeasure.metadata.measure_key),
    secondary_measure_key: comparisonMeasure?.metadata.measure_key == null ? undefined : String(comparisonMeasure.metadata.measure_key),
    metric_code: typeof mainMeasure.metadata.metric_code === "string" ? mainMeasure.metadata.metric_code : mainMeasure.measure_code ?? undefined,
    semantic_concept_code: typeof mainMeasure.metadata.semantic_concept_code === "string" ? mainMeasure.metadata.semantic_concept_code : undefined,
    semantic_concept_label: typeof mainMeasure.metadata.semantic_concept_label === "string" ? mainMeasure.metadata.semantic_concept_label : undefined,
    calculation_code: calculation ?? "lookup",
    measure_label: mainMeasure.title,
    secondary_measure_label: comparisonMeasure?.title,
    dataset_code: finalDatasetCode,
    period_type: "year",
    grain: finalGeographyType
      ? {
        geography_type: finalGeographyType,
        period_type: "year",
        display_grain: `${finalGeographyType}_year`,
      }
      : undefined,
    expected_result_grain: finalGeographyType ? ["measure_key", "dataset_code", "geography_code", "calendar_year"] : undefined,
    resolution_method: resolutionMethod,
    category_dimension_code: categoryDefaults.category_dimension_code,
    category_filter_dimension_code: categoryDefaults.category_filter_dimension_code,
    category_filter_value: categoryDefaults.category_filter_value,
    category_filters: filters,
    contract_status: categoryDefaults.contract_status ?? selectedContract?.contract_status ?? (typeof mainMeasure.metadata.contract_status === "string" ? mainMeasure.metadata.contract_status : undefined),
    profile_depth: categoryDefaults.profile_depth ?? selectedContract?.profile_depth ?? (typeof mainMeasure.metadata.profile_depth === "string" ? mainMeasure.metadata.profile_depth : undefined),
    ...yearRange,
    geography_names: geographyNames,
    geography_type: finalGeographyType,
    requires_clarification: intent === "trend" && unresolvedGeographyReference ? "geography" : undefined,
    excluded_geography_names: extractExcludedGeographies(question),
    ...extractValueFilter(question),
    sort_direction: intent === "rank_geographies" || calculation === "change_rank" ? rankSortDirection(question) : undefined,
    limit: intent === "trend" && calculation !== "change_rank" ? 50 : 10,
    warnings,
    explanation: [
      `Resolved measure "${mainMeasure.title}".`,
      comparisonMeasure ? `Resolved secondary measure "${comparisonMeasure.title}".` : "",
      geographyResolutions.length ? `Resolved geography ${geographyResolutions.map((item) => `${item.input} -> ${item.resolved_name}`).join(", ")}.` : "",
    ].filter(Boolean),
  };
}
