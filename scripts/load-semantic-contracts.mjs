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
  if (geography === "country") return "national_year";
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
    metric_code: "average_woz_home_value",
    label: "Average WOZ home value",
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
    match: { dataset_code: "82550NED", measure_name: "Beginstand woningvoorraad" },
    description: "Number of homes in the housing stock at the start of the period.",
    aggregation: "sum",
    synonyms: {
      nl: ["woningen", "woningvoorraad", "aantal woningen", "hoeveel woningen"],
      en: ["housing stock", "number of homes", "dwellings"],
    },
    exclusions: ["woningwaarde", "woz", "huurwoningen", "woningtype"],
    selection_priority: 20,
  },
  {
    metric_code: "corner_homes",
    label: "Corner homes",
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
  const result = await client.query(`
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
      metric_code, label, description, 'bouwen-en-wonen', measure_key::bigint, dataset_codes, unit_code, aggregation,
      valid_grains, default_grain, synonyms, exclusions, supports, category_filters, selection_priority,
      metadata_origin, contract_status, execution_status, semantic_quality_status, availability_status,
      now(), true, now()
    from jsonb_to_recordset($1::jsonb) as row(
      metric_code text,
      label text,
      description text,
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
