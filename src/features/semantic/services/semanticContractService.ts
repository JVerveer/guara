import { getSupabaseClient, isSupabaseConfigured } from "@/data/supabase/client";
import type { SemanticSearchResult } from "../types";
import type { SemanticMetricGrain, SemanticMetricPreference } from "./queryPlanner";
import { normalizeSemanticText } from "./semanticUtils";

export interface SemanticDatasetContract {
  dataset_code: string;
  dataset_title: string | null;
  domain_id: string | null;
  data_availability_status: string | null;
  profile_depth: string | null;
  default_measure_key: string | null;
  default_measure_name: string | null;
  default_unit_code: string | null;
  default_breakdown_dimension: string | null;
  default_filter_dimension: string | null;
  default_filter_value: string | null;
  geography_types: string[] | null;
  period_types: string[] | null;
  dimension_codes: string[] | null;
  min_year: number | null;
  max_year: number | null;
  supported_query_shapes: string[] | null;
  contract_status: string | null;
}

interface SemanticMeasureProfile {
  dataset_code: string;
  measure_key: string;
  measure_code: string | null;
  measure_name: string;
  measure_description: string | null;
  unit_code: string | null;
  unit_name: string | null;
  default_aggregation: string | null;
  can_enable_metric: boolean | null;
  profile_depth: string | null;
  fact_row_count: number | string | null;
  populated_fact_row_count: number | string | null;
  min_year: number | null;
  max_year: number | null;
  geography_types: string[] | null;
  period_types: string[] | null;
}

export interface ExplicitMetricContract {
  metric_code: string;
  label: string;
  description: string | null;
  domain_id: string | null;
  measure_key: string;
  dataset_codes: string[] | null;
  unit_code: string | null;
  aggregation: string | null;
  valid_grains: string[] | null;
  default_grain: string | null;
  synonyms: Record<string, string[]> | null;
  exclusions: string[] | null;
  supports: Record<string, boolean> | null;
  category_filters: Record<string, string> | null;
  selection_priority: number | null;
  metadata_origin: string | null;
  contract_status?: string | null;
  execution_status?: string | null;
  semantic_quality_status?: string | null;
  availability_status?: string | null;
  availability_checked_at?: string | null;
}

export interface SemanticConcept {
  concept_code: string;
  label: string;
  description: string | null;
  domain_id: string | null;
  language_code: string | null;
  synonyms: Record<string, string[]> | null;
  exclusions: string[] | null;
  required_unit_code: string | null;
  default_grain: string | null;
  valid_grains: string[] | null;
  supported_operations: string[] | null;
  ambiguity_policy: string | null;
  metadata_origin: string | null;
}

export interface SemanticConceptMetricBinding {
  concept_code: string;
  metric_code: string;
  measure_key: string;
  dataset_code: string;
  binding_role: string | null;
  priority: number | null;
  required_unit_code: string | null;
  allowed_grains: string[] | null;
  category_filters: Record<string, string> | null;
  union_rule_code: string | null;
  selection_reason: string | null;
  metadata_origin: string | null;
}

export interface SemanticDimensionContract {
  dimension_code: string;
  dataset_code: string | null;
  domain_id: string | null;
  label: string;
  description: string | null;
  dimension_role: string | null;
  canonical_total_value: string | null;
  valid_values: Array<Record<string, unknown>> | null;
  value_synonyms: Record<string, unknown> | null;
  resolution_rules: Record<string, unknown> | null;
  supports_grouping: boolean | null;
  supports_filtering: boolean | null;
  metadata_origin: string | null;
  contract_status: string | null;
}

export interface SemanticCategoryValueContract {
  contract_code: string;
  domain_id: string | null;
  dataset_code: string;
  metric_code: string;
  measure_key: string;
  measure_name: string | null;
  unit_code: string | null;
  aggregation: string | null;
  dimension_code: string;
  category_code: string | null;
  category_name: string;
  label: string;
  description: string | null;
  synonyms: Record<string, string[]> | null;
  category_filters: Record<string, string> | null;
  valid_grains: string[] | null;
  default_grain: string | null;
  supports: Record<string, boolean> | null;
  is_total: boolean | null;
  is_unknown: boolean | null;
  selection_priority: number | null;
  metadata_origin: string | null;
  contract_status: string | null;
  execution_status: string | null;
  semantic_quality_status: string | null;
  availability_status: string | null;
  availability_checked_at: string | null;
}

