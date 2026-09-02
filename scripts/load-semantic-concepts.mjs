#!/usr/bin/env node
import { createPostgresClient, loadLocalEnv } from "./lib/runtime.mjs";

const concepts = [
  {
    concept_code: "new_construction_dwellings",
    label: "Newly built dwellings",
    description: "Completed newly built homes, usually counted by municipality and year.",
    required_unit_code: "COUNT",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["nieuwbouwwoningen", "nieuwbouwwoningen gebouwd", "nieuwbouw woningen", "nieuwe woningen gebouwd", "gebouwde woningen", "opgeleverde nieuwbouw", "woningbouw", "weinig woningbouw", "veel woningbouw", "waar zijn de meeste nieuwbouwwoningen gebouwd"],
      en: ["newly built dwellings", "new construction dwellings", "new homes built", "completed new homes"],
    },
    exclusions: ["bouwkosten", "bedrijfsgebouwen", "vergunningen", "index", "marktsector", "budgetsector", "late respons"],
    bindings: [
      {
        metric_code: "new_construction",
        binding_role: "primary",
        priority: 10,
        selection_reason: "Use the municipality-capable CBS new construction count metric for questions about newly built dwellings.",
      },
    ],
  },
  {
    concept_code: "housing_stock",
    label: "Housing stock",
    description: "Number of homes in the housing stock.",
    required_unit_code: "COUNT",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["woningvoorraad", "woningen", "aantal woningen", "hoeveel woningen", "minste woningen", "meeste woningen"],
      en: ["housing stock", "number of homes", "dwellings", "fewest homes", "most homes"],
    },
    exclusions: ["woz", "woningwaarde", "huurwoningen", "verkoopprijs", "sloop", "gesloopte", "vergunde", "tijdelijke woningen", "transformatie", "woningtransformatie", "nieuwbouw"],
    bindings: [
      {
        metric_code: "housing_stock_start",
        binding_role: "primary",
        priority: 20,
        selection_reason: "Use housing stock at start of period as the default count of homes.",
      },
    ],
  },
  {
    concept_code: "single_family_homes",
    label: "Single-family homes",
    description: "Housing stock filtered to single-family homes.",
    required_unit_code: "COUNT",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["eengezinswoningen", "eengezinswoning", "eensgezinswoningen", "meeste eengezinswoningen", "meeste eensgezinswoningen", "aantal eengezinswoningen"],
      en: ["single-family homes", "single family homes", "single-family dwellings"],
    },
    exclusions: ["nieuwbouw", "gebouwd", "opgeleverd", "woz", "verkoopprijs", "huurwoningen"],
    bindings: [
      {
        metric_code: "housing_stock_start",
        binding_role: "primary",
        priority: 10,
        category_filters: {
          Woningtype: "Eengezinswoning",
          Bouwjaarklasse: "Totaal",
        },
        selection_reason: "Use housing stock with Woningtype filtered to Eengezinswoning.",
      },
    ],
  },
  {
    concept_code: "corner_homes",
    label: "Corner homes",
    description: "Housing stock filtered to corner homes.",
    required_unit_code: "COUNT",
    default_grain: "region_year",
    valid_grains: ["region_year", "province_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["hoekwoningen", "hoekwoning", "eengezins hoekwoning", "aantal hoekwoningen", "meeste hoekwoningen"],
      en: ["corner homes", "corner houses", "end-of-terrace homes"],
    },
    exclusions: ["nieuwbouw", "woz", "verkoopprijs", "huurwoningen"],
    bindings: [
      {
        metric_code: "corner_homes",
        binding_role: "primary",
        priority: 10,
        category_filters: {
          Woningtype: "Hoekwoning",
          Woningkenmerk: "Totaal woningen",
        },
        selection_reason: "Use dataset 85035NED housing stock filtered to Woningtype=Hoekwoning. This dataset supports region, province and national grains, not municipality.",
      },
    ],
  },
  {
    concept_code: "average_woz_home_value",
    label: "Average WOZ home value",
    description: "Average assessed WOZ value of homes.",
    required_unit_code: "EUR_THOUSANDS",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["woz", "woz waarde", "gemiddelde woz waarde", "gemiddelde woningwaarde", "woningwaarde"],
      en: ["woz value", "average home value", "average property value"],
    },
    exclusions: ["verkoopprijs", "huur", "woningvoorraad"],
    bindings: [
      {
        metric_code: "average_woz_home_value",
        binding_role: "primary",
        priority: 10,
        selection_reason: "Use the current CBS WOZ value metric where available.",
      },
    ],
  },
  {
    concept_code: "total_rental_homes",
    label: "Total rental homes",
    description: "Total count of rental homes.",
    required_unit_code: "COUNT",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "share"],
    synonyms: {
      nl: ["huurwoningen", "totaal huurwoningen", "aantal huurwoningen"],
      en: ["rental homes", "rental dwellings", "total rental homes"],
    },
    exclusions: ["huurverhoging", "huurprijs"],
    bindings: [
      {
        metric_code: "total_rental_homes",
        binding_role: "primary",
        priority: 10,
        selection_reason: "Use the explicit total rental homes count metric.",
      },
    ],
  },
  {
    concept_code: "rent_increase",
    label: "Rent increase",
    description: "Average rent increase, including rent harmonisation unless the user asks otherwise.",
    required_unit_code: "PERCENT",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend"],
    synonyms: {
      nl: ["huurverhoging", "meeste huurverhoging", "hoogste huurverhoging"],
      en: ["rent increase", "highest rent increase"],
    },
    exclusions: ["huurwoningen", "huurprijs"],
    bindings: [
      {
        metric_code: "rent_increase_including_harmonisation",
        binding_role: "primary",
        priority: 10,
        selection_reason: "Use the inclusive rent harmonisation metric as the default rent-increase concept.",
      },
    ],
  },
  {
    concept_code: "home_satisfaction",
    label: "Satisfaction with current home",
    description: "Share of people satisfied with their current home.",
    required_unit_code: "PERCENT",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend"],
    synonyms: {
      nl: ["woontevredenheid", "tevreden over woning", "tevredenheid met woning", "tevreden met huidige woning"],
      en: ["housing satisfaction", "satisfied with home"],
    },
    exclusions: ["woonomgeving"],
    bindings: [
      {
        metric_code: "current_home_satisfaction",
        binding_role: "primary",
        priority: 10,
        selection_reason: "Use satisfaction with current home with canonical total filters.",
      },
    ],
  },
  {
    concept_code: "demolished_dwellings",
    label: "Demolished dwellings",
    description: "Number of demolished homes.",
    required_unit_code: "COUNT",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["sloop", "gesloopte woningen", "meeste gesloopte woningen", "gesloopte huizen"],
      en: ["demolished dwellings", "demolished homes", "demolition"],
    },
    exclusions: ["nieuwbouw", "vergunningen", "tijdelijke woningen"],
    bindings: [
      {
        metric_code: "demolished_dwellings",
        binding_role: "primary",
        priority: 8,
        selection_reason: "Use the CBS Sloop measure from the municipality-capable housing-stock-flow dataset.",
      },
    ],
  },
  {
    concept_code: "housing_transformations",
    label: "Housing transformations",
    description: "Number of homes added through transformation.",
    required_unit_code: "COUNT",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["transformatie", "woningtransformatie", "woningtransformaties", "getransformeerde woningen"],
      en: ["housing transformations", "transformed homes"],
    },
    exclusions: ["sloop", "vergunningen"],
    bindings: [
      {
        metric_code: "housing_transformations",
        binding_role: "primary",
        priority: 8,
        selection_reason: "Use the CBS Transformatie measure from the municipality-capable housing-stock-flow dataset.",
      },
    ],
  },
  {
    concept_code: "temporary_housing_permits",
    label: "Permitted temporary homes",
    description: "Number of permitted temporary homes.",
    required_unit_code: "COUNT",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["vergunde tijdelijke woningen", "tijdelijke woningen", "tijdelijke woningvergunningen", "meeste vergunde tijdelijke woningen"],
      en: ["permitted temporary homes", "temporary housing permits"],
    },
    exclusions: ["woningvoorraad", "sloop", "nieuwbouw"],
    bindings: [
      {
        metric_code: "permitted_temporary_homes",
        binding_role: "primary",
        priority: 8,
        selection_reason: "Use the explicit CBS permitted temporary homes measure.",
      },
    ],
  },
  {
    concept_code: "housing_splits",
    label: "Housing splits",
    description: "Homes added through housing splits.",
    required_unit_code: "COUNT",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["woningsplitsing", "woningsplitsingen", "gesplitste woningen"],
      en: ["housing splits", "split dwellings"],
    },
    exclusions: ["woningsamenvoeging"],
    bindings: [{ metric_code: "housing_splits", binding_role: "primary", priority: 8, selection_reason: "Use CBS Woningsplitsing for questions about split dwellings." }],
  },
  {
    concept_code: "housing_mergers",
    label: "Housing mergers",
    description: "Homes removed through housing mergers.",
    required_unit_code: "COUNT",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["woningsamenvoeging", "woningsamenvoegingen", "samengevoegde woningen"],
      en: ["housing mergers", "merged dwellings"],
    },
    exclusions: ["woningsplitsing"],
    bindings: [{ metric_code: "housing_mergers", binding_role: "primary", priority: 8, selection_reason: "Use CBS Woningsamenvoeging for questions about merged dwellings." }],
  },
  {
    concept_code: "housing_stock_balance",
    label: "Housing stock balance",
    description: "Net change in the housing stock.",
    required_unit_code: "COUNT",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["saldo woningvoorraad", "saldo voorraad", "netto verandering woningvoorraad", "krimp woningvoorraad", "groei woningvoorraad"],
      en: ["housing stock balance", "net housing stock change"],
    },
    exclusions: ["beginstand", "eindstand"],
    bindings: [{ metric_code: "housing_stock_balance", binding_role: "primary", priority: 8, selection_reason: "Use CBS Saldo voorraad for net housing-stock changes." }],
  },
  {
    concept_code: "physical_housing_additions",
    label: "Physical housing additions",
    description: "Total physical additions to the housing stock.",
    required_unit_code: "COUNT",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["fysieke toevoeging", "fysieke toevoegingen", "totaal fysieke toevoeging", "toevoegingen woningvoorraad"],
      en: ["physical housing additions", "physical additions"],
    },
    exclusions: ["onttrekking"],
    bindings: [{ metric_code: "physical_housing_additions", binding_role: "primary", priority: 8, selection_reason: "Use CBS Totaal fysieke toevoeging for physical additions." }],
  },
  {
    concept_code: "physical_housing_withdrawals",
    label: "Physical housing withdrawals",
    description: "Total physical withdrawals from the housing stock.",
    required_unit_code: "COUNT",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["fysieke onttrekking", "fysieke onttrekkingen", "totaal fysieke onttrekking", "onttrekkingen woningvoorraad"],
      en: ["physical housing withdrawals", "physical withdrawals"],
    },
    exclusions: ["toevoeging"],
    bindings: [{ metric_code: "physical_housing_withdrawals", binding_role: "primary", priority: 8, selection_reason: "Use CBS Totaal fysieke onttrekking for physical withdrawals." }],
  },
  {
    concept_code: "net_housing_costs",
    label: "Net housing costs",
    description: "Average net housing costs for households.",
    required_unit_code: "EUR",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["netto woonlasten", "gemiddelde netto woonlasten"],
      en: ["net housing costs", "average net housing costs"],
    },
    exclusions: ["bijkomende woonlasten", "woonquote"],
    bindings: [{ metric_code: "average_net_housing_costs", binding_role: "primary", priority: 8, selection_reason: "Use average Netto woonlasten with canonical total household filters." }],
  },
  {
    concept_code: "additional_housing_costs",
    label: "Additional housing costs",
    description: "Average additional housing costs for households.",
    required_unit_code: "EUR",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["bijkomende woonlasten", "gemiddelde bijkomende woonlasten"],
      en: ["additional housing costs", "average additional housing costs"],
    },
    exclusions: ["netto woonlasten", "woonquote"],
    bindings: [{ metric_code: "average_additional_housing_costs", binding_role: "primary", priority: 8, selection_reason: "Use average Bijkomende woonlasten with canonical total household filters." }],
  },
  {
    concept_code: "housing_cost_ratio",
    label: "Housing cost ratio",
    description: "Average share of income spent on housing costs.",
    required_unit_code: "PERCENT",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["woonquote", "gemiddelde woonquote", "hoogste woonquote", "laagste woonquote"],
      en: ["housing cost ratio", "average housing cost ratio"],
    },
    exclusions: ["netto woonlasten", "bijkomende woonlasten"],
    bindings: [{ metric_code: "average_housing_cost_ratio", binding_role: "primary", priority: 8, selection_reason: "Use average Woonquote with canonical total household filters." }],
  },
  {
    concept_code: "average_sale_price",
    label: "Average sale price",
    description: "Average sale price of homes.",
    required_unit_code: "EUR",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["gemiddelde verkoopprijs", "verkoopprijs", "verkoopprijzen", "hoge verkoopprijzen", "koopprijs", "huizenprijs", "woningprijs", "verkoopprijsontwikkeling", "bestaande koopwoningen"],
      en: ["average sale price", "house price", "home price"],
    },
    exclusions: ["woz", "woningwaarde"],
    bindings: [
      {
        metric_code: "average_sale_price",
        binding_role: "primary",
        priority: 10,
        selection_reason: "Use the curated average sale price metric.",
      },
    ],
  },
  {
    concept_code: "housing_costs",
    label: "Housing costs",
    description: "Total housing costs for households. Uses average total housing costs unless the user asks for median costs.",
    required_unit_code: "EUR",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["woonlasten", "totale woonlasten", "gemiddelde woonlasten", "woonlasten huishoudens", "kosten wonen"],
      en: ["housing costs", "total housing costs", "average housing costs", "household housing costs"],
    },
    exclusions: ["woonquote", "huurverhoging"],
    bindings: [
      {
        metric_code: "average_total_housing_costs",
        binding_role: "primary",
        priority: 10,
        selection_reason: "Use average total housing costs as the default interpretation for generic woonlasten questions.",
      },
      {
        metric_code: "median_total_housing_costs",
        binding_role: "alternate",
        priority: 30,
        selection_reason: "Use median total housing costs when the question explicitly asks for median woonlasten.",
      },
    ],
  },
  {
    concept_code: "average_personal_income",
    label: "Average personal income",
    domain_id: "inkomen-en-bestedingen",
    description: "Average income of persons with income.",
    required_unit_code: "EUR_THOUSANDS",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["gemiddeld inkomen", "gemiddeld persoonlijk inkomen", "inkomen personen", "persoonlijk inkomen", "hoogste inkomens"],
      en: ["average personal income", "average income", "highest incomes"],
    },
    exclusions: ["huishoudinkomen", "mediaan inkomen", "vermogen"],
    bindings: [{ metric_code: "average_personal_income", binding_role: "primary", priority: 10, selection_reason: "Use average personal income as the default for generic personal-income questions." }],
  },
  {
    concept_code: "median_personal_income",
    label: "Median personal income",
    domain_id: "inkomen-en-bestedingen",
    description: "Median income of persons with income.",
    required_unit_code: "EUR_THOUSANDS",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["mediaan inkomen", "mediaan persoonlijk inkomen", "mediane inkomens"],
      en: ["median personal income", "median income"],
    },
    exclusions: ["gemiddeld inkomen", "huishoudinkomen", "vermogen"],
    bindings: [{ metric_code: "median_personal_income", binding_role: "primary", priority: 10, selection_reason: "Use median personal income when the question explicitly asks for median income." }],
  },
  {
    concept_code: "average_household_income",
    label: "Average household income",
    domain_id: "inkomen-en-bestedingen",
    description: "Average income of private households.",
    required_unit_code: "EUR_THOUSANDS",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["gemiddeld huishoudinkomen", "huishoudinkomen", "inkomen huishoudens", "huishoudinkomens"],
      en: ["average household income", "household income"],
    },
    exclusions: ["persoonlijk inkomen", "mediaan inkomen", "vermogen"],
    bindings: [
      { metric_code: "gen_86161ned_mediaangestandaardiseerdinkomen_4_1al9vf", binding_role: "primary", priority: 5, selection_reason: "Use the regional median standardized household income metric as the geography-capable household-income concept until a regional average household-income contract is curated." },
      { metric_code: "average_household_income", binding_role: "alternate", priority: 25, selection_reason: "Use average household income for national household-income questions." },
    ],
  },
  {
    concept_code: "median_household_income",
    label: "Median household income",
    domain_id: "inkomen-en-bestedingen",
    description: "Median income of private households.",
    required_unit_code: "EUR_THOUSANDS",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["mediaan huishoudinkomen", "mediaan inkomen huishoudens", "mediane huishoudinkomens", "huishoudinkomen", "huishoudinkomens"],
      en: ["median household income"],
    },
    exclusions: ["gemiddeld inkomen", "persoonlijk inkomen", "vermogen"],
    bindings: [
      { metric_code: "gen_86161ned_mediaangestandaardiseerdinkomen_4_1al9vf", binding_role: "primary", priority: 5, selection_reason: "Use the regional CBS median standardized household income metric when geography-level answers are requested." },
      { metric_code: "median_household_income", binding_role: "alternate", priority: 20, selection_reason: "Use the national-only household-income metric only when the requested grain is national." },
    ],
  },
  {
    concept_code: "household_wealth",
    label: "Household wealth",
    domain_id: "inkomen-en-bestedingen",
    description: "Household wealth, defaulting to average wealth unless the user asks for median wealth.",
    required_unit_code: "EUR_THOUSANDS",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["vermogen", "huishoudvermogen", "rijkste gemeenten", "meeste vermogen"],
      en: ["wealth", "household wealth", "wealthiest municipalities"],
    },
    exclusions: ["inkomen", "bestedingen"],
    bindings: [
      { metric_code: "average_household_wealth", binding_role: "primary", priority: 10, selection_reason: "Use average household wealth as the default wealth metric." },
      { metric_code: "median_household_wealth", binding_role: "alternate", priority: 20, selection_reason: "Use median household wealth when the question explicitly asks for median wealth." },
    ],
  },
  {
    concept_code: "low_income",
    label: "Low income",
    domain_id: "inkomen-en-bestedingen",
    description: "Relative share of people, households, or children with a low income.",
    required_unit_code: "PERCENT",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["laag inkomen", "armoede", "lage inkomens", "armoedepercentage"],
      en: ["low income", "poverty", "poverty rate"],
    },
    exclusions: ["aantal huishoudens", "aantal personen"],
    bindings: [
      { metric_code: "gen_86131ned_personentot105armoedegrensrelatief_32_1oacem", binding_role: "primary", priority: 5, selection_reason: "Use the regional relative poverty metric when a geography-level low-income or poverty answer is requested." },
      { metric_code: "gen_86161ned_gestandaardiseerdinkomen2e10groep_8_1lv4y6", binding_role: "alternate", priority: 10, selection_reason: "Use the low standardized-income decile group when the question asks for low income groups." },
      { metric_code: "low_income_households_share", binding_role: "alternate", priority: 30, selection_reason: "Use the national low-income household metric only when no regional grain is requested." },
      { metric_code: "low_income_persons_share", binding_role: "alternate", priority: 35, selection_reason: "Use the national low-income persons metric only when no regional grain is requested." },
      { metric_code: "low_income_children_share", binding_role: "alternate", priority: 25, selection_reason: "Use low-income children share when children or child poverty are requested." },
    ],
  },
  {
    concept_code: "ses_woa_score",
    label: "SES-WOA score",
    domain_id: "inkomen-en-bestedingen",
    description: "CBS/Wijk- en buurtkaart socio-economic status indicator. Higher percentielgroep means a higher relative SES-WOA position.",
    required_unit_code: "UNKNOWN",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "neighborhood_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["ses woa", "ses-woa", "sociaal economische status", "sociaal-economische status", "lage ses", "lage ses woa score", "ses woa score"],
      en: ["ses woa", "socio-economic status", "low socio-economic status"],
    },
    exclusions: [],
    bindings: [
      { metric_code: "gen_86296ned_gemiddeldepercentielgroep_10_1o0mwj", binding_role: "primary", priority: 5, selection_reason: "Use the latest regional SES-WOA average percentile group metric where municipality data is available." },
    ],
  },
  {
    concept_code: "self_employed",
    label: "Self-employed people",
    domain_id: "inkomen-en-bestedingen",
    description: "Number or share of self-employed people, optionally by income position or industry where the source dataset supports it.",
    required_unit_code: "THOUSANDS",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["zelfstandigen", "zzp", "zelfstandigen in bedrijfstakken", "zelfstandigen met laag inkomen"],
      en: ["self-employed", "self employed people", "freelancers"],
    },
    exclusions: ["werknemers"],
    bindings: [
      { metric_code: "gen_86163ned_zelfstandigen_1_1gilxj", binding_role: "primary", priority: 5, selection_reason: "Use the self-employed metric when the question explicitly asks for zelfstandigen; execution still requires a supported geography grain." },
    ],
  },
  {
    concept_code: "health_insurance_payment_arrears",
    label: "Health insurance payment arrears",
    domain_id: "inkomen-en-bestedingen",
    description: "People with payment arrears on health insurance premiums, available by municipality, province, region and country.",
    required_unit_code: "PERCENT",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["betalingsachterstand zorgpremie", "wanbetalers zorgpremie", "zorgpremie achterstand"],
      en: ["health insurance payment arrears", "healthcare premium arrears"],
    },
    exclusions: ["inkomen", "vermogen"],
    bindings: [
      { metric_code: "health_insurance_payment_arrears_share", binding_role: "primary", priority: 10, selection_reason: "Use the relative arrears metric unless the user asks for an absolute count." },
      { metric_code: "health_insurance_payment_arrears_persons", binding_role: "alternate", priority: 20, selection_reason: "Use the count metric when the user asks for number of people." },
    ],
  },
  {
    concept_code: "consumer_confidence",
    label: "Consumer confidence",
    domain_id: "inkomen-en-bestedingen",
    description: "Consumer confidence by province, region and country.",
    required_unit_code: "UNKNOWN",
    default_grain: "province_year",
    valid_grains: ["province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["consumentenvertrouwen", "vertrouwen consumenten"],
      en: ["consumer confidence", "consumer sentiment"],
    },
    exclusions: ["koopbereidheid", "economisch klimaat"],
    bindings: [{ metric_code: "consumer_confidence", binding_role: "primary", priority: 10, selection_reason: "Use the regional CBS consumer confidence indicator." }],
  },
];

