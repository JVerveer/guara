import type { SemanticIntent, SemanticQueryPlan, SemanticSearchResult } from "../types";
import type { SemanticMetricGrain, SemanticPlannerCuration } from "./queryPlanner";
import { extractNamedGeographies } from "./queryPlanner";
import { resolveGeographiesFromQuestion } from "./geographyResolver";
import { normalizeSemanticText } from "./semanticUtils";

interface RegistryTemplate {
  template_code: string;
  concept_code: string;
  concept_label: string;
  metric_code: string;
  dataset_code: string;
  calculation_code: string;
  default_geography_type: string;
  required_terms: RegExp[];
  excluded_terms?: RegExp[];
  categoryFilterResolver?: (question: string) => Record<string, string> | null;
  category_filters?: Record<string, string>;
  measure_title?: string;
  sort_direction?: "asc" | "desc";
}

const CONSTRUCTION_YEAR_BANDS = [
  { min: 1000, maxExclusive: 1850, label: "1000 tot 1850" },
  { min: 1850, maxExclusive: 1905, label: "1850 tot 1905" },
  { min: 1905, maxExclusive: 1925, label: "1905 tot 1925" },
  { min: 1925, maxExclusive: 1945, label: "1925 tot 1945" },
  { min: 1945, maxExclusive: 1955, label: "1945 tot 1955" },
  { min: 1955, maxExclusive: 1965, label: "1955 tot 1965" },
  { min: 1965, maxExclusive: 1975, label: "1965 tot 1975" },
  { min: 1975, maxExclusive: 1985, label: "1975 tot 1985" },
  { min: 1985, maxExclusive: 1995, label: "1985 tot 1995" },
  { min: 1995, maxExclusive: 2005, label: "1995 tot 2005" },
  { min: 2005, maxExclusive: 2015, label: "2005 tot 2015" },
  { min: 2015, maxExclusive: 2025, label: "2015 tot 2025" },
];