export interface SemanticContractContext {
  contracts: SemanticDatasetContract[];
  metricContracts: ExplicitMetricContract[];
  concepts: SemanticConcept[];
  conceptMetricBindings: SemanticConceptMetricBinding[];
  dimensionContracts: SemanticDimensionContract[];
  categoryValueContracts?: SemanticCategoryValueContract[];
  results: SemanticSearchResult[];
  metricGrains: SemanticMetricGrain[];
  metricPreferences: SemanticMetricPreference[];
}

function relevanceScore(question: string, values: Array<string | null | undefined>): number {
  const normalizedQuestion = normalizeSemanticText(question);
  const tokens = new Set(normalizedQuestion.split(" ").filter((token) => token.length >= 3));
  let score = 0;
  for (const value of values) {
    const normalizedValue = normalizeSemanticText(value ?? "");
    if (!normalizedValue) continue;
    if (normalizedQuestion.includes(normalizedValue)) score += 5;
    for (const token of normalizedValue.split(" ")) {
      if (tokens.has(token)) score += 1;
    }
  }
  return score;
}

function profileBoost(profileDepth: string | null | undefined): number {
  if (profileDepth === "fact_profiled") return 0.3;
  if (profileDepth === "sample_profiled") return 0.2;
  if (profileDepth === "metadata_only") return 0.05;
  return 0;
}

function contractByDataset(contracts: SemanticDatasetContract[]): Map<string, SemanticDatasetContract> {
  return new Map(contracts.map((contract) => [contract.dataset_code, contract]));
}

function synonymValues(contract: ExplicitMetricContract): string[] {
  const synonyms = contract.synonyms ?? {};
  return Object.values(synonyms).flat().filter(Boolean);
}

function conceptSynonymValues(concept: SemanticConcept): string[] {
  const synonyms = concept.synonyms ?? {};
  return Object.values(synonyms).flat().filter(Boolean);
}

function explicitContractToResult(contract: ExplicitMetricContract, question: string): SemanticSearchResult {
  const normalizedQuestion = normalizeSemanticText(question);
  const exclusions = (contract.exclusions ?? []).map(normalizeSemanticText);
  const exclusionPenalty = exclusions.some((exclusion) => exclusion && normalizedQuestion.includes(exclusion)) ? -500 : 0;
  const score = relevanceScore(question, [
    contract.metric_code,
    contract.label,
    contract.description,
    ...(contract.dataset_codes ?? []),
    ...(contract.valid_grains ?? []),
    ...synonymValues(contract),
  ]) + (contract.metadata_origin === "curated" ? 200 : 80) - (contract.selection_priority ?? 100) + exclusionPenalty;
  const datasetCode = contract.dataset_codes?.[0] ?? null;

  return {
    catalogue_item_id: `explicit-metric-contract:${contract.metric_code}`,
    object_type: "metric",
    object_id: String(contract.measure_key),
    title: contract.label,
    subtitle: `${datasetCode ?? "unknown dataset"} · ${contract.metric_code} · explicit metric contract`,
    description: contract.description,
    dataset_code: datasetCode,
    measure_code: contract.metric_code,
    geography_code: null,
    unit_code: contract.unit_code,
    domain_id: contract.domain_id,
    provider: "CBS",
    rank_score: score,
    lexical_score: score,
    vector_score: 0,
    metadata: {
      measure_key: String(contract.measure_key),
      dataset_code: datasetCode,
      metric_code: contract.metric_code,
      unit_code: contract.unit_code,
      aggregation: contract.aggregation,
      valid_grains: contract.valid_grains ?? [],
      default_grain: contract.default_grain,
      synonyms: contract.synonyms ?? {},
      exclusions: contract.exclusions ?? [],
      supports: contract.supports ?? {},
      category_filters: contract.category_filters ?? {},
      explicit_metric_contract: true,
      metadata_origin: contract.metadata_origin,
      contract_status: contract.contract_status ?? (contract.metadata_origin === "curated" ? "curated" : "generated"),
      execution_status: contract.execution_status ?? (contract.metadata_origin === "curated" ? "enabled" : "disabled"),
      semantic_quality_status: contract.semantic_quality_status ?? (contract.metadata_origin === "curated" ? "curated" : "incomplete"),
      availability_status: contract.availability_status ?? "unknown",
      availability_checked_at: contract.availability_checked_at ?? null,
      profile_depth: contract.metadata_origin === "curated" ? "contract_curated" : "contract_generated",
      has_fact_data: true,
    },
  };
}