async function upsertConcepts(client) {
  await client.query(`
    insert into semantic.concept (
      concept_code, label, description, domain_id, language_code, synonyms, exclusions,
      required_unit_code, default_grain, valid_grains, supported_operations,
      ambiguity_policy, metadata_origin, is_active, updated_at
    )
    select
      concept_code, label, description, coalesce(domain_id, 'bouwen-en-wonen'), 'nl', synonyms, exclusions,
      required_unit_code, default_grain, valid_grains, supported_operations,
      'ask', 'curated', true, now()
    from jsonb_to_recordset($1::jsonb) as row(
      concept_code text,
      label text,
      description text,
      domain_id text,
      synonyms jsonb,
      exclusions text[],
      required_unit_code text,
      default_grain text,
      valid_grains text[],
      supported_operations text[]
    )
    on conflict (concept_code) do update set
      domain_id = excluded.domain_id,
      label = excluded.label,
      description = excluded.description,
      synonyms = excluded.synonyms,
      exclusions = excluded.exclusions,
      required_unit_code = excluded.required_unit_code,
      default_grain = excluded.default_grain,
      valid_grains = excluded.valid_grains,
      supported_operations = excluded.supported_operations,
      metadata_origin = 'curated',
      is_active = true,
      updated_at = now()
  `, [JSON.stringify(concepts.map(({ bindings: _bindings, ...concept }) => concept))]);
}

