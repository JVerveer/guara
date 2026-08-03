#!/usr/bin/env node
import { createPostgresClient, loadLocalEnv } from "./lib/runtime.mjs";

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function slug(value) {
  return normalize(value).replace(/\s+/g, "_").replace(/^_+|_+$/g, "") || "metric";
}

function grainCode(row) {
  const geography = String(row.geography_type ?? "unknown").trim() || "unknown";
  const period = String(row.period_type ?? "year").trim() || "year";
  if (geography === "country" || geography === "unknown") return "national_year";
  return `${geography}_${period}`;
}

function defaultGrain(grains) {
  for (const candidate of ["municipality_year", "province_year", "region_year", "national_year", "country_year"]) {
    if (grains.includes(candidate)) return candidate === "country_year" ? "national_year" : candidate;
  }
  return grains[0] ?? null;
}

function normalizedGrains(grains) {
  return Array.from(new Set((grains ?? []).map((grain) => grain === "country_year" ? "national_year" : grain)));
}

function supportsFor(grains, measure) {
  const hasGeography = grains.some((grain) => /^(municipality|province|region|national|country)_/.test(grain));
  const hasTime = Number.isFinite(Number(measure.min_year)) && Number.isFinite(Number(measure.max_year)) && Number(measure.max_year) > Number(measure.min_year);
  return {
    ranking: hasGeography,
    trend: hasTime,
    comparison: hasGeography,
    percentage_change: hasTime,
  };
}