function conceptScore(question: string, concept: SemanticConcept): number {
  const normalizedQuestion = normalizeSemanticText(question);
  const exclusions = (concept.exclusions ?? []).map(normalizeSemanticText);
  const exclusionPenalty = exclusions.some((exclusion) => exclusion && normalizedQuestion.includes(exclusion)) ? -1000 : 0;
  if (exclusionPenalty < 0) return exclusionPenalty;

  const synonyms = conceptSynonymValues(concept);
  const exactPhraseHits = synonyms
    .map(normalizeSemanticText)
    .filter((synonym) => synonym.length >= 4 && normalizedQuestion.includes(synonym));
  const strongTokenHits = synonyms
    .map(normalizeSemanticText)
    .filter((synonym) => {
      const tokens = synonym.split(" ").filter((token) => token.length >= 4);
      if (tokens.length < 2) return false;
      const hits = tokens.filter((token) => normalizedQuestion.includes(token)).length;
      return hits >= Math.max(2, Math.ceil(tokens.length * 0.65));
    });

  if (exactPhraseHits.length === 0 && strongTokenHits.length === 0) return 0;

  return relevanceScore(question, [
    concept.concept_code,
    concept.label,
    concept.description,
    concept.required_unit_code,
    concept.default_grain,
    ...(concept.valid_grains ?? []),
    ...synonyms,
  ]) + (concept.metadata_origin === "curated" ? 250 : 50);
}

function conceptBoundMetricToResult(
  concept: SemanticConcept,
  binding: SemanticConceptMetricBinding,
  contract: ExplicitMetricContract,
  question: string
): SemanticSearchResult | null {
  const score = conceptScore(question, concept);
  if (score <= 0) return null;
  const base = explicitContractToResult(contract, question);
  const bindingBoost = binding.binding_role === "primary" ? 150 : 80;
  return {
    ...base,
    catalogue_item_id: `semantic-concept-binding:${concept.concept_code}:${binding.metric_code}:${binding.binding_role ?? "primary"}`,
    title: concept.label,
    description: concept.description ?? contract.description,
    subtitle: `${binding.dataset_code} · ${concept.concept_code} · concept-bound metric`,
    rank_score: score + bindingBoost - (binding.priority ?? 100),
    lexical_score: score + bindingBoost - (binding.priority ?? 100),
    metadata: {
      ...base.metadata,
      measure_key: String(binding.measure_key),
      dataset_code: binding.dataset_code,
      metric_code: binding.metric_code,
      semantic_concept_code: concept.concept_code,
      semantic_concept_label: concept.label,
      concept_match_score: score,
      concept_description: concept.description,
      concept_required_unit_code: concept.required_unit_code,
      concept_default_grain: concept.default_grain,
      concept_valid_grains: concept.valid_grains ?? [],
      concept_supported_operations: concept.supported_operations ?? [],
      concept_ambiguity_policy: concept.ambiguity_policy,
      concept_binding_role: binding.binding_role ?? "primary",
      concept_binding_priority: binding.priority ?? 100,
      concept_selection_reason: binding.selection_reason,
      concept_allowed_grains: binding.allowed_grains ?? [],
      category_filters: Object.keys(binding.category_filters ?? {}).length ? binding.category_filters : base.metadata.category_filters,
      resolution_layer: "semantic_concept",
      explicit_metric_contract: true,
      metadata_origin: concept.metadata_origin ?? "curated",
    },
  };
}

