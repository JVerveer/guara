import type { SemanticIntent, SemanticQueryPlan, SemanticSearchResult } from "../types";
import { resolveGeographiesFromQuestion } from "./geographyResolver";
import type {
  ExplicitMetricContract,
  SemanticCategoryValueContract,
  SemanticConcept,
  SemanticConceptMetricBinding,
  SemanticContractContext,
} from "./semanticContractService";
import { resolveDimensionFilters } from "./dimensionValueResolver";
import {
  classifySemanticIntent,
  extractExcludedGeographies,
  extractNamedGeographies,
  extractSemanticYears,
  extractValueFilter,
  rankSortDirection,
} from "./queryPlanner";
import { normalizeSemanticText } from "./semanticUtils";

interface ContractCandidate {
  contract: ExplicitMetricContract;
  concept?: SemanticConcept;
  binding?: SemanticConceptMetricBinding;
  score: number;
}

interface CategoryValueCandidate {
  contract: SemanticCategoryValueContract;
  score: number;
}

function synonymValues(value: Record<string, string[]> | null | undefined): string[] {
  return Object.values(value ?? {}).flat().filter(Boolean);
}

function tokenHits(question: string, values: string[]): number {
  const normalizedQuestion = normalizeSemanticText(question);
  let score = 0;
  for (const value of values.map(normalizeSemanticText).filter(Boolean)) {
    if (value.length >= 4 && normalizedQuestion.includes(value)) score += 60;
    for (const token of value.split(" ").filter((item) => item.length >= 4)) {
      if (normalizedQuestion.includes(token)) score += 6;
    }
  }
  return score;
}

function hasExclusion(question: string, exclusions: string[] | null | undefined): boolean {
  const normalizedQuestion = normalizeSemanticText(question);
  return (exclusions ?? []).map(normalizeSemanticText).some((exclusion) => exclusion && normalizedQuestion.includes(exclusion));
}

