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
      nl: ["nieuwbouwwoningen", "nieuwbouwwoningen gebouwd", "nieuwbouw woningen", "nieuwe woningen gebouwd", "gebouwde woningen", "opgeleverde nieuwbouw", "waar zijn de meeste nieuwbouwwoningen gebouwd"],
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
    exclusions: ["woz", "woningwaarde", "huurwoningen", "verkoopprijs"],
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
    concept_code: "average_sale_price",
    label: "Average sale price",
    description: "Average sale price of homes.",
    required_unit_code: "EUR",
    default_grain: "municipality_year",
    valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    supported_operations: ["ranking", "comparison", "trend", "percentage_change"],
    synonyms: {
      nl: ["gemiddelde verkoopprijs", "koopprijs", "huizenprijs", "woningprijs"],
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
];

async function upsertConcepts(client) {
  await client.query(`
    insert into semantic.concept (
      concept_code, label, description, domain_id, language_code, synonyms, exclusions,
      required_unit_code, default_grain, valid_grains, supported_operations,
      ambiguity_policy, metadata_origin, is_active, updated_at
    )
    select
      concept_code, label, description, 'bouwen-en-wonen', 'nl', synonyms, exclusions,
      required_unit_code, default_grain, valid_grains, supported_operations,
      'ask', 'curated', true, now()
    from jsonb_to_recordset($1::jsonb) as row(
      concept_code text,
      label text,
      description text,
      synonyms jsonb,
      exclusions text[],
      required_unit_code text,
      default_grain text,
      valid_grains text[],
      supported_operations text[]
    )
    on conflict (concept_code) do update set
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