function constructionYear(question: string): number | null {
  const match = question.match(/\b(?:bouwjaar|gebouwd(?:e)?(?:\s+in)?|bouwperiode)\s*(19[0-9]\d|20[0-2]\d)\b/i)
    ?? question.match(/\b(19[0-9]\d|20[0-2]\d)\b(?=.*\b(?:bouwjaar|gebouwd(?:e)?|bouwperiode)\b)/i);
  if (!match?.[1]) return null;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

function constructionYearTarget(question: string): number | null {
  const range = question.match(/\b(?:bouwjaar|gebouwd(?:e)?|bouwperiode)[^0-9]{0,24}(19[0-9]\d|20[0-2]\d)\s*(?:en|tot|t\/m|-)\s*(19[0-9]\d|20[0-2]\d)\b/i)
    ?? question.match(/\b(19[0-9]\d|20[0-2]\d)\s*(?:en|tot|t\/m|-)\s*(19[0-9]\d|20[0-2]\d)\b(?=.*\b(?:bouwjaar|gebouwd(?:e)?|bouwperiode)\b)/i);
  if (range?.[1] && range[2]) {
    return Math.round((Number(range[1]) + Number(range[2])) / 2);
  }
  return constructionYear(question);
}

function constructionYearBand(question: string): string | null {
  const year = constructionYearTarget(question);
  if (year == null) return null;
  if (year >= 2025) return "Vanaf 2025";
  return CONSTRUCTION_YEAR_BANDS.find((band) => year >= band.min && year < band.maxExclusive)?.label ?? null;
}

function housingByConstructionYearFilters(question: string): Record<string, string> | null {
  const band = constructionYearBand(question);
  if (!band) return null;
  return {
    Bouwjaarklasse: band,
    Woningtype: "Totaal",
  };
}

function singleFamilyFilters(question: string): Record<string, string> | null {
  if (!/\b(een|eens)gezinswoningen?\b/i.test(question)) return null;
  return {
    Bouwjaarklasse: "Totaal",
    Woningtype: "Eengezinswoning",
  };
}

function totalHousingStockFilters(): Record<string, string> {
  return {
    Bouwjaarklasse: "Totaal",
    Woningtype: "Totaal",
  };
}

function noCategoryFilters(): Record<string, string> {
  return {};
}

const REGISTRY_TEMPLATES: RegistryTemplate[] = [
  {
    template_code: "rank_total_housing_stock",
    concept_code: "housing_stock",
    concept_label: "Housing stock",
    metric_code: "housing_stock_start",
    dataset_code: "82550NED",
    calculation_code: "ranking",
    default_geography_type: "municipality",
    required_terms: [/\b(woningvoorraad|aantal woningen|meeste woningen|minste woningen|waar staan de meeste woningen|waar staan de minste woningen)\b/i],
    excluded_terms: [/\b(bouwjaar|gebouwd(?:e)?|bouwperiode|eengezins|eensgezins|huurwoningen|koopwoningen|woz|verkoopprijs|nieuwbouw)\b/i],
    category_filters: totalHousingStockFilters(),
  },
  {
    template_code: "rank_housing_stock_by_construction_year",
    concept_code: "housing_by_construction_year",
    concept_label: "Homes by construction year",
    metric_code: "housing_stock_start",
    dataset_code: "82550NED",
    calculation_code: "ranking",
    default_geography_type: "municipality",
    required_terms: [/\b(woning|woningen|huis|huizen)\b/i, /\b(bouwjaar|gebouwd(?:e)?|bouwperiode)\b/i],
    categoryFilterResolver: housingByConstructionYearFilters,
  },
  {
    template_code: "rank_single_family_homes",
    concept_code: "single_family_homes",
    concept_label: "Single-family homes",
    metric_code: "housing_stock_start",
    dataset_code: "82550NED",
    calculation_code: "ranking",
    default_geography_type: "municipality",
    required_terms: [/\b(een|eens)gezinswoningen?\b/i],
    categoryFilterResolver: singleFamilyFilters,
  },
  {
    template_code: "rank_average_housing_surface",
    concept_code: "average_housing_surface",
    concept_label: "Average housing surface",
    metric_code: "gemiddelde_oppervlakte__82550ned__975754978450923330",
    dataset_code: "82550NED",
    calculation_code: "ranking",
    default_geography_type: "municipality",
    required_terms: [/\b(gemiddelde oppervlakte|oppervlakte van woningen|grootste woningen|kleinste woningen|woonoppervlakte)\b/i],
    excluded_terms: [/\b(nieuwbouw|bedrijfsgebouwen|bouwkosten)\b/i],
    category_filters: totalHousingStockFilters(),
  },
  {
    template_code: "rank_total_rental_homes",
    concept_code: "total_rental_homes",
    concept_label: "Total rental homes",
    metric_code: "total_rental_homes",
    dataset_code: "82900NED",
    calculation_code: "ranking",
    default_geography_type: "municipality",
    required_terms: [/\b(huurwoningen|huur woningen|rental homes|rental dwellings)\b/i],
    excluded_terms: [/\b(huurverhoging|huurprijs|woz|verkoopprijs)\b/i],
    category_filters: noCategoryFilters(),
  },
  {
    template_code: "rank_owner_occupied_homes",
    concept_code: "owner_occupied_homes",
    concept_label: "Owner-occupied homes",
    metric_code: "koopwoningen__82900ned__661410027797099967",
    dataset_code: "82900NED",
    calculation_code: "ranking",
    default_geography_type: "municipality",
    required_terms: [/\b(koopwoningen|koop woningen|owner occupied|eigen woningen)\b/i],
    excluded_terms: [/\b(verkoopprijs|woz|huurwoningen|duurste|goedkoopste|hoogste prijs|laagste prijs)\b/i],
    category_filters: noCategoryFilters(),
  },
  {
    template_code: "rank_housing_corporation_homes",
    concept_code: "housing_corporation_homes",
    concept_label: "Housing corporation rental homes",
    metric_code: "eigendom_woningcorporatie__82900ned__488908866657199531",
    dataset_code: "82900NED",
    calculation_code: "ranking",
    default_geography_type: "municipality",
    required_terms: [/\b(woningcorporatie|corporatiewoningen|corporatie woningen|housing corporation)\b/i],
    excluded_terms: [/\b(huurverhoging|verkoopprijs|woz)\b/i],
    category_filters: noCategoryFilters(),
  },
  {
    template_code: "rank_other_landlord_homes",
    concept_code: "other_landlord_homes",
    concept_label: "Other landlord rental homes",
    metric_code: "eigendom_overige_verhuurders__82900ned__301993602659842571",
    dataset_code: "82900NED",
    calculation_code: "ranking",
    default_geography_type: "municipality",
    required_terms: [/\b(overige verhuurders|particuliere verhuurders|private landlords|andere verhuurders)\b/i],
    excluded_terms: [/\b(huurverhoging|woningcorporatie)\b/i],
    category_filters: noCategoryFilters(),
  },
  {
    template_code: "rank_rent_increase",
    concept_code: "rent_increase",
    concept_label: "Rent increase",
    metric_code: "rent_increase_including_harmonisation",
    dataset_code: "83162NED",
    calculation_code: "ranking",
    default_geography_type: "municipality",
    required_terms: [/\b(huurverhoging|rent increase)\b/i],
    excluded_terms: [/\b(huurwoningen|aantal huur)\b/i],
    category_filters: noCategoryFilters(),
  },
  {
    template_code: "rank_average_sale_price",
    concept_code: "average_sale_price",
    concept_label: "Average sale price",
    metric_code: "average_sale_price",
    dataset_code: "83625NED",
    calculation_code: "ranking",
    default_geography_type: "municipality",
    required_terms: [/\b(gemiddelde verkoopprijs|koopprijs|huizenprijs|woningprijs|verkoopprijzen|duurste koopwoningen|koopwoningen het duurst|goedkoopste koopwoningen)\b/i],
    excluded_terms: [/\b(woz|huur|woningvoorraad)\b/i],
    category_filters: noCategoryFilters(),
  },
  {
    template_code: "rank_average_woz_home_value",
    concept_code: "average_woz_home_value",
    concept_label: "Average WOZ home value",
    metric_code: "average_woz_home_value",
    dataset_code: "85036NED",
    calculation_code: "ranking",
    default_geography_type: "municipality",
    required_terms: [/\b(woz|woz waarde|woningwaarde|waarde van woningen)\b/i],
    excluded_terms: [/\b(verkoopprijs|huur|woningvoorraad)\b/i],
    category_filters: noCategoryFilters(),
  },
  {
    template_code: "rank_home_satisfaction",
    concept_code: "home_satisfaction",
    concept_label: "Satisfaction with current home",
    metric_code: "current_home_satisfaction",
    dataset_code: "84571NED",
    calculation_code: "ranking",
    default_geography_type: "municipality",
    required_terms: [/\b(tevreden(?:heid)? over (?:hun |de |huidige )?woning|woontevredenheid|tevreden met (?:hun |de |huidige )?woning|satisfied with (?:their )?home)\b/i],
    excluded_terms: [/\b(woonomgeving|buurt|neighbourhood)\b/i],
    category_filters: {
      EigenaarOfHuurder: "Totaal",
      Marges: "Waarde",
      Woningkenmerken: "Totaal woningen",
    },
  },
  {
    template_code: "rank_neighbourhood_satisfaction",
    concept_code: "neighbourhood_satisfaction",
    concept_label: "Satisfaction with current residential environment",
    metric_code: "tevredenheid_met_de_huidige_woonomgeving__84571ned__275337079936561942",
    dataset_code: "84571NED",
    calculation_code: "ranking",
    default_geography_type: "municipality",
    required_terms: [/\b(tevreden(?:heid)? over (?:de )?(?:woonomgeving|buurt)|woonomgeving|neighbourhood satisfaction)\b/i],
    category_filters: {
      EigenaarOfHuurder: "Totaal",
      Marges: "Waarde",
      Woningkenmerken: "Totaal woningen",
    },
  },
  {
    template_code: "rank_new_construction_dwellings",
    concept_code: "new_construction_dwellings",
    concept_label: "Newly built dwellings",
    metric_code: "new_construction",
    dataset_code: "86054NED",
    calculation_code: "ranking",
    default_geography_type: "municipality",
    required_terms: [/\b(nieuwbouw|nieuwbouwwoningen|nieuwe woningen|gebouwde woningen|opgeleverde nieuwbouw|new construction)\b/i],
    excluded_terms: [/\b(bouwkosten|bedrijfsgebouwen|vergunningen|index|marktsector|budgetsector)\b/i],
    category_filters: noCategoryFilters(),
  },
  {
    template_code: "rank_demolitions",
    concept_code: "demolitions",
    concept_label: "Demolished dwellings",
    metric_code: "demolished_dwellings",
    dataset_code: "86054NED",
    calculation_code: "ranking",
    default_geography_type: "municipality",
    required_terms: [/\b(sloop|gesloopte woningen|demolition|demolished)\b/i],
    excluded_terms: [/\b(nieuwbouw|vergunning)\b/i],
    category_filters: noCategoryFilters(),
  },
  {
    template_code: "rank_housing_transformations",
    concept_code: "housing_transformations",
    concept_label: "Housing transformations",
    metric_code: "housing_transformations",
    dataset_code: "86054NED",
    calculation_code: "ranking",
    default_geography_type: "municipality",
    required_terms: [/\b(transformatie|woningtransformatie|woningtransformaties|getransformeerde woningen|transformed homes)\b/i],
    category_filters: noCategoryFilters(),
  },
  {
    template_code: "rank_housing_splits",
    concept_code: "housing_splits",
    concept_label: "Housing splits",
    metric_code: "woningsplitsing__86054ned__854785163745557223",
    dataset_code: "86054NED",
    calculation_code: "ranking",
    default_geography_type: "municipality",
    required_terms: [/\b(woningsplitsing|woningsplitsingen|gesplitste woningen|housing splits)\b/i],
    category_filters: noCategoryFilters(),
  },
  {
    template_code: "rank_housing_mergers",
    concept_code: "housing_mergers",
    concept_label: "Housing mergers",
    metric_code: "woningsamenvoeging__86054ned__290759938523607994",
    dataset_code: "86054NED",
    calculation_code: "ranking",
    default_geography_type: "municipality",
    required_terms: [/\b(woningsamenvoeging|woningsamenvoegingen|samengevoegde woningen|housing mergers)\b/i],
    category_filters: noCategoryFilters(),
  },
  {
    template_code: "rank_temporary_housing_permits_municipality",
    concept_code: "temporary_housing_permits",
    concept_label: "Permitted temporary homes",
    metric_code: "permitted_temporary_homes",
    dataset_code: "86318NED",
    calculation_code: "ranking",
    default_geography_type: "municipality",
    required_terms: [/\b(vergunde tijdelijke woningen|tijdelijke woningen|temporary housing permits|tijdelijke woningvergunningen)\b/i],
    category_filters: noCategoryFilters(),
  },
  {
    template_code: "rank_building_permits_business_region",
    concept_code: "building_permits_business",
    concept_label: "Business building permits",
    metric_code: "bouwvergunningen_totaal__83672ned__898576082649222326",
    dataset_code: "83672NED",
    calculation_code: "ranking",
    default_geography_type: "region",
    required_terms: [/\b(bouwvergunningen|building permits)\b/i, /\b(bedrijfsgebouwen|business buildings|gebouwen)\b/i],
    excluded_terms: [/\b(tijdelijke woningen|woningen)\b/i],
    category_filters: noCategoryFilters(),
  },
  {
    template_code: "rank_average_building_cost_per_home_region",
    concept_code: "average_building_cost_per_home",
    concept_label: "Average building cost per home",
    metric_code: "gemiddelde_bouwkosten_per_woning__83673ned__568964185536953447",
    dataset_code: "83673NED",
    calculation_code: "ranking",
    default_geography_type: "region",
    required_terms: [/\b(gemiddelde bouwkosten per woning|bouwkosten per woning|construction cost per home)\b/i],
    category_filters: noCategoryFilters(),
  },
];

function templateMatches(question: string, template: RegistryTemplate): boolean {
  if (!template.required_terms.every((term) => term.test(question))) return false;
  if (template.excluded_terms?.some((term) => term.test(question))) return false;
  return resolvedCategoryFilters(question, template) != null;
}

function metricByCode(results: SemanticSearchResult[], template: RegistryTemplate): SemanticSearchResult | undefined {
  return results
    .filter((result) => ["measure", "metric"].includes(result.object_type))
    .filter((result) => result.metadata?.measure_key != null)
    .find((result) => result.dataset_code === template.dataset_code && result.metadata?.metric_code === template.metric_code)
    ?? (template.measure_title ? results
      .filter((result) => ["measure", "metric"].includes(result.object_type))
      .filter((result) => result.metadata?.measure_key != null)
      .find((result) => result.dataset_code === template.dataset_code && normalizeSemanticText(result.title) === normalizeSemanticText(template.measure_title ?? ""))
      : undefined);
}

function resolvedCategoryFilters(question: string, template: RegistryTemplate): Record<string, string> | null {
  if (template.categoryFilterResolver) return template.categoryFilterResolver(question);
  return template.category_filters ?? {};
}

function latestYearForMeasure(measureKey: string, geographyType: string, metric: SemanticSearchResult, grains: SemanticMetricGrain[] = []): number | undefined {
  const grainYears = grains
    .filter((grain) => String(grain.measure_key) === measureKey && grain.geography_type === geographyType && grain.is_supported !== false)
    .map((grain) => grain.max_year)
    .filter((year): year is number => typeof year === "number" && Number.isFinite(year));
  if (grainYears.length) return Math.max(...grainYears);
  const value = metric.metadata?.max_year;
  const maxYear = typeof value === "number" ? value : Number(value);
  return Number.isFinite(maxYear) ? maxYear : undefined;
}

function requestedObservationYear(question: string, template: RegistryTemplate): number | undefined {
  if (template.template_code.includes("construction_year")) return undefined;
  const match = question.match(/\b(19[0-9]\d|20[0-2]\d)\b/);
  if (!match?.[1]) return undefined;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : undefined;
}

function rankSortDirection(question: string, template: RegistryTemplate): "asc" | "desc" {
  if (template.sort_direction) return template.sort_direction;
  if (/\b(minste|laagste|kleinste|lowest|least|smallest)\b/i.test(question)) return "asc";
  return "desc";
}

function periodTypeFromDisplayGrain(displayGrainValue: string | undefined): string {
  const parts = String(displayGrainValue ?? "").split("_");
  return parts.length > 1 ? parts.slice(1).join("_") : "year";
}

function displayGrain(geographyType: string, metric?: SemanticSearchResult): string {
  const validGrains = Array.isArray(metric?.metadata?.valid_grains) ? metric.metadata.valid_grains.map(String) : [];
  const defaultGrain = typeof metric?.metadata?.default_grain === "string" ? metric.metadata.default_grain : undefined;
  return [defaultGrain, ...validGrains]
    .filter((grain): grain is string => Boolean(grain))
    .find((grain) => grain.startsWith(`${geographyType}_`))
    ?? `${geographyType}_year`;
}

export function buildRegistryQueryPlan(
  question: string,
  intent: SemanticIntent,
  results: SemanticSearchResult[],
  curation: SemanticPlannerCuration
): SemanticQueryPlan | undefined {
  for (const template of REGISTRY_TEMPLATES.filter((item) => templateMatches(question, item))) {
    const metric = metricByCode(results, template);
    const measureKey = metric?.metadata?.measure_key == null ? undefined : String(metric.metadata.measure_key);
    if (!metric || !measureKey) continue;

    const categoryFilters = resolvedCategoryFilters(question, template);
    if (!categoryFilters) continue;

    const geographyType = template.default_geography_type;
    const geographyResolutions = resolveGeographiesFromQuestion(question, extractNamedGeographies(question));
    const countryScopeRanking = intent === "rank_geographies" && geographyResolutions.some((resolution) => resolution.geography_type === "country");
    const scopedGeographyResolutions = countryScopeRanking ? geographyResolutions.filter((resolution) => resolution.geography_type !== "country") : geographyResolutions;
    const geographyNames = scopedGeographyResolutions.map((resolution) => resolution.resolved_name);
    const resolvedGeographyType = scopedGeographyResolutions[0]?.geography_type ?? geographyType;
    const requestedYear = requestedObservationYear(question, template);
    const latestYear = latestYearForMeasure(measureKey, resolvedGeographyType, metric, curation.metricGrains);
    const year = requestedYear ?? latestYear;
    const warnings = !requestedYear && latestYear
      ? [`No calendar year was specified, so Guara used the latest available observation year in Gold: ${latestYear}.`]
      : [];
    const plannedIntent = geographyNames.length && intent !== "trend" ? "compare_geographies" : intent === "catalogue_search" ? "rank_geographies" : intent;
    const resolvedDisplayGrain = displayGrain(resolvedGeographyType, metric);
    const resolvedPeriodType = periodTypeFromDisplayGrain(resolvedDisplayGrain);

    return {
      intent: plannedIntent,
      source: "gold_bouwen_wonen",
      measure_key: measureKey,
      metric_code: template.metric_code,
      semantic_concept_code: template.concept_code,
      semantic_concept_label: template.concept_label,
      calculation_code: template.calculation_code,
      measure_label: metric.title,
      dataset_code: template.dataset_code,
      period_type: resolvedPeriodType,
      year,
      geography_names: geographyNames,
      geography_type: resolvedGeographyType,
      grain: {
        geography_type: resolvedGeographyType,
        period_type: resolvedPeriodType,
        display_grain: resolvedDisplayGrain,
      },
      expected_result_grain: ["measure_key", "dataset_code", "geography_code", "calendar_year"],
      category_filters: categoryFilters,
      sort_direction: rankSortDirection(question, template),
      limit: 10,
      semantic_confidence: 0.98,
      resolution_method: "semantic_registry",
      warnings,
      explanation: [
        `Matched registry template "${template.template_code}".`,
        `Resolved concept "${template.concept_label}".`,
        `Resolved metric "${metric.title}" from ${template.dataset_code}.`,
        `Resolved category filters ${Object.entries(categoryFilters).map(([key, value]) => `${key}=${value}`).join(", ")}.`,
      ],
    };
  }

  return undefined;
}