function constructionYear(question: string): number | null {
  const match = question.match(/\b(?:bouwjaar|gebouwd(?:e)?(?:\s+in)?|bouwperiode)\s*(19[0-9]\d|20[0-2]\d)\b/i)
    ?? question.match(/\b(19[0-9]\d|20[0-2]\d)\b(?=.*\b(?:bouwjaar|gebouwd(?:e)?|bouwperiode)\b)/i);
  if (!match?.[1]) return null;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

function categoryContainsConstructionYear(contract: SemanticCategoryValueContract, year: number | null): boolean {
  if (year == null || !/bouwjaar|bouwjaarklasse|bouwperiode/i.test(contract.dimension_code)) return false;
  const normalized = normalizeSemanticText(contract.category_name);
  const range = normalized.match(/\b(1[0-9]{3}|20[0-9]{2})\s+tot\s+(1[0-9]{3}|20[0-9]{2})\b/);
  if (range?.[1] && range[2]) return year >= Number(range[1]) && year < Number(range[2]);
  const from = normalized.match(/\bvanaf\s+(1[0-9]{3}|20[0-9]{2})\b/);
  if (from?.[1]) return year >= Number(from[1]);
  return normalized.includes(String(year));
}

function executableContract(contract: ExplicitMetricContract): boolean {
  const status = String(contract.contract_status ?? contract.metadata_origin ?? "");
  const execution = String(contract.execution_status ?? (contract.metadata_origin === "curated" ? "enabled" : "disabled"));
  return execution === "enabled" && ["reviewed", "curated"].includes(status);
}

function executableCategoryValueContract(contract: SemanticCategoryValueContract): boolean {
  const execution = String(contract.execution_status ?? "disabled");
  return execution === "enabled" && contract.is_unknown !== true;
}

function operationForIntent(intent: SemanticIntent, calculation: string): string {
  if (calculation === "ranking") return "ranking";
  if (calculation === "trend") return "trend";
  if (calculation === "comparison") return "comparison";
  return intent === "rank_geographies" ? "ranking" : intent === "trend" ? "trend" : "comparison";
}

function calculationForQuestion(question: string, intent: SemanticIntent): string {
  const lower = question.toLowerCase();
  if (/biggest increase|largest increase|strongest increase|grootste stijging/.test(lower)) return "change_rank";
  if (/share of|percentage of|what share|aandeel/.test(lower)) return "share_of_total";
  if (/trend|since|after|ontwikkeling|vanaf/.test(lower) || intent === "trend") return "trend";
  if (intent === "rank_geographies") return "ranking";
  return "comparison";
}

function contractSupports(contract: ExplicitMetricContract, operation: string): boolean {
  const supports = contract.supports ?? {};
  if (operation === "change_rank") return supports.percentage_change !== false && supports.trend !== false;
  if (operation === "share_of_total") return supports.comparison !== false;
  return supports[operation] !== false;
}

function categoryContractSupports(contract: SemanticCategoryValueContract, operation: string): boolean {
  const supports = contract.supports ?? {};
  if (operation === "change_rank") return supports.percentage_change !== false && supports.trend !== false;
  if (operation === "share_of_total") return false;
  return supports[operation] !== false;
}

function candidateScore(question: string, contract: ExplicitMetricContract, concept?: SemanticConcept, binding?: SemanticConceptMetricBinding): number {
  if (hasExclusion(question, contract.exclusions) || hasExclusion(question, concept?.exclusions)) return -Infinity;
  const contractText = [
    contract.metric_code,
    contract.label,
    contract.description ?? "",
    ...(contract.dataset_codes ?? []),
    ...synonymValues(contract.synonyms),
  ];
  const conceptText = concept
    ? [concept.concept_code, concept.label, concept.description ?? "", ...synonymValues(concept.synonyms)]
    : [];
  const originBoost = contract.metadata_origin === "curated" ? 140 : 20;
  const conceptBoost = concept ? 180 : 0;
  const bindingBoost = binding?.binding_role === "primary" ? 80 : 30;
  return tokenHits(question, contractText) + tokenHits(question, conceptText) + originBoost + conceptBoost + bindingBoost - (contract.selection_priority ?? 100);
}

function buildCandidates(question: string, context: SemanticContractContext, operation: string): ContractCandidate[] {
  const contractsByCode = new Map(context.metricContracts.map((contract) => [contract.metric_code, contract]));
  const conceptsByCode = new Map(context.concepts.map((concept) => [concept.concept_code, concept]));
  const candidates: ContractCandidate[] = [];

  for (const binding of context.conceptMetricBindings) {
    const contract = contractsByCode.get(binding.metric_code);
    const concept = conceptsByCode.get(binding.concept_code);
    if (!contract || !concept || !executableContract(contract) || !contractSupports(contract, operation)) continue;
    const score = candidateScore(question, contract, concept, binding);
    if (score > 0) candidates.push({ contract, concept, binding, score });
  }

  for (const contract of context.metricContracts) {
    if (!executableContract(contract) || !contractSupports(contract, operation)) continue;
    const score = candidateScore(question, contract);
    if (score > 0) candidates.push({ contract, score });
  }

  return candidates.sort((left, right) =>
    right.score - left.score
    || (left.contract.selection_priority ?? 100) - (right.contract.selection_priority ?? 100)
    || left.contract.metric_code.localeCompare(right.contract.metric_code)
  );
}

function categoryValueScore(question: string, contract: SemanticCategoryValueContract): number {
  const normalizedQuestion = normalizeSemanticText(question);
  const constructionYearMatch = categoryContainsConstructionYear(contract, constructionYear(question));
  const label = normalizeSemanticText(contract.label);
  const categoryName = normalizeSemanticText(contract.category_name);
  const synonyms = synonymValues(contract.synonyms);
  const normalizedSynonyms = [label, categoryName, ...synonyms.map(normalizeSemanticText)].filter(Boolean);
  const exactMatches = normalizedSynonyms.filter((value) => value.length >= 4 && normalizedQuestion.includes(value));

  if (contract.is_total && exactMatches.length === 0 && !constructionYearMatch) return 0;
  if (exactMatches.length === 0 && !constructionYearMatch) {
    const strongTokenMatch = normalizedSynonyms.some((value) => {
      const tokens = value.split(" ").filter((token) => token.length >= 5);
      if (tokens.length < 2) return false;
      return tokens.every((token) => normalizedQuestion.includes(token));
    });
    if (!strongTokenMatch) return 0;
  }

  const dimensionBoost = normalizeSemanticText(contract.dimension_code).split(" ")
    .some((token) => token.length >= 4 && normalizedQuestion.includes(token)) ? 25 : 0;
  const originBoost = contract.metadata_origin === "curated" ? 120 : 40;
  const totalPenalty = contract.is_total ? 80 : 0;
  return tokenHits(question, [contract.label, contract.category_name, contract.description ?? "", contract.dimension_code, ...synonyms])
    + originBoost
    + dimensionBoost
    + (constructionYearMatch ? 140 : 0)
    - totalPenalty
    - (contract.selection_priority ?? 60);
}

function buildCategoryValueCandidates(question: string, context: SemanticContractContext, operation: string): CategoryValueCandidate[] {
  return (context.categoryValueContracts ?? [])
    .filter((contract) => executableCategoryValueContract(contract) && categoryContractSupports(contract, operation))
    .map((contract) => ({ contract, score: categoryValueScore(question, contract) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) =>
      right.score - left.score
      || (left.contract.selection_priority ?? 60) - (right.contract.selection_priority ?? 60)
      || left.contract.contract_code.localeCompare(right.contract.contract_code)
    );
}

function geographyTypeFromGrain(grain: string | null | undefined): string | undefined {
  if (!grain) return undefined;
  if (grain.startsWith("municipality_")) return "municipality";
  if (grain.startsWith("province_")) return "province";
  if (grain.startsWith("region_")) return "region";
  if (grain.startsWith("national_") || grain.startsWith("country_")) return "country";
  return undefined;
}

function supportedGeographyTypes(contract: ExplicitMetricContract, binding?: SemanticConceptMetricBinding): string[] {
  const grains = binding?.allowed_grains?.length ? binding.allowed_grains : contract.valid_grains ?? [];
  return Array.from(new Set(grains.map(geographyTypeFromGrain).filter((value): value is string => Boolean(value))));
}

function supportedCategoryGeographyTypes(contract: SemanticCategoryValueContract): string[] {
  return Array.from(new Set((contract.valid_grains ?? []).map(geographyTypeFromGrain).filter((value): value is string => Boolean(value))));
}

function requestedGeographyType(question: string, intent: SemanticIntent, contract: ExplicitMetricContract, binding?: SemanticConceptMetricBinding): string | undefined {
  const supported = supportedGeographyTypes(contract, binding);
  const normalized = normalizeSemanticText(question);
  if (/\b(province|provincie)\b/.test(normalized) && supported.includes("province")) return "province";
  if (/\b(regio|region|regional)\b/.test(normalized) && supported.includes("region")) return "region";
  if (/\b(nederland|netherlands|landelijk|country)\b/.test(normalized) && intent !== "rank_geographies" && supported.includes("country")) return "country";
  const defaultType = geographyTypeFromGrain(binding?.allowed_grains?.[0] ?? contract.default_grain);
  if (defaultType && supported.includes(defaultType)) return defaultType;
  if (supported.includes("municipality")) return "municipality";
  if (supported.includes("province")) return "province";
  return supported[0];
}

function requestedCategoryGeographyType(question: string, intent: SemanticIntent, contract: SemanticCategoryValueContract): string | undefined {
  const supported = supportedCategoryGeographyTypes(contract);
  const normalized = normalizeSemanticText(question);
  if (/\b(province|provincie)\b/.test(normalized) && supported.includes("province")) return "province";
  if (/\b(regio|region|regional|gebied|gebieden)\b/.test(normalized) && supported.includes("region")) return "region";
  if (/\b(nederland|netherlands|landelijk|country|totaal)\b/.test(normalized) && intent !== "rank_geographies" && supported.includes("country")) return "country";
  const defaultType = geographyTypeFromGrain(contract.default_grain);
  if (defaultType && supported.includes(defaultType)) return defaultType;
  if (supported.includes("municipality")) return "municipality";
  if (supported.includes("region")) return "region";
  if (supported.includes("province")) return "province";
  return supported[0];
}

function latestYearForContract(contract: ExplicitMetricContract, geographyType: string | undefined, context: SemanticContractContext): number | undefined {
  const measureKey = String(contract.measure_key);
  const years = context.metricGrains
    .filter((grain) => grain.measure_key === measureKey)
    .filter((grain) => !geographyType || grain.geography_type === geographyType)
    .filter((grain) => grain.is_supported !== false)
    .map((grain) => grain.max_year)
    .filter((year): year is number => typeof year === "number" && Number.isFinite(year));
  return years.length ? Math.max(...years) : undefined;
}

function latestYearForCategoryContract(contract: SemanticCategoryValueContract, geographyType: string | undefined, context: SemanticContractContext): number | undefined {
  const measureKey = String(contract.measure_key);
  const years = context.metricGrains
    .filter((grain) => grain.measure_key === measureKey)
    .filter((grain) => !geographyType || grain.geography_type === geographyType)
    .filter((grain) => grain.is_supported !== false)
    .map((grain) => grain.max_year)
    .filter((year): year is number => typeof year === "number" && Number.isFinite(year));
  return years.length ? Math.max(...years) : undefined;
}

function contractResult(candidate: ContractCandidate): SemanticSearchResult {
  const datasetCode = candidate.binding?.dataset_code ?? candidate.contract.dataset_codes?.[0] ?? null;
  return {
    catalogue_item_id: `semantic-contract-engine:${candidate.contract.metric_code}`,
    object_type: "metric",
    object_id: String(candidate.contract.measure_key),
    title: candidate.concept?.label ?? candidate.contract.label,
    subtitle: `${datasetCode ?? "unknown dataset"} · ${candidate.contract.metric_code} · executable semantic contract`,
    description: candidate.concept?.description ?? candidate.contract.description,
    dataset_code: datasetCode,
    measure_code: candidate.contract.metric_code,
    geography_code: null,
    unit_code: candidate.contract.unit_code,
    domain_id: candidate.contract.domain_id,
    provider: "CBS",
    rank_score: candidate.score,
    lexical_score: candidate.score,
    vector_score: 0,
    metadata: {
      measure_key: String(candidate.binding?.measure_key ?? candidate.contract.measure_key),
      dataset_code: datasetCode,
      metric_code: candidate.contract.metric_code,
      unit_code: candidate.contract.unit_code,
      aggregation: candidate.contract.aggregation,
      valid_grains: candidate.binding?.allowed_grains?.length ? candidate.binding.allowed_grains : candidate.contract.valid_grains ?? [],
      default_grain: candidate.contract.default_grain,
      synonyms: candidate.contract.synonyms ?? {},
      exclusions: candidate.contract.exclusions ?? [],
      supports: candidate.contract.supports ?? {},
      category_filters: Object.keys(candidate.binding?.category_filters ?? {}).length ? candidate.binding?.category_filters : candidate.contract.category_filters ?? {},
      explicit_metric_contract: true,
      metadata_origin: candidate.contract.metadata_origin,
      contract_status: candidate.contract.contract_status,
      execution_status: candidate.contract.execution_status,
      semantic_quality_status: candidate.contract.semantic_quality_status,
      availability_status: candidate.contract.availability_status,
      availability_checked_at: candidate.contract.availability_checked_at,
      resolution_layer: "semantic_contract_engine",
      semantic_concept_code: candidate.concept?.concept_code,
      semantic_concept_label: candidate.concept?.label,
      has_fact_data: true,
    },
  };
}

function categoryValueResult(candidate: CategoryValueCandidate): SemanticSearchResult {
  const contract = candidate.contract;
  return {
    catalogue_item_id: `category-value-contract:${contract.contract_code}`,
    object_type: "metric",
    object_id: String(contract.measure_key),
    title: contract.label,
    subtitle: `${contract.dataset_code} · ${contract.dimension_code}=${contract.category_name} · category value contract`,
    description: contract.description,
    dataset_code: contract.dataset_code,
    measure_code: contract.metric_code,
    geography_code: null,
    unit_code: contract.unit_code,
    domain_id: contract.domain_id,
    provider: "CBS",
    rank_score: candidate.score,
    lexical_score: candidate.score,
    vector_score: 0,
    metadata: {
      measure_key: String(contract.measure_key),
      dataset_code: contract.dataset_code,
      metric_code: contract.metric_code,
      unit_code: contract.unit_code,
      aggregation: contract.aggregation,
      valid_grains: contract.valid_grains ?? [],
      default_grain: contract.default_grain,
      synonyms: contract.synonyms ?? {},
      exclusions: [],
      supports: contract.supports ?? {},
      category_filters: contract.category_filters ?? {},
      explicit_metric_contract: true,
      category_value_contract: true,
      metadata_origin: contract.metadata_origin,
      contract_status: contract.contract_status,
      execution_status: contract.execution_status,
      semantic_quality_status: contract.semantic_quality_status,
      availability_status: contract.availability_status,
      availability_checked_at: contract.availability_checked_at,
      resolution_layer: "semantic_category_value",
      semantic_concept_code: `category_value:${contract.dataset_code}:${contract.dimension_code}:${contract.category_code ?? contract.category_name}`,
      semantic_concept_label: contract.label,
      category_dimension_code: contract.dimension_code,
      category_code: contract.category_code,
      category_name: contract.category_name,
      has_fact_data: true,
    },
  };
}

export function buildContractQueryPlan(question: string, intent: SemanticIntent, context: SemanticContractContext): { plan?: SemanticQueryPlan; match?: SemanticSearchResult } {
  const calculation = calculationForQuestion(question, intent);
  const operation = operationForIntent(intent, calculation);
  const categoryCandidates = buildCategoryValueCandidates(question, context, operation);
  if (categoryCandidates.length === 1 || (categoryCandidates.length > 1 && categoryCandidates[0].score - categoryCandidates[1].score >= 25)) {
    const candidate = categoryCandidates[0];
    const metric = categoryValueResult(candidate);
    const geographyResolutions = resolveGeographiesFromQuestion(question, extractNamedGeographies(question));
    const countryScopeRanking = intent === "rank_geographies" && geographyResolutions.some((resolution) => resolution.geography_type === "country");
    const scopedGeographies = countryScopeRanking ? geographyResolutions.filter((resolution) => resolution.geography_type !== "country") : geographyResolutions;
    const geographyNames = scopedGeographies.map((resolution) => resolution.resolved_name);
    const geographyType = scopedGeographies[0]?.geography_type ?? requestedCategoryGeographyType(question, intent, candidate.contract);
    let yearRange = extractSemanticYears(question);
    const warnings: string[] = [];

    if (!yearRange.year && !yearRange.year_start && !yearRange.year_end) {
      const latest = latestYearForCategoryContract(candidate.contract, geographyType, context);
      if (latest) {
        yearRange = { year: latest };
        warnings.push(`No year was specified, so Guara used the latest available year in Gold: ${latest}.`);
      }
    }

    const baseCategoryFilters = metric.metadata.category_filters && typeof metric.metadata.category_filters === "object" && !Array.isArray(metric.metadata.category_filters)
      ? metric.metadata.category_filters as Record<string, string>
      : undefined;
    const resolvedDimensionFilters = resolveDimensionFilters(question, candidate.contract.dataset_code, baseCategoryFilters, context.dimensionContracts);
    const categoryFilters = resolvedDimensionFilters.filters;
    const plannedIntent = intent === "catalogue_search" && geographyNames.length ? "compare_geographies" : intent === "catalogue_search" ? classifySemanticIntent(question) : intent;

    return {
      match: metric,
      plan: {
        intent: plannedIntent,
        source: "gold_bouwen_wonen",
        measure_key: String(candidate.contract.measure_key),
        metric_code: candidate.contract.metric_code,
        semantic_concept_code: `category_value:${candidate.contract.dataset_code}:${candidate.contract.dimension_code}:${candidate.contract.category_code ?? candidate.contract.category_name}`,
        semantic_concept_label: candidate.contract.label,
        calculation_code: calculation,
        measure_label: candidate.contract.label,
        dataset_code: candidate.contract.dataset_code,
        period_type: "year",
        ...yearRange,
        geography_names: geographyNames,
        geography_type: geographyType,
        grain: geographyType ? {
          geography_type: geographyType,
          period_type: "year",
          display_grain: `${geographyType}_year`,
        } : undefined,
        expected_result_grain: geographyType ? ["measure_key", "dataset_code", "geography_code", "calendar_year"] : undefined,
        category_filters: categoryFilters,
        excluded_geography_names: extractExcludedGeographies(question),
        ...extractValueFilter(question),
        sort_direction: intent === "rank_geographies" ? rankSortDirection(question) : undefined,
        limit: intent === "trend" ? 50 : 10,
        semantic_confidence: 0.97,
        resolution_method: "semantic_contract_engine",
        contract_status: candidate.contract.contract_status ?? undefined,
        profile_depth: candidate.contract.semantic_quality_status ?? undefined,
        warnings,
        explanation: [
          `Selected category value contract "${candidate.contract.contract_code}".`,
          `Resolved category "${candidate.contract.dimension_code}=${candidate.contract.category_name}".`,
          `Selected deterministic dataset ${candidate.contract.dataset_code}.`,
          categoryFilters ? `Applied canonical filters ${Object.entries(categoryFilters).map(([key, value]) => `${key}=${value}`).join(", ")}.` : "",
          ...resolvedDimensionFilters.explanations,
        ].filter(Boolean),
      },
    };
  }

  const candidates = buildCandidates(question, context, operation);
  if (candidates.length !== 1 && (candidates.length === 0 || candidates[0].score - candidates[1].score < 40)) {
    return {};
  }

  const candidate = candidates[0];
  const metric = contractResult(candidate);
  const geographyResolutions = resolveGeographiesFromQuestion(question, extractNamedGeographies(question));
  const countryScopeRanking = intent === "rank_geographies" && geographyResolutions.some((resolution) => resolution.geography_type === "country");
  const scopedGeographies = countryScopeRanking ? geographyResolutions.filter((resolution) => resolution.geography_type !== "country") : geographyResolutions;
  const geographyNames = scopedGeographies.map((resolution) => resolution.resolved_name);
  const geographyType = scopedGeographies[0]?.geography_type ?? requestedGeographyType(question, intent, candidate.contract, candidate.binding);
  let yearRange = extractSemanticYears(question);
  const warnings: string[] = [];

  if (!yearRange.year && !yearRange.year_start && !yearRange.year_end) {
    const latest = latestYearForContract(candidate.contract, geographyType, context);
    if (latest) {
      yearRange = { year: latest };
      warnings.push(`No year was specified, so Guara used the latest available year in Gold: ${latest}.`);
    }
  }

  const baseCategoryFilters = metric.metadata.category_filters && typeof metric.metadata.category_filters === "object" && !Array.isArray(metric.metadata.category_filters)
    ? metric.metadata.category_filters as Record<string, string>
    : undefined;
  const datasetCode = candidate.binding?.dataset_code ?? candidate.contract.dataset_codes?.[0];
  const resolvedDimensionFilters = resolveDimensionFilters(question, datasetCode, baseCategoryFilters, context.dimensionContracts);
  const categoryFilters = resolvedDimensionFilters.filters;
  const plannedIntent = intent === "catalogue_search" && geographyNames.length ? "compare_geographies" : intent === "catalogue_search" ? classifySemanticIntent(question) : intent;

  return {
    match: metric,
    plan: {
      intent: plannedIntent,
      source: "gold_bouwen_wonen",
      measure_key: String(candidate.binding?.measure_key ?? candidate.contract.measure_key),
      metric_code: candidate.contract.metric_code,
      semantic_concept_code: candidate.concept?.concept_code,
      semantic_concept_label: candidate.concept?.label,
      calculation_code: calculation,
      measure_label: candidate.concept?.label ?? candidate.contract.label,
      dataset_code: datasetCode,
      period_type: "year",
      ...yearRange,
      geography_names: geographyNames,
      geography_type: geographyType,
      grain: geographyType ? {
        geography_type: geographyType,
        period_type: "year",
        display_grain: `${geographyType}_year`,
      } : undefined,
      expected_result_grain: geographyType ? ["measure_key", "dataset_code", "geography_code", "calendar_year"] : undefined,
      category_filters: categoryFilters,
      excluded_geography_names: extractExcludedGeographies(question),
      ...extractValueFilter(question),
      sort_direction: intent === "rank_geographies" ? rankSortDirection(question) : undefined,
      limit: intent === "trend" ? 50 : 10,
      semantic_confidence: 0.97,
      resolution_method: "semantic_contract_engine",
      contract_status: candidate.contract.contract_status ?? undefined,
      profile_depth: candidate.contract.semantic_quality_status ?? undefined,
      warnings,
      explanation: [
        `Selected executable semantic contract "${candidate.contract.metric_code}".`,
        candidate.concept ? `Resolved concept "${candidate.concept.label}".` : `Resolved metric "${candidate.contract.label}".`,
        datasetCode ? `Selected deterministic dataset ${datasetCode}.` : "",
        categoryFilters ? `Applied canonical filters ${Object.entries(categoryFilters).map(([key, value]) => `${key}=${value}`).join(", ")}.` : "",
        ...resolvedDimensionFilters.explanations,
      ].filter(Boolean),
    },
  };
}