async function bindingRows(client) {
  const rows = [];
  for (const concept of concepts) {
    for (const binding of concept.bindings) {
      const { rows: matches } = await client.query(`
        select
          metric_code,
          measure_key::text as measure_key,
          dataset_codes[1] as dataset_code,
          unit_code,
          valid_grains,
          category_filters
        from semantic.metric_contract
        where metric_code = $1
          and is_active
        limit 1
      `, [binding.metric_code]);
      const match = matches[0];
      if (!match) {
        console.warn(`Skipped binding ${concept.concept_code} -> ${binding.metric_code}: metric contract not found.`);
        continue;
      }
      rows.push({
        concept_code: concept.concept_code,
        metric_code: binding.metric_code,
        measure_key: match.measure_key,
        dataset_code: match.dataset_code,
        binding_role: binding.binding_role ?? "primary",
        priority: binding.priority ?? 100,
        required_unit_code: concept.required_unit_code,
        allowed_grains: concept.valid_grains,
        category_filters: binding.category_filters ?? match.category_filters ?? {},
        union_rule_code: binding.union_rule_code ?? null,
        selection_reason: binding.selection_reason ?? null,
        metadata_origin: "curated",
      });
    }
  }
  return rows;
}

async function upsertBindings(client, rows) {
  if (!rows.length) return;
  await client.query(`
    insert into semantic.concept_metric_binding (
      concept_code, metric_code, measure_key, dataset_code, binding_role, priority,
      required_unit_code, allowed_grains, category_filters, union_rule_code,
      selection_reason, metadata_origin, is_active, updated_at
    )
    select
      concept_code, metric_code, measure_key::bigint, dataset_code, binding_role, priority,
      required_unit_code, allowed_grains, category_filters, union_rule_code,
      selection_reason, metadata_origin, true, now()
    from jsonb_to_recordset($1::jsonb) as row(
      concept_code text,
      metric_code text,
      measure_key text,
      dataset_code text,
      binding_role text,
      priority integer,
      required_unit_code text,
      allowed_grains text[],
      category_filters jsonb,
      union_rule_code text,
      selection_reason text,
      metadata_origin text
    )
    on conflict (concept_code, metric_code, binding_role) do update set
      measure_key = excluded.measure_key,
      dataset_code = excluded.dataset_code,
      priority = excluded.priority,
      required_unit_code = excluded.required_unit_code,
      allowed_grains = excluded.allowed_grains,
      category_filters = excluded.category_filters,
      union_rule_code = excluded.union_rule_code,
      selection_reason = excluded.selection_reason,
      metadata_origin = excluded.metadata_origin,
      is_active = true,
      updated_at = now()
  `, [JSON.stringify(rows)]);
}

async function main() {
  loadLocalEnv();
  const client = createPostgresClient({
    applicationName: "guara-semantic-concept-loader",
    statementTimeoutMs: 300000,
    queryTimeoutMs: 300000,
  });
  await client.connect();
  try {
    await upsertConcepts(client);
    const rows = await bindingRows(client);
    await upsertBindings(client, rows);
    await client.query(
      `
        update semantic.concept_metric_binding
        set is_active = false, updated_at = now()
        where metadata_origin = 'curated'
          and not exists (
            select 1
            from jsonb_to_recordset($1::jsonb) as row(concept_code text, metric_code text, binding_role text)
            where row.concept_code = concept_metric_binding.concept_code
              and row.metric_code = concept_metric_binding.metric_code
              and row.binding_role = concept_metric_binding.binding_role
          )
      `,
      [JSON.stringify(rows.map((row) => ({
        concept_code: row.concept_code,
        metric_code: row.metric_code,
        binding_role: row.binding_role,
      })))]
    );
    await client.query("notify pgrst, 'reload schema'");
    console.log(`Loaded semantic concepts: ${concepts.length} concepts, ${rows.length} metric binding(s).`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
