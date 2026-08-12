import { getSupabaseClient, isSupabaseConfigured } from "@/data/supabase/client";

export interface GoldDomainGuide {
  domainId: string;
  title: string;
  description: string;
  datasetCount: number;
  metricCount: number;
  factRows: number;
  minYear: number | null;
  maxYear: number | null;
  geographyTypes: string[];
  grains: string[];
  lastProfiledAt: string | null;
  exampleQuestions: string[];
}

export interface GoldMetricGuide {
  domainId: string;
  metricCode: string;
  label: string;
  description: string | null;
  datasetCodes: string[];
  unitCode: string | null;
  validGrains: string[];
  defaultGrain: string | null;
  minYear: number | null;
  maxYear: number | null;
  supports: Record<string, boolean>;
}

export interface GoldQuestionStarter {
  kind: "ranking" | "comparison" | "trend" | "relationship" | "availability";
  label: string;
  question: string;
  domainIds: string[];
  metricCodes: string[];
  grain: string | null;
  year: number | null;
}

export interface GoldCombinationGuide {
  title: string;
  description: string;
  question: string;
  domainIds: string[];
  metricCodes: string[];
  datasets: string[];
  sharedGrain: string;
  year: number | null;
  relationshipType: "comparison" | "association";
}

export interface GoldResearchRecipe {
  title: string;
  description: string;
  steps: string[];
  starterQuestion: string;
  domainIds: string[];
}

export interface GoldCapabilityGuide {
  domains: GoldDomainGuide[];
  metrics: GoldMetricGuide[];
  questionStarters: GoldQuestionStarter[];
  combinations: GoldCombinationGuide[];
  recipes: GoldResearchRecipe[];
  answerTypes: Array<{ kind: string; label: string; description: string; example: string }>;
  isLive: boolean;
  error: string | null;
}

interface DatasetCapabilityRow {
  domain_id: string | null;
  dataset_code: string;
  dataset_title: string | null;
  loaded_fact_rows: number | string | null;
  measure_count: number | string | null;
  min_year: number | null;
  max_year: number | null;
  geography_types: string[] | null;
  grains: string[] | null;
  source_last_updated_at: string | null;
  gold_loaded_at: string | null;
  last_profiled_at: string | null;
}

interface MetricContractRow {
  domain_id: string | null;
  metric_code: string;
  label: string;
  description: string | null;
  dataset_codes: string[] | null;
  unit_code: string | null;
  valid_grains: string[] | null;
  default_grain: string | null;
  supports: Record<string, boolean> | null;
  execution_status: string | null;
  contract_status: string | null;
  is_active: boolean | null;
}

interface MeasureCapabilityRow {
  domain_id: string | null;
  metric_code?: string | null;
  measure_key: number | string | null;
  measure_name: string | null;
  dataset_code: string | null;
  min_year: number | null;
  max_year: number | null;
  geography_types: string[] | null;
  grains: string[] | null;
}

const DOMAIN_LABELS: Record<string, { title: string; description: string }> = {
  "bouwen-en-wonen": {
    title: "Bouwen en wonen",
    description: "Housing stock, WOZ values, rental homes, construction, demolitions, housing costs and housing satisfaction.",
  },
  "inkomen-en-bestedingen": {
    title: "Inkomen en bestedingen",
    description: "Income, wealth, spending, poverty signals, payment arrears and consumer confidence.",
  },
};