const curatedContracts = [
  {
    metric_code: "average_personal_income",
    label: "Average personal income",
    domain_id: "inkomen-en-bestedingen",
    match: { dataset_code: "83931NED", measure_code: "GemiddeldInkomen_2" },
    description: "Average income of persons with income.",
    aggregation: "average",
    synonyms: {
      nl: ["gemiddeld inkomen", "gemiddeld persoonlijk inkomen", "inkomen personen", "persoonlijk inkomen", "gemiddelde inkomens"],
      en: ["average personal income", "average income", "personal income"],
    },
    exclusions: ["huishoudinkomen", "mediaan inkomen", "vermogen", "bestedingen"],
    selection_priority: 10,
  },
  {
    metric_code: "median_personal_income",
    label: "Median personal income",
    domain_id: "inkomen-en-bestedingen",
    match: { dataset_code: "83931NED", measure_code: "MediaanInkomen_3" },
    description: "Median income of persons with income.",
    aggregation: "median",
    synonyms: {
      nl: ["mediaan inkomen", "mediaan persoonlijk inkomen", "mediane inkomens personen"],
      en: ["median personal income", "median income"],
    },
    exclusions: ["gemiddeld inkomen", "huishoudinkomen", "vermogen"],
    selection_priority: 12,
  },
  {
    metric_code: "average_household_income",
    label: "Average household income",
    domain_id: "inkomen-en-bestedingen",
    match: { dataset_code: "83932NED", measure_code: "GemiddeldInkomen_4" },
    description: "Average income of private households.",
    aggregation: "average",
    synonyms: {
      nl: ["gemiddeld huishoudinkomen", "gemiddeld inkomen huishoudens", "huishoudinkomen", "inkomen huishoudens"],
      en: ["average household income", "household income"],
    },
    exclusions: ["persoonlijk inkomen", "mediaan inkomen", "vermogen"],
    selection_priority: 10,
  },
  {
    metric_code: "median_household_income",
    label: "Median household income",
    domain_id: "inkomen-en-bestedingen",
    match: { dataset_code: "83932NED", measure_code: "MediaanInkomen_5" },
    description: "Median income of private households.",
    aggregation: "median",
    synonyms: {
      nl: ["mediaan huishoudinkomen", "mediaan inkomen huishoudens", "mediane huishoudinkomens"],
      en: ["median household income"],
    },
    exclusions: ["gemiddeld inkomen", "persoonlijk inkomen", "vermogen"],
    selection_priority: 12,
  },
  {
    metric_code: "average_household_wealth",
    label: "Average household wealth",
    domain_id: "inkomen-en-bestedingen",
    match: { dataset_code: "83835NED", measure_code: "GemiddeldVermogen_3" },
    description: "Average household wealth.",
    aggregation: "average",
    synonyms: {
      nl: ["gemiddeld vermogen", "gemiddeld huishoudvermogen", "vermogen huishoudens"],
      en: ["average wealth", "average household wealth"],
    },
    exclusions: ["inkomen", "mediaan vermogen"],
    selection_priority: 10,
  },
  {
    metric_code: "median_household_wealth",
    label: "Median household wealth",
    domain_id: "inkomen-en-bestedingen",
    match: { dataset_code: "83835NED", measure_code: "MediaanVermogen_4" },
    description: "Median household wealth.",
    aggregation: "median",
    synonyms: {
      nl: ["mediaan vermogen", "mediaan huishoudvermogen", "mediane vermogens"],
      en: ["median wealth", "median household wealth"],
    },
    exclusions: ["inkomen", "gemiddeld vermogen"],
    selection_priority: 12,
  },
  {
    metric_code: "low_income_households_share",
    label: "Share of low-income households",
    domain_id: "inkomen-en-bestedingen",
    match: { dataset_code: "83841NED", measure_code: "HuishoudensRelatief_2" },
    description: "Percentage of households with a low income.",
    aggregation: "average",
    synonyms: {
      nl: ["laag inkomen huishoudens", "huishoudens met laag inkomen", "armoede huishoudens", "percentage lage inkomens"],
      en: ["low-income households", "share of low-income households", "household poverty"],
    },
    exclusions: ["personen met laag inkomen", "kinderen met laag inkomen", "aantal huishoudens"],
    selection_priority: 10,
  },
  {
    metric_code: "low_income_persons_share",
    label: "Share of low-income persons",
    domain_id: "inkomen-en-bestedingen",
    match: { dataset_code: "83843NED", measure_code: "PersonenRelatief_2" },
    description: "Percentage of persons with a low income.",
    aggregation: "average",
    synonyms: {
      nl: ["personen met laag inkomen", "mensen met laag inkomen", "armoede personen", "percentage personen laag inkomen"],
      en: ["low-income persons", "share of low-income persons", "people in poverty"],
    },
    exclusions: ["huishoudens met laag inkomen", "kinderen met laag inkomen"],
    selection_priority: 10,
  },
  {
    metric_code: "low_income_children_share",
    label: "Share of low-income children",
    domain_id: "inkomen-en-bestedingen",
    match: { dataset_code: "83842NED", measure_code: "KinderenRelatief_4" },
    description: "Percentage of children living in households with a low income.",
    aggregation: "average",
    synonyms: {
      nl: ["kinderen met laag inkomen", "kinderarmoede", "armoede kinderen", "percentage kinderen laag inkomen"],
      en: ["child poverty", "low-income children", "children in low-income households"],
    },
    exclusions: ["huishoudens met laag inkomen", "personen met laag inkomen"],
    selection_priority: 10,
  },
  {
    metric_code: "health_insurance_payment_arrears_share",
    label: "Share with health insurance premium payment arrears",
    domain_id: "inkomen-en-bestedingen",
    match: { dataset_code: "81064ned", measure_code: "PersMetBetalingsachterstandRelatief_2" },
    description: "Percentage of people with payment arrears on health insurance premiums.",
    aggregation: "average",
    synonyms: {
      nl: ["betalingsachterstand zorgpremie", "wanbetalers zorgpremie", "zorgpremie achterstand", "achterstand zorgverzekering"],
      en: ["health insurance payment arrears", "healthcare premium arrears"],
    },
    exclusions: ["aantal wanbetalers", "inkomen", "vermogen"],
    selection_priority: 10,
  },
  {
    metric_code: "health_insurance_payment_arrears_persons",
    label: "Persons with health insurance premium payment arrears",
    domain_id: "inkomen-en-bestedingen",
    match: { dataset_code: "81064ned", measure_code: "PersonenMetEenBetalingsachterstand_1" },
    description: "Number of people with payment arrears on health insurance premiums.",
    aggregation: "sum",
    synonyms: {
      nl: ["aantal wanbetalers zorgpremie", "personen betalingsachterstand zorgpremie", "mensen met zorgpremie achterstand"],
      en: ["people with health insurance payment arrears", "number with healthcare premium arrears"],
    },
    exclusions: ["percentage", "relatief", "inkomen"],
    selection_priority: 10,
  },
  {
    metric_code: "consumer_confidence",
    label: "Consumer confidence",
    domain_id: "inkomen-en-bestedingen",
    match: { dataset_code: "83978NED", measure_code: "Consumentenvertrouwen_1" },
    description: "Consumer confidence indicator by region.",
    aggregation: "average",
    default_grain: "province_year",
    synonyms: {
      nl: ["consumentenvertrouwen", "vertrouwen consumenten", "consumentenvertrouwen per provincie"],
      en: ["consumer confidence", "consumer sentiment"],
    },
    exclusions: ["koopbereidheid", "economisch klimaat"],
    selection_priority: 10,
  },
  {
    metric_code: "average_woz_home_value",
    label: "Average WOZ home value",
    domain_id: "bouwen-en-wonen",
    match: { dataset_code: "85036NED", measure_name: "Gemiddelde WOZ-waarde van woningen" },
    description: "Average assessed WOZ value of homes.",
    aggregation: "average",
    synonyms: {
      nl: ["woz", "woz waarde", "gemiddelde woningwaarde", "woningwaarde", "waarde van woningen"],
      en: ["woz value", "average home value", "house value", "property value"],
    },
    exclusions: ["sale price", "gemiddelde verkoopprijs", "woningvoorraad", "number of homes"],
    selection_priority: 10,
  },
  {
    metric_code: "rent_increase_including_harmonisation",
    label: "Rent increase including rent harmonisation",
    domain_id: "bouwen-en-wonen",
    match: { dataset_code: "83162NED", measure_name: "Huurverhoging inclusief huurharmonisatie" },
    description: "Average rent increase including rent harmonisation.",
    aggregation: "average",
    synonyms: {
      nl: ["huurverhoging", "meeste huurverhoging", "huurverhoging inclusief huurharmonisatie"],
      en: ["rent increase", "highest rent increase", "rent increase including harmonisation"],
    },
    exclusions: ["reële huurverhoging", "huurverhoging exclusief huurharmonisatie", "effect harmonisatie"],
    selection_priority: 10,
  },
  {
    metric_code: "current_home_satisfaction",
    label: "Satisfaction with current home",
    domain_id: "bouwen-en-wonen",
    match: { dataset_code: "84571NED", measure_name: "Tevredenheid met de huidige woning" },
    description: "Share of people satisfied with their current home.",
    aggregation: "average",
    synonyms: {
      nl: ["woontevredenheid", "tevreden over woning", "tevredenheid woning", "tevreden met huidige woning"],
      en: ["housing satisfaction", "satisfied with home", "satisfaction with current home"],
    },
    exclusions: ["woonomgeving", "neighbourhood satisfaction"],
    category_filters: {
      EigenaarOfHuurder: "Totaal",
      Marges: "Waarde",
      Woningkenmerken: "Totaal woningen",
    },
    selection_priority: 10,
  },
  {
    metric_code: "housing_stock_start",
    label: "Housing stock at start of period",
    domain_id: "bouwen-en-wonen",
    match: { dataset_code: "82550NED", measure_name: "Beginstand woningvoorraad" },
    description: "Number of homes in the housing stock at the start of the period.",
    aggregation: "sum",
    synonyms: {
      nl: ["woningen", "woningvoorraad", "aantal woningen", "hoeveel woningen"],
      en: ["housing stock", "number of homes", "dwellings"],
    },
    exclusions: ["woningwaarde", "woz", "huurwoningen", "woningtype", "sloop", "gesloopte", "vergunde", "tijdelijke woningen", "transformatie", "woningtransformatie", "nieuwbouw"],
    selection_priority: 20,
  },
  {
    metric_code: "corner_homes",
    label: "Corner homes",
    domain_id: "bouwen-en-wonen",
    match: { dataset_code: "85035NED", measure_code: "BeginstandWoningvoorraad_1" },
    description: "Number of homes in the housing stock filtered to corner homes.",
    aggregation: "sum",
    default_grain: "region_year",
    synonyms: {
      nl: ["hoekwoningen", "hoekwoning", "eengezins hoekwoning", "aantal hoekwoningen", "meeste hoekwoningen"],
      en: ["corner homes", "corner houses", "end-of-terrace homes"],
    },
    exclusions: ["nieuwbouw", "woz", "verkoopprijs", "huurwoningen"],
    category_filters: {
      Woningtype: "Hoekwoning",
      Woningkenmerk: "Totaal woningen",
    },
    selection_priority: 10,
  },
  {
    metric_code: "total_rental_homes",
    label: "Total rental homes",
    domain_id: "bouwen-en-wonen",
    match: { dataset_code: "82900NED", measure_name: "Totaal huurwoningen" },
    description: "Total number of rental homes.",
    aggregation: "sum",
    synonyms: {
      nl: ["huurwoningen", "totaal huurwoningen", "aantal huurwoningen"],
      en: ["rental homes", "total rental homes", "rental housing stock"],
    },
    exclusions: ["huurverhoging", "rent increase", "huurprijs"],
    selection_priority: 10,
  },
  {
    metric_code: "new_construction",
    label: "New construction",
    domain_id: "bouwen-en-wonen",
    match: { dataset_code: "86054NED", measure_name: "Nieuwbouw" },
    description: "Number of newly built homes.",
    aggregation: "sum",
    synonyms: {
      nl: ["nieuwbouw", "nieuwe woningen", "gebouwde woningen"],
      en: ["new construction", "newly built homes", "new homes"],
    },
    exclusions: ["bouwvergunningen", "permits"],
    selection_priority: 10,
  },
  {
    metric_code: "demolished_dwellings",
    label: "Demolished dwellings",
    match: { dataset_code: "86054NED", measure_name: "Sloop" },
    description: "Number of demolished homes.",
    aggregation: "sum",
    synonyms: {
      nl: ["sloop", "gesloopte woningen", "meeste gesloopte woningen", "gesloopte huizen"],
      en: ["demolished dwellings", "demolished homes", "demolition"],
    },
    exclusions: ["nieuwbouw", "vergunningen", "tijdelijke woningen"],
    selection_priority: 8,
  },
  {
    metric_code: "housing_transformations",
    label: "Housing transformations",
    match: { dataset_code: "86054NED", measure_name: "Transformatie" },
    description: "Number of homes added through transformation.",
    aggregation: "sum",
    synonyms: {
      nl: ["transformatie", "woningtransformatie", "woningtransformaties", "getransformeerde woningen"],
      en: ["housing transformations", "transformed homes"],
    },
    exclusions: ["sloop", "vergunningen"],
    selection_priority: 8,
  },
  {
    metric_code: "permitted_temporary_homes",
    label: "Permitted temporary homes",
    match: { dataset_code: "86318NED", measure_name: "Vergunde tijdelijke woningen" },
    description: "Number of permitted temporary homes.",
    aggregation: "sum",
    synonyms: {
      nl: ["vergunde tijdelijke woningen", "tijdelijke woningen", "tijdelijke woningvergunningen", "meeste vergunde tijdelijke woningen"],
      en: ["permitted temporary homes", "temporary housing permits"],
    },
    exclusions: ["woningvoorraad", "sloop", "nieuwbouw"],
    selection_priority: 8,
  },
  {
    metric_code: "housing_splits",
    label: "Housing splits",
    match: { dataset_code: "86054NED", measure_code: "Woningsplitsing_8" },
    description: "Number of homes added through housing splits.",
    aggregation: "sum",
    synonyms: {
      nl: ["woningsplitsing", "woningsplitsingen", "gesplitste woningen", "meeste woningsplitsingen"],
      en: ["housing splits", "split dwellings"],
    },
    exclusions: ["woningsamenvoeging", "sloop", "nieuwbouw"],
    selection_priority: 8,
  },
  {
    metric_code: "housing_mergers",
    label: "Housing mergers",
    match: { dataset_code: "86054NED", measure_code: "Woningsamenvoeging_9" },
    description: "Number of homes removed through housing mergers.",
    aggregation: "sum",
    synonyms: {
      nl: ["woningsamenvoeging", "woningsamenvoegingen", "samengevoegde woningen", "meeste samengevoegde woningen"],
      en: ["housing mergers", "merged dwellings"],
    },
    exclusions: ["woningsplitsing", "sloop", "nieuwbouw"],
    selection_priority: 8,
  },
  {
    metric_code: "housing_stock_balance",
    label: "Housing stock balance",
    match: { dataset_code: "86054NED", measure_code: "SaldoVoorraad_26" },
    description: "Net change in the housing stock.",
    aggregation: "sum",
    synonyms: {
      nl: ["saldo woningvoorraad", "saldo voorraad", "netto verandering woningvoorraad", "krimp woningvoorraad", "groei woningvoorraad"],
      en: ["housing stock balance", "net housing stock change"],
    },
    exclusions: ["beginstand", "eindstand"],
    selection_priority: 8,
  },
  {
    metric_code: "physical_housing_additions",
    label: "Physical housing additions",
    match: { dataset_code: "86054NED", measure_code: "TotaalFysiekeToevoeging_4" },
    description: "Total physical additions to the housing stock.",
    aggregation: "sum",
    synonyms: {
      nl: ["fysieke toevoeging", "fysieke toevoegingen", "totaal fysieke toevoeging", "toevoegingen woningvoorraad"],
      en: ["physical housing additions", "physical additions"],
    },
    exclusions: ["onttrekking", "sloop"],
    selection_priority: 8,
  },
  {
    metric_code: "physical_housing_withdrawals",
    label: "Physical housing withdrawals",
    match: { dataset_code: "86054NED", measure_code: "TotaalFysiekeOnttrekking_17" },
    description: "Total physical withdrawals from the housing stock.",
    aggregation: "sum",
    synonyms: {
      nl: ["fysieke onttrekking", "fysieke onttrekkingen", "totaal fysieke onttrekking", "onttrekkingen woningvoorraad"],
      en: ["physical housing withdrawals", "physical withdrawals"],
    },
    exclusions: ["toevoeging", "nieuwbouw"],
    selection_priority: 8,
  },
  {
    metric_code: "average_net_housing_costs",
    label: "Average net housing costs",
    match: { dataset_code: "85949NED", measure_code: "NettoWoonlasten_3" },
    description: "Average net housing costs for households.",
    aggregation: "average",
    synonyms: {
      nl: ["netto woonlasten", "gemiddelde netto woonlasten"],
      en: ["net housing costs", "average net housing costs"],
    },
    exclusions: ["mediaan", "bijkomende woonlasten", "totale woonlasten", "woonquote"],
    category_filters: {
      EigenaarHuurder: "Totaal",
      Huishoudenskenmerken: "Totaal",
      Woningkenmerken: "Totaal ",
    },
    selection_priority: 8,
  },
  {
    metric_code: "average_additional_housing_costs",
    label: "Average additional housing costs",
    match: { dataset_code: "85949NED", measure_code: "BijkomendeWoonlasten_4" },
    description: "Average additional housing costs for households.",
    aggregation: "average",
    synonyms: {
      nl: ["bijkomende woonlasten", "gemiddelde bijkomende woonlasten"],
      en: ["additional housing costs", "average additional housing costs"],
    },
    exclusions: ["mediaan", "netto woonlasten", "totale woonlasten", "woonquote"],
    category_filters: {
      EigenaarHuurder: "Totaal",
      Huishoudenskenmerken: "Totaal",
      Woningkenmerken: "Totaal ",
    },
    selection_priority: 8,
  },
  {
    metric_code: "average_housing_cost_ratio",
    label: "Average housing cost ratio",
    match: { dataset_code: "85949NED", measure_code: "Woonquote_5" },
    description: "Average share of income spent on housing costs.",
    aggregation: "average",
    synonyms: {
      nl: ["woonquote", "gemiddelde woonquote", "hoogste woonquote", "laagste woonquote"],
      en: ["housing cost ratio", "average housing cost ratio"],
    },
    exclusions: ["mediaan", "woonlasten euro", "netto woonlasten", "bijkomende woonlasten"],
    category_filters: {
      EigenaarHuurder: "Totaal",
      Huishoudenskenmerken: "Totaal",
      Woningkenmerken: "Totaal ",
    },
    selection_priority: 8,
  },
  {
    metric_code: "average_sale_price",
    label: "Average sale price",
    match: { dataset_code: "83625NED", measure_name: "Gemiddelde verkoopprijs" },
    description: "Average sale price of existing owner-occupied homes.",
    aggregation: "average",
    synonyms: {
      nl: ["gemiddelde verkoopprijs", "koopprijs", "huizenprijs", "woningprijs"],
      en: ["average sale price", "house price", "home sale price"],
    },
    exclusions: ["woz", "woningwaarde"],
    selection_priority: 10,
  },
  {
    metric_code: "average_total_housing_costs",
    label: "Average total housing costs",
    match: { dataset_code: "85949NED", measure_code: "TotaleWoonlasten_2" },
    description: "Average total housing costs for households.",
    aggregation: "average",
    synonyms: {
      nl: ["woonlasten", "totale woonlasten", "gemiddelde woonlasten", "woonlasten huishoudens", "kosten wonen"],
      en: ["housing costs", "total housing costs", "average housing costs", "household housing costs"],
    },
    exclusions: ["mediaan", "mediane woonlasten", "woonquote", "bijkomende woonlasten", "netto woonlasten"],
    category_filters: {
      EigenaarHuurder: "Totaal",
      Huishoudenskenmerken: "Totaal",
      Woningkenmerken: "Totaal ",
    },
    selection_priority: 10,
  },
  {
    metric_code: "median_total_housing_costs",
    label: "Median total housing costs",
    match: { dataset_code: "85949NED", measure_code: "TotaleWoonlasten_6" },
    description: "Median total housing costs for households.",
    aggregation: "median",
    synonyms: {
      nl: ["mediane woonlasten", "mediaan woonlasten", "mediane totale woonlasten"],
      en: ["median housing costs", "median total housing costs"],
    },
    exclusions: ["gemiddelde woonlasten", "woonquote", "bijkomende woonlasten", "netto woonlasten"],
    category_filters: {
      EigenaarHuurder: "Totaal",
      Huishoudenskenmerken: "Totaal",
      Woningkenmerken: "Totaal ",
    },
    selection_priority: 12,
  },
  {
    metric_code: "external_hiring_total",
    label: "External hiring expenditure",
    match: { dataset_code: "85455NED", measure_name_contains: "externe inhuur" },
    description: "Total expenditure on externally hired personnel.",
    aggregation: "sum",
    synonyms: {
      nl: ["externe inhuur", "kosten externe inhuur", "ingehuurd personeel"],
      en: ["external hiring", "external personnel costs", "consultancy expenditure"],
    },
    exclusions: ["number of external workers", "external hiring percentage", "external hiring per resident"],
    selection_priority: 10,
  },
];