function contractToDatasetResult(contract: SemanticDatasetContract, question: string): SemanticSearchResult {
  const score = relevanceScore(question, [
    contract.dataset_code,
    contract.dataset_title,
    contract.default_measure_name,
    contract.default_breakdown_dimension,
    contract.default_filter_dimension,
    contract.default_filter_value,
    ...(contract.dimension_codes ?? []),
  ]) + profileBoost(contract.profile_depth);

  return {
    catalogue_item_id: `semantic-contract-dataset:${contract.dataset_code}`,
    object_type: "dataset",
    object_id: contract.dataset_code,
    title: contract.dataset_title ?? contract.dataset_code,
    subtitle: `${contract.dataset_code} · ${contract.contract_status ?? "semantic contract"}`,
    description: null,
    dataset_code: contract.dataset_code,
    measure_code: null,
    geography_code: null,
    unit_code: contract.default_unit_code,
    domain_id: contract.domain_id,
    provider: "CBS",
    rank_score: score,
    lexical_score: score,
    vector_score: 0,
    metadata: {
      ...contract,
      semantic_contract: true,
      has_fact_data: contract.profile_depth !== "metadata_only",
    },
  };
}

function contractToDefaultMetricResult(contract: SemanticDatasetContract, question: string): SemanticSearchResult | null {
  if (!contract.default_measure_key || !contract.default_measure_name) return null;
  const score = relevanceScore(question, [
    contract.default_measure_name,
    contract.dataset_code,
    contract.dataset_title,
    contract.default_breakdown_dimension,
    contract.default_filter_dimension,
    contract.default_filter_value,
    ...(contract.dimension_codes ?? []),
  ]) + profileBoost(contract.profile_depth) + 50;

  return {
    catalogue_item_id: `semantic-contract-default-metric:${contract.default_measure_key}`,
    object_type: "metric",
    object_id: String(contract.default_measure_key),
    title: contract.default_measure_name,
    subtitle: `${contract.dataset_code} · default semantic metric · ${contract.profile_depth ?? "profile unknown"}`,
    description: null,
    dataset_code: contract.dataset_code,
    measure_code: null,
    geography_code: null,
    unit_code: contract.default_unit_code,
    domain_id: contract.domain_id,
    provider: "CBS",
    rank_score: score,
    lexical_score: score,
    vector_score: 0,
    metadata: {
      measure_key: String(contract.default_measure_key),
      dataset_code: contract.dataset_code,
      unit_code: contract.default_unit_code,
      profile_depth: contract.profile_depth,
      contract_status: contract.contract_status,
      default_breakdown_dimension: contract.default_breakdown_dimension,
      default_filter_dimension: contract.default_filter_dimension,
      default_filter_value: contract.default_filter_value,
      supported_query_shapes: contract.supported_query_shapes ?? [],
      min_year: contract.min_year,
      max_year: contract.max_year,
      geography_types: contract.geography_types ?? [],
      period_types: contract.period_types ?? [],
      semantic_contract: true,
      is_contract_default_measure: true,
      has_fact_data: contract.profile_depth !== "metadata_only",
    },
  };
}

function categoryValueToResult(contract: SemanticCategoryValueContract, question: string): SemanticSearchResult {
  const score = relevanceScore(question, [
    contract.contract_code,
    contract.metric_code,
    contract.label,
    contract.description,
    contract.dimension_code,
    contract.category_code,
    contract.category_name,
    contract.measure_name,
    contract.dataset_code,
    ...Object.values(contract.synonyms ?? {}).flat().filter(Boolean),
  ]) + (contract.metadata_origin === "curated" ? 120 : 40) - (contract.selection_priority ?? 60);

  return {
    catalogue_item_id: `category-value-contract:${contract.contract_code}`,
    object_type: "category",
    object_id: contract.contract_code,
    title: contract.label,
    subtitle: `${contract.dataset_code} · ${contract.dimension_code}=${contract.category_name}`,
    description: contract.description,
    dataset_code: contract.dataset_code,
    measure_code: contract.metric_code,
    geography_code: null,
    unit_code: contract.unit_code,
    domain_id: contract.domain_id,
    provider: "CBS",
    rank_score: score,
    lexical_score: score,
    vector_score: 0,
    metadata: {
      measure_key: String(contract.measure_key),
      dataset_code: contract.dataset_code,
      metric_code: contract.metric_code,
      measure_name: contract.measure_name,
      unit_code: contract.unit_code,
      aggregation: contract.aggregation,
      valid_grains: contract.valid_grains ?? [],
      default_grain: contract.default_grain,
      category_filters: contract.category_filters ?? {},
      category_value_contract: true,
      category_dimension_code: contract.dimension_code,
      category_code: contract.category_code,
      category_name: contract.category_name,
      is_total: contract.is_total,
      is_unknown: contract.is_unknown,
      metadata_origin: contract.metadata_origin,
      contract_status: contract.contract_status,
      execution_status: contract.execution_status,
      semantic_quality_status: contract.semantic_quality_status,
      availability_status: contract.availability_status,
      availability_checked_at: contract.availability_checked_at,
      profile_depth: contract.semantic_quality_status,
      has_fact_data: contract.execution_status === "enabled",
    },
  };
}