function numberValue(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function latestDate(values: Array<string | null | undefined>): string | null {
  const times = values
    .map((value) => value ? Date.parse(value) : NaN)
    .filter((value) => Number.isFinite(value));
  if (!times.length) return null;
  return new Date(Math.max(...times)).toISOString();
}

function domainTitle(domainId: string): string {
  return DOMAIN_LABELS[domainId]?.title ?? domainId;
}

function domainDescription(domainId: string): string {
  return DOMAIN_LABELS[domainId]?.description ?? "Trusted Gold data available for investigation.";
}

function grainLabel(grain: string): string {
  return grain.replace("_", "-");
}

function geographyInGrain(grain: string | null | undefined): string {
  if (!grain) return "geographies";
  if (grain.startsWith("municipality")) return "gemeenten";
  if (grain.startsWith("province")) return "provincies";
  if (grain.startsWith("national") || grain.startsWith("country")) return "Nederland";
  if (grain.startsWith("region")) return "regio's";
  return "gebieden";
}

function metricYear(metric: GoldMetricGuide): number | null {
  return metric.maxYear ?? null;
}

function toMetricGuides(contracts: MetricContractRow[], capabilities: MeasureCapabilityRow[]): GoldMetricGuide[] {
  const capabilityByDataset = new Map<string, MeasureCapabilityRow[]>();
  for (const capability of capabilities) {
    if (!capability.dataset_code) continue;
    capabilityByDataset.set(capability.dataset_code, [...(capabilityByDataset.get(capability.dataset_code) ?? []), capability]);
  }

  return contracts
    .filter((row) => row.is_active !== false && row.execution_status === "enabled" && ["reviewed", "curated"].includes(String(row.contract_status ?? "")))
    .map((row) => {
      const relatedCapabilities = (row.dataset_codes ?? []).flatMap((dataset) => capabilityByDataset.get(dataset) ?? []);
      const minYears = relatedCapabilities.map((item) => item.min_year).filter((year): year is number => typeof year === "number");
      const maxYears = relatedCapabilities.map((item) => item.max_year).filter((year): year is number => typeof year === "number");
      return {
        domainId: row.domain_id ?? "unknown",
        metricCode: row.metric_code,
        label: row.label,
        description: row.description,
        datasetCodes: row.dataset_codes ?? [],
        unitCode: row.unit_code,
        validGrains: row.valid_grains ?? [],
        defaultGrain: row.default_grain,
        minYear: minYears.length ? Math.min(...minYears) : null,
        maxYear: maxYears.length ? Math.max(...maxYears) : null,
        supports: row.supports ?? {},
      };
    });
}

function buildDomains(rows: DatasetCapabilityRow[], metrics: GoldMetricGuide[]): GoldDomainGuide[] {
  const domainIds = unique([...rows.map((row) => row.domain_id ?? "unknown"), ...metrics.map((metric) => metric.domainId)]);
  return domainIds.map((domainId) => {
    const domainRows = rows.filter((row) => (row.domain_id ?? "unknown") === domainId);
    const domainMetrics = metrics.filter((metric) => metric.domainId === domainId);
    const minYears = domainRows.map((row) => row.min_year).filter((year): year is number => typeof year === "number");
    const maxYears = domainRows.map((row) => row.max_year).filter((year): year is number => typeof year === "number");
    const geographyTypes = unique(domainRows.flatMap((row) => row.geography_types ?? []));
    const grains = unique([...domainRows.flatMap((row) => row.grains ?? []), ...domainMetrics.flatMap((metric) => metric.validGrains)]);
    const exampleQuestions = domainMetrics.slice(0, 3).map((metric) => {
      const grain = metric.defaultGrain ?? metric.validGrains[0] ?? null;
      const year = metricYear(metric);
      return `Welke ${geographyInGrain(grain)} hebben de hoogste ${metric.label}${year ? ` in ${year}` : ""}?`;
    });
    return {
      domainId,
      title: domainTitle(domainId),
      description: domainDescription(domainId),
      datasetCount: unique(domainRows.map((row) => row.dataset_code)).length,
      metricCount: domainMetrics.length,
      factRows: domainRows.reduce((sum, row) => sum + numberValue(row.loaded_fact_rows), 0),
      minYear: minYears.length ? Math.min(...minYears) : null,
      maxYear: maxYears.length ? Math.max(...maxYears) : null,
      geographyTypes,
      grains,
      lastProfiledAt: latestDate(domainRows.flatMap((row) => [row.last_profiled_at, row.gold_loaded_at, row.source_last_updated_at])),
      exampleQuestions,
    };
  }).sort((left, right) => left.title.localeCompare(right.title));
}

function buildQuestionStarters(metrics: GoldMetricGuide[]): GoldQuestionStarter[] {
  const starters: GoldQuestionStarter[] = [];
  for (const metric of metrics.slice(0, 24)) {
    const grain = metric.defaultGrain ?? metric.validGrains[0] ?? null;
    const year = metricYear(metric);
    if (metric.supports.ranking !== false && grain) {
      starters.push({
        kind: "ranking",
        label: "Ranking",
        question: `Welke ${geographyInGrain(grain)} hebben de hoogste ${metric.label}${year ? ` in ${year}` : ""}?`,
        domainIds: [metric.domainId],
        metricCodes: [metric.metricCode],
        grain,
        year,
      });
    }
    if (metric.supports.comparison !== false && grain?.startsWith("municipality")) {
      starters.push({
        kind: "comparison",
        label: "Comparison",
        question: `Vergelijk ${metric.label} in Rotterdam en Utrecht${year ? ` in ${year}` : ""}.`,
        domainIds: [metric.domainId],
        metricCodes: [metric.metricCode],
        grain,
        year,
      });
    }
    if (metric.supports.trend !== false && metric.minYear && year && grain?.startsWith("municipality") && year > metric.minYear) {
      starters.push({
        kind: "trend",
        label: "Trend",
        question: `Hoe ontwikkelde ${metric.label} zich in Rotterdam sinds ${Math.max(metric.minYear, year - 3)}?`,
        domainIds: [metric.domainId],
        metricCodes: [metric.metricCode],
        grain,
        year,
      });
    }
  }
  return starters.slice(0, 12);
}

function sharedGrain(left: GoldMetricGuide, right: GoldMetricGuide): string | null {
  const rightGrains = new Set(right.validGrains);
  const preferred = ["municipality_year", "province_year", "national_year", "country_year", "region_year"];
  return preferred.find((grain) => left.validGrains.includes(grain) && rightGrains.has(grain)) ?? null;
}

function buildCombinations(metrics: GoldMetricGuide[]): GoldCombinationGuide[] {
  const housing = metrics.filter((metric) => metric.domainId === "bouwen-en-wonen");
  const income = metrics.filter((metric) => metric.domainId === "inkomen-en-bestedingen");
  const combinations: GoldCombinationGuide[] = [];
  for (const left of housing) {
    for (const right of income) {
      const grain = sharedGrain(left, right);
      if (!grain) continue;
      const year = left.maxYear && right.maxYear ? Math.min(left.maxYear, right.maxYear) : left.maxYear ?? right.maxYear ?? null;
      const geography = geographyInGrain(grain);
      combinations.push({
        title: `${left.label} + ${right.label}`,
        description: `Compare trusted Gold metrics at ${grainLabel(grain)} grain. Guara treats this as an association check, not causality.`,
        question: `Waar valt hoge ${left.label} samen met hoge ${right.label}${geography !== "Nederland" ? ` per ${geography}` : ""}${year ? ` in ${year}` : ""}?`,
        domainIds: [left.domainId, right.domainId],
        metricCodes: [left.metricCode, right.metricCode],
        datasets: unique([...left.datasetCodes, ...right.datasetCodes]),
        sharedGrain: grain,
        year,
        relationshipType: "association",
      });
    }
  }
  return combinations.slice(0, 8);
}

function buildRecipes(combinations: GoldCombinationGuide[]): GoldResearchRecipe[] {
  return [
    {
      title: "Housing pressure and financial vulnerability",
      description: "Start with housing value or supply, then add payment stress indicators.",
      steps: ["Rank housing pressure", "Add income or arrears", "Compare municipalities", "Check relationship strength", "Save findings as evidence"],
      starterQuestion: combinations[0]?.question ?? "Vergelijk gemiddelde WOZ-waarde met betalingsachterstanden zorgpremie per gemeente in 2024.",
      domainIds: ["bouwen-en-wonen", "inkomen-en-bestedingen"],
    },
    {
      title: "Supply growth and confidence",
      description: "Compare housing stock changes with consumer confidence at province level.",
      steps: ["Select new construction", "Switch to province level", "Combine consumer confidence", "Inspect association", "Open workspace"],
      starterQuestion: combinations.find((item) => item.sharedGrain === "province_year")?.question ?? "Vergelijk nieuwbouw met consumentenvertrouwen per provincie in 2024.",
      domainIds: ["bouwen-en-wonen", "inkomen-en-bestedingen"],
    },
  ];
}

const ANSWER_TYPES = [
  { kind: "ranking", label: "Ranking", description: "Highest or lowest places for one metric.", example: "Welke gemeenten hebben de hoogste WOZ-waarde in 2024?" },
  { kind: "comparison", label: "Comparison", description: "Place versus place or metric versus metric.", example: "Vergelijk huurwoningen in Rotterdam en Utrecht in 2024." },
  { kind: "trend", label: "Trend", description: "Change over time for a place or indicator.", example: "Hoe ontwikkelde nieuwbouw zich in Rotterdam sinds 2021?" },
  { kind: "relationship", label: "Relationship", description: "Two metrics on the same grain, described as association.", example: "Waar valt nieuwbouw samen met betalingsachterstanden zorgpremie?" },
  { kind: "availability", label: "Availability", description: "What years, levels and datasets are trusted now.", example: "Welke woningdata is beschikbaar op gemeenteniveau?" },
];

export const goldCapabilityGuideService = {
  async getGuide(): Promise<GoldCapabilityGuide> {
    if (!isSupabaseConfigured()) {
      return { domains: [], metrics: [], questionStarters: [], combinations: [], recipes: [], answerTypes: ANSWER_TYPES, isLive: false, error: "Supabase is not configured." };
    }

    try {
      const supabase = await getSupabaseClient();
      const [datasets, contracts, measures] = await Promise.all([
        (supabase as any).schema("semantic").from("gold_dataset_capability").select("domain_id,dataset_code,dataset_title,loaded_fact_rows,measure_count,min_year,max_year,geography_types,grains,source_last_updated_at,gold_loaded_at,last_profiled_at").limit(1000),
        (supabase as any).schema("semantic").from("metric_contract").select("domain_id,metric_code,label,description,dataset_codes,unit_code,valid_grains,default_grain,supports,execution_status,contract_status,is_active").eq("is_active", true).eq("execution_status", "enabled").in("contract_status", ["reviewed", "curated"]).limit(1000),
        (supabase as any).schema("semantic").from("gold_measure_capability").select("domain_id,measure_key,measure_name,dataset_code,min_year,max_year,geography_types,grains").eq("executable_candidate", true).limit(5000),
      ]);

      const error = datasets.error ?? contracts.error ?? measures.error;
      if (error) throw error;

      const metricGuides = toMetricGuides((contracts.data ?? []) as MetricContractRow[], (measures.data ?? []) as MeasureCapabilityRow[]);
      const datasetRows = (datasets.data ?? []) as DatasetCapabilityRow[];
      const combinations = buildCombinations(metricGuides);
      return {
        domains: buildDomains(datasetRows, metricGuides),
        metrics: metricGuides,
        questionStarters: [
          ...combinations.slice(0, 4).map((combination) => ({
            kind: "relationship" as const,
            label: "Relationship",
            question: combination.question,
            domainIds: combination.domainIds,
            metricCodes: combination.metricCodes,
            grain: combination.sharedGrain,
            year: combination.year,
          })),
          ...buildQuestionStarters(metricGuides),
        ].slice(0, 14),
        combinations,
        recipes: buildRecipes(combinations),
        answerTypes: ANSWER_TYPES,
        isLive: true,
        error: null,
      };
    } catch (error) {
      return {
        domains: [],
        metrics: [],
        questionStarters: [],
        combinations: [],
        recipes: [],
        answerTypes: ANSWER_TYPES,
        isLive: false,
        error: error instanceof Error ? error.message : "Could not read Gold capability metadata.",
      };
    }
  },
};