async function generatedContracts(client) {
  const { rows } = await client.query(`
    select
      m.dataset_code,
      m.measure_key::text as measure_key,
      m.measure_name,
      m.measure_description,
      m.unit_code,
      m.default_aggregation,
      m.min_year,
      m.max_year,
      coalesce(array_agg(distinct g.geography_type || '_' || coalesce(nullif(g.period_type, ''), 'year'))
        filter (where g.geography_type is not null), '{}') as grains
    from semantic.semantic_measure_profile m
    left join semantic.semantic_grain_profile g on g.measure_key = m.measure_key
    where coalesce(m.can_enable_metric, true)
    group by m.dataset_code, m.measure_key, m.measure_name, m.measure_description, m.unit_code, m.default_aggregation, m.min_year, m.max_year
  `);

  return rows.map((row) => {
    const grains = normalizedGrains(row.grains);
    return {
      metric_code: `${slug(row.measure_name)}__${String(row.dataset_code).toLowerCase()}__${row.measure_key}`,
      label: row.measure_name,
      description: row.measure_description,
      measure_key: row.measure_key,
      dataset_codes: [row.dataset_code],
      unit_code: row.unit_code,
      aggregation: row.default_aggregation ?? "none",
      valid_grains: grains,
      default_grain: defaultGrain(grains),
      synonyms: { nl: [row.measure_name], en: [] },
      exclusions: [],
      supports: supportsFor(grains, row),
      category_filters: {},
      selection_priority: 100,
      metadata_origin: "generated",
      contract_status: "generated",
      execution_status: "disabled",
      semantic_quality_status: grains.length ? "profiled" : "incomplete",
      availability_status: grains.length ? "available" : "unknown",
    };
  });
}