function measureToResult(measure: SemanticMeasureProfile, contract: SemanticDatasetContract | undefined, question: string): SemanticSearchResult {
  const isContractDefault = contract?.default_measure_key != null && String(contract.default_measure_key) === String(measure.measure_key);
  const score = relevanceScore(question, [
    measure.measure_name,
    measure.measure_code,
    measure.measure_description,
    measure.dataset_code,
    contract?.dataset_title,
    contract?.default_breakdown_dimension,
    contract?.default_filter_dimension,
    contract?.default_filter_value,
    ...(contract?.dimension_codes ?? []),
  ]) + profileBoost(measure.profile_depth ?? contract?.profile_depth) + (isContractDefault ? 25 : 0);

  return {
    catalogue_item_id: `semantic-contract-metric:${measure.measure_key}`,
    object_type: "metric",
    object_id: String(measure.measure_key),
    title: measure.measure_name,
    subtitle: `${measure.dataset_code} · ${measure.unit_code ?? "unit unknown"} · ${measure.profile_depth ?? contract?.profile_depth ?? "profile unknown"}`,
    description: measure.measure_description,
    dataset_code: measure.dataset_code,
    measure_code: measure.measure_code,
    geography_code: null,
    unit_code: measure.unit_code,
    domain_id: contract?.domain_id ?? null,
    provider: "CBS",
    rank_score: score,
    lexical_score: score,
    vector_score: 0,
    metadata: {
      measure_key: String(measure.measure_key),
      dataset_code: measure.dataset_code,
      unit_code: measure.unit_code,
      unit_name: measure.unit_name,
      aggregation: measure.default_aggregation,
      can_enable_metric: measure.can_enable_metric,
      profile_depth: measure.profile_depth ?? contract?.profile_depth ?? null,
      contract_status: contract?.contract_status ?? null,
      default_breakdown_dimension: contract?.default_breakdown_dimension ?? null,
      default_filter_dimension: contract?.default_filter_dimension ?? null,
      default_filter_value: contract?.default_filter_value ?? null,
      supported_query_shapes: contract?.supported_query_shapes ?? [],
      min_year: measure.min_year ?? contract?.min_year ?? null,
      max_year: measure.max_year ?? contract?.max_year ?? null,
      geography_types: measure.geography_types ?? contract?.geography_types ?? [],
      period_types: measure.period_types ?? contract?.period_types ?? [],
      semantic_contract: true,
      is_contract_default_measure: isContractDefault,
      has_fact_data: (measure.profile_depth ?? contract?.profile_depth) !== "metadata_only",
    },
  };
}