async function resolveCurated(client, row) {
  const params = [row.match.dataset_code, row.match.measure_name ?? null, row.match.measure_name_contains ?? null, row.match.measure_code ?? null];
  const result = row.domain_id === "inkomen-en-bestedingen"
    ? await client.query(`
      select
        d.dataset_key,
        d.dataset_code,
        m.measure_key,
        m.measure_code,
        m.measure_name,
        m.measure_description,
        m.topic,
        m.subtopic,
        u.unit_key,
        u.unit_code,
        u.unit_name,
        u.unit_category,
        u.scale_factor,
        m.default_aggregation,
        m.is_additive,
        m.is_non_additive,
        m.value_type,
        count(f.*)::bigint as fact_row_count,
        count(f.*) filter (where f.observation_value is not null and f.is_missing = false)::bigint as populated_fact_row_count,
        min(f.calendar_year) as min_year,
        max(f.calendar_year) as max_year,
        coalesce(array_agg(distinct (
          case when f.geography_type in ('country', 'unknown') then 'national' else f.geography_type end
          || '_' || coalesce(nullif(f.period_type, ''), 'year')
        ))
          filter (where f.geography_type is not null), '{}') as grains
      from gold_inkomen_bestedingen.fact_income_observation f
      join gold.dim_dataset d on d.dataset_key = f.dataset_key
      join gold.dim_measure m on m.measure_key = f.measure_key
      join gold.dim_unit u on u.unit_key = f.unit_key
      where d.dataset_code = $1
        and ($2::text is null or lower(m.measure_name) = lower($2))
        and ($3::text is null or lower(m.measure_name) like '%' || lower($3) || '%')
        and ($4::text is null or lower(m.measure_code) = lower($4))
      group by d.dataset_key, d.dataset_code, m.measure_key, m.measure_code, m.measure_name, m.measure_description,
        m.topic, m.subtopic, u.unit_key, u.unit_code, u.unit_name, u.unit_category, u.scale_factor, m.default_aggregation,
        m.is_additive, m.is_non_additive, m.value_type
      order by max(f.calendar_year) desc nulls last
      limit 1
    `, params)
    : await client.query(`
      select m.*, coalesce(array_agg(distinct g.geography_type || '_' || coalesce(nullif(g.period_type, ''), 'year'))
        filter (where g.geography_type is not null), '{}') as grains
      from semantic.semantic_measure_profile m
      left join semantic.semantic_grain_profile g on g.measure_key = m.measure_key
      where m.dataset_code = $1
        and ($2::text is null or lower(m.measure_name) = lower($2))
        and ($3::text is null or lower(m.measure_name) like '%' || lower($3) || '%')
        and ($4::text is null or lower(m.measure_code) = lower($4))
      group by m.dataset_key, m.dataset_code, m.measure_key, m.measure_code, m.measure_name, m.measure_description,
        m.topic, m.subtopic, m.unit_key, m.unit_code, m.unit_name, m.unit_category, m.scale_factor, m.default_aggregation,
        m.is_additive, m.is_non_additive, m.value_type, m.fact_row_count, m.populated_fact_row_count, m.min_year, m.max_year,
        m.geography_types, m.period_types, m.geography_count, m.period_count, m.min_value, m.max_value, m.suggested_aggregation,
        m.can_enable_metric, m.profile_depth, m.metadata_origin, m.generated_at
      order by m.max_year desc nulls last
      limit 1
    `, params);
  const match = result.rows[0];
  if (!match) return null;
  const grains = normalizedGrains(match.grains);
  return {
    metric_code: row.metric_code,
    label: row.label,
    domain_id: row.domain_id ?? "bouwen-en-wonen",
    description: row.description,
    measure_key: String(match.measure_key),
    dataset_codes: [match.dataset_code],
    unit_code: match.unit_code,
    aggregation: row.aggregation,
    valid_grains: grains,
    default_grain: row.default_grain && grains.includes(row.default_grain) ? row.default_grain : defaultGrain(grains),
    synonyms: row.synonyms,
    exclusions: row.exclusions ?? [],
    supports: {
      ...supportsFor(grains, match),
      ranking: true,
      trend: true,
      comparison: true,
      percentage_change: true,
    },
    category_filters: row.category_filters ?? {},
    selection_priority: row.selection_priority ?? 10,
    metadata_origin: "curated",
    contract_status: "curated",
    execution_status: "enabled",
    semantic_quality_status: "curated",
    availability_status: grains.length ? "available" : "unknown",
  };
}