export async function fetchSemanticContractContext(question: string): Promise<SemanticContractContext> {
  if (!isSupabaseConfigured()) return { contracts: [], metricContracts: [], concepts: [], conceptMetricBindings: [], dimensionContracts: [], categoryValueContracts: [], results: [], metricGrains: [], metricPreferences: [] };
  const supabase = await getSupabaseClient();

  const { data, error } = await (supabase as any).rpc("guara_semantic_contract_context", {
    domain_id: "bouwen-en-wonen",
    contract_limit: 1000,
    measure_limit: 5000,
    grain_limit: 10000,
  });

  if (error) {
    console.warn("Could not read semantic contract context", error);
    return { contracts: [], metricContracts: [], concepts: [], conceptMetricBindings: [], dimensionContracts: [], categoryValueContracts: [], results: [], metricGrains: [], metricPreferences: [] };
  }

  const payload = (data ?? {}) as {
    contracts?: unknown[];
    metric_contracts?: unknown[];
    concepts?: unknown[];
    concept_metric_bindings?: unknown[];
    dimension_contracts?: unknown[];
    category_value_contracts?: unknown[];
    measures?: unknown[];
    grains?: unknown[];
    curated_grains?: unknown[];
    metric_preferences?: unknown[];
  };
  const contracts = (payload.contracts ?? []) as SemanticDatasetContract[];
  const explicitContracts = (payload.metric_contracts ?? []) as ExplicitMetricContract[];
  const concepts = (payload.concepts ?? []) as SemanticConcept[];
  const conceptMetricBindings = (payload.concept_metric_bindings ?? []) as SemanticConceptMetricBinding[];
  const dimensionContracts = (payload.dimension_contracts ?? []) as SemanticDimensionContract[];
  const categoryValueContracts = (payload.category_value_contracts ?? []) as SemanticCategoryValueContract[];
  const explicitContractsByCode = new Map(explicitContracts.map((contract) => [contract.metric_code, contract]));
  const contractsByDataset = contractByDataset(contracts);
  const measures = ((payload.measures ?? []) as SemanticMeasureProfile[]).filter((measure) => measure.can_enable_metric !== false);
  const conceptBoundResults = conceptMetricBindings
    .map((binding) => {
      const concept = concepts.find((item) => item.concept_code === binding.concept_code);
      const contract = explicitContractsByCode.get(binding.metric_code);
      return concept && contract ? conceptBoundMetricToResult(concept, binding, contract, question) : null;
    })
    .filter((result): result is SemanticSearchResult => result != null);

  const results = [
    ...conceptBoundResults,
    ...explicitContracts.map((contract) => explicitContractToResult(contract, question)),
    ...categoryValueContracts.map((contract) => categoryValueToResult(contract, question)),
    ...contracts.map((contract) => contractToDatasetResult(contract, question)),
    ...contracts.map((contract) => contractToDefaultMetricResult(contract, question)).filter((result): result is SemanticSearchResult => result != null),
    ...measures.map((measure) => measureToResult(measure, contractsByDataset.get(measure.dataset_code), question)),
  ]
    .filter((result) => result.rank_score > 0 || result.metadata.profile_depth === "fact_profiled" || result.metadata.profile_depth === "sample_profiled")
    .sort((left, right) => right.rank_score - left.rank_score)
    .slice(0, 80);

  const metricGrains = ([...(payload.grains ?? []), ...(payload.curated_grains ?? [])] as Array<Record<string, unknown>>).map((row) => ({
    measure_key: String(row.measure_key ?? ""),
    geography_type: String(row.geography_type ?? ""),
    period_type: row.period_type == null ? null : String(row.period_type),
    min_year: row.min_year == null ? null : Number(row.min_year),
    max_year: row.max_year == null ? null : Number(row.max_year),
    fact_row_count: row.fact_row_count == null ? null : Number(row.fact_row_count),
    is_supported: row.is_supported == null ? null : Boolean(row.is_supported),
    profile_depth: row.profile_depth == null ? null : String(row.profile_depth),
  }));

  const metricPreferences = ((payload.metric_preferences ?? []) as Array<Record<string, unknown>>).map((row) => ({
    normalized_metric_label: String(row.normalized_metric_label ?? ""),
    geography_type: row.geography_type == null ? null : String(row.geography_type),
    calculation_code: row.calculation_code == null ? null : String(row.calculation_code),
    preferred_measure_key: String(row.preferred_measure_key ?? ""),
    preferred_dataset_code: row.preferred_dataset_code == null ? null : String(row.preferred_dataset_code),
    priority: row.priority == null ? null : Number(row.priority),
    reason: row.reason == null ? null : String(row.reason),
  }));

  return { contracts, metricContracts: explicitContracts, concepts, conceptMetricBindings, dimensionContracts, categoryValueContracts, results, metricGrains, metricPreferences };
}