async function upsertContracts(client, rows) {
  const deduped = Array.from(new Map(rows.map((row) => [row.metric_code, row])).values());
  if (!deduped.length) return;
  await client.query(`
    insert into semantic.metric_contract (
      metric_code, label, description, domain_id, measure_key, dataset_codes, unit_code, aggregation,
      valid_grains, default_grain, synonyms, exclusions, supports, category_filters, selection_priority,
      metadata_origin, contract_status, execution_status, semantic_quality_status, availability_status,
      availability_checked_at, is_active, updated_at
    )
    select
      metric_code, label, description, coalesce(domain_id, 'bouwen-en-wonen'), measure_key::bigint, dataset_codes, unit_code, aggregation,
      valid_grains, default_grain, synonyms, exclusions, supports, category_filters, selection_priority,
      metadata_origin, contract_status, execution_status, semantic_quality_status, availability_status,
      now(), true, now()
    from jsonb_to_recordset($1::jsonb) as row(
      metric_code text,
      label text,
      description text,
      domain_id text,
      measure_key text,
      dataset_codes text[],
      unit_code text,
      aggregation text,
      valid_grains text[],
      default_grain text,
      synonyms jsonb,
      exclusions text[],
      supports jsonb,
      category_filters jsonb,
      selection_priority integer,
      metadata_origin text,
      contract_status text,
      execution_status text,
      semantic_quality_status text,
      availability_status text
    )
    on conflict (metric_code) do update set
      domain_id = excluded.domain_id,
      label = excluded.label,
      description = excluded.description,
      measure_key = excluded.measure_key,
      dataset_codes = excluded.dataset_codes,
      unit_code = excluded.unit_code,
      aggregation = excluded.aggregation,
      valid_grains = excluded.valid_grains,
      default_grain = excluded.default_grain,
      synonyms = excluded.synonyms,
      exclusions = excluded.exclusions,
      supports = excluded.supports,
      category_filters = excluded.category_filters,
      selection_priority = excluded.selection_priority,
      metadata_origin = excluded.metadata_origin,
      contract_status = excluded.contract_status,
      execution_status = excluded.execution_status,
      semantic_quality_status = excluded.semantic_quality_status,
      availability_status = excluded.availability_status,
      availability_checked_at = excluded.availability_checked_at,
      is_active = true,
      updated_at = now()
  `, [JSON.stringify(deduped)]);
}

async function main() {
  loadLocalEnv();
  const client = createPostgresClient({
    applicationName: "guara-semantic-contract-loader",
    statementTimeoutMs: 300000,
    queryTimeoutMs: 300000,
  });
  await client.connect();
  try {
    const generated = await generatedContracts(client);
    const curated = [];
    for (const row of curatedContracts) {
      const contract = await resolveCurated(client, row);
      if (contract) curated.push(contract);
    }
    await upsertContracts(client, generated);
    await upsertContracts(client, curated);
    await client.query(
      `
        update semantic.metric_contract
        set is_active = false, updated_at = now()
        where metadata_origin = 'generated'
          and not (metric_code = any($1::text[]))
      `,
      [generated.map((row) => row.metric_code)]
    );
    await client.query("notify pgrst, 'reload schema'");
    console.log(`Loaded semantic metric contracts: ${generated.length} generated, ${curated.length} curated.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
