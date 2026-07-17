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

function parseArgs(argv) {
  return {
    dryRun: argv.includes("--dry-run"),
    skipGrains: argv.includes("--skip-grains"),
  };
}

const metricAliases = [
  { alias: "WOZ", label: "Gemiddelde WOZ-waarde van woningen", dataset: "85036NED", notes: "Common shorthand for average WOZ housing value." },
  { alias: "woningwaarde", label: "Gemiddelde WOZ-waarde van woningen", dataset: "85036NED" },
  { alias: "house value", label: "Gemiddelde WOZ-waarde van woningen", dataset: "85036NED" },
  { alias: "house price", label: "Gemiddelde verkoopprijs", dataset: "83625NED" },
  { alias: "koopprijs", label: "Gemiddelde verkoopprijs", dataset: "83625NED" },
  { alias: "huurwoningen", label: "Totaal huurwoningen", dataset: "82900NED" },
  { alias: "corporation-owned rental homes", label: "Eigendom woningcorporatie", dataset: "82900NED" },
  { alias: "woningcorporatie huurwoningen", label: "Eigendom woningcorporatie", dataset: "82900NED" },
  { alias: "nieuwbouw", label: "Nieuwbouw", dataset: "82235NED" },
  { alias: "huurverhoging", label: "Huurverhoging inclusief huurharmonisatie", dataset: "83162NED" },
];

const metricPreferences = [
  {
    code: "gemiddelde-verkoopprijs-municipality",
    label: "Gemiddelde verkoopprijs",
    dataset: "83625NED",
    geographyType: "municipality",
    calculationCode: null,
    reason: "Prefer the municipality-capable regional existing-home price dataset for municipality questions.",
  },
  {
    code: "gemiddelde-verkoopprijs-ranking",
    label: "Gemiddelde verkoopprijs",
    dataset: "83625NED",
    geographyType: "municipality",
    calculationCode: "ranking",
    reason: "Use municipality-capable price metric for rankings.",
  },
  {
    code: "huurverhoging-municipality",
    label: "Huurverhoging inclusief huurharmonisatie",
    dataset: "83162NED",
    geographyType: "municipality",
    calculationCode: null,
    reason: "Prefer municipality-capable rent increase dataset when municipalities are requested.",
  },
];

const geographyAliases = [
  { alias: "Nederland", type: "country", name: "Nederland", code: "NL00" },
  { alias: "the Netherlands", type: "country", name: "Nederland", code: "NL00" },
  { alias: "Den Haag", type: "municipality", name: "'s-Gravenhage (gemeente)", code: "GM0518" },
  { alias: "s-Gravenhage", type: "municipality", name: "'s-Gravenhage (gemeente)", code: "GM0518" },
  { alias: "Utrecht municipality", type: "municipality", name: "Utrecht (gemeente)", code: "GM0344" },
  { alias: "Utrecht gemeente", type: "municipality", name: "Utrecht (gemeente)", code: "GM0344" },
  { alias: "province Utrecht", type: "province", name: "Utrecht (PV)", code: "PV26" },
  { alias: "provincie Utrecht", type: "province", name: "Utrecht (PV)", code: "PV26" },
];

const goldenQuestions = [
  {
    question: "What share of Totaal huurwoningen in Rotterdam were Eigendom woningcorporatie in 2023?",
    intent: "compare_geographies",
    calculation: "share_of_total",
    measure: "Eigendom woningcorporatie",
    secondary: "Totaal huurwoningen",
    geographies: ["Rotterdam"],
    geographyType: "municipality",
    year: 2023,
    shape: { columns: ["share_percent", "numerator_value", "denominator_value"] },
  },
  {
    question: "Which municipalities have high Gemiddelde WOZ-waarde van woningen but low Totaal huurwoningen in 2023?",
    intent: "rank_geographies",
    calculation: "multi_metric_rank",
    measure: "Gemiddelde WOZ-waarde van woningen",
    secondary: "Totaal huurwoningen",
    geographyType: "municipality",
    year: 2023,
    shape: { columns: ["primary_value", "secondary_value", "combined_rank_score"] },
  },
  {
    question: "Which municipalities had the biggest increase in Gemiddelde WOZ-waarde van woningen between 2020 and 2023?",
    intent: "rank_geographies",
    calculation: "change_rank",
    measure: "Gemiddelde WOZ-waarde van woningen",
    geographyType: "municipality",
    yearStart: 2020,
    yearEnd: 2023,
    shape: { columns: ["start_value", "end_value", "absolute_change", "percentage_change"] },
  },
  {
    question: "Show Gemiddelde WOZ-waarde van woningen for province Utrecht in 2023.",
    intent: "compare_geographies",
    calculation: "comparison",
    measure: "Gemiddelde WOZ-waarde van woningen",
    geographies: ["Utrecht (PV)"],
    geographyType: "province",
    year: 2023,
    shape: { columns: ["geography_name", "value", "unit_code"] },
  },
  {
    question: "Compare Rotterdam with the national average for Totaal huurwoningen in 2023.",
    intent: "compare_geographies",
    calculation: "compare_to_average",
    measure: "Totaal huurwoningen",
    geographies: ["Rotterdam"],
    geographyType: "municipality",
    year: 2023,
    shape: { columns: ["value", "average_value", "difference_from_average", "ratio_to_average"] },
  },
];

async function measureKey(client, label, dataset) {
  const result = await client.query(
    `
      select measure_key
      from gold.dim_measure
      where lower(measure_name) = lower($1)
        and ($2::text is null or dataset_code = $2)
      order by case when dataset_code = $2 then 0 else 1 end, updated_at desc nulls last
      limit 1
    `,
    [label, dataset ?? null]
  );
  return result.rows[0]?.measure_key ?? null;
}

async function upsertMetricGrains(client) {
  await client.query(`
    insert into semantic.metric_grain (
      measure_key, dataset_code, geography_type, period_type, min_year, max_year, fact_row_count, metadata_origin, updated_at
    )
    select
      f.measure_key,
      max(f.dataset_code) as dataset_code,
      coalesce(nullif(f.geography_type, ''), 'unknown') as geography_type,
      coalesce(nullif(f.period_type, ''), 'unknown') as period_type,
      min(f.calendar_year) as min_year,
      max(f.calendar_year) as max_year,
      count(*)::bigint as fact_row_count,
      'generated' as metadata_origin,
      now() as updated_at
    from gold_bouwen_wonen.fact_housing_observation f
    where f.measure_key is not null
    group by f.measure_key, coalesce(nullif(f.geography_type, ''), 'unknown'), coalesce(nullif(f.period_type, ''), 'unknown')
    on conflict (measure_key, geography_type, period_type) do update set
      dataset_code = excluded.dataset_code,
      min_year = excluded.min_year,
      max_year = excluded.max_year,
      fact_row_count = excluded.fact_row_count,
      metadata_origin = case when semantic.metric_grain.metadata_origin = 'curated' then semantic.metric_grain.metadata_origin else excluded.metadata_origin end,
      updated_at = now()
  `);
}

async function main() {
  loadLocalEnv();
  const options = parseArgs(process.argv);
  const client = createPostgresClient({
    applicationName: "guara-semantic-curation-loader",
    statementTimeoutMs: 900000,
    queryTimeoutMs: 900000,
  });
  await client.connect();

  try {
    if (options.dryRun) {
      console.log("Dry run: semantic curation seed rows", {
        metricAliases: metricAliases.length,
        metricPreferences: metricPreferences.length,
        geographyAliases: geographyAliases.length,
        goldenQuestions: goldenQuestions.length,
        skipGrains: options.skipGrains,
      });
      return;
    }

    for (const row of metricAliases) {
      const key = await measureKey(client, row.label, row.dataset);
      await client.query(
        `
          insert into semantic.metric_alias (
            alias, normalized_alias, language_code, domain_id, measure_key, dataset_code, priority, metadata_origin, notes
          )
          values ($1, $2, 'nl', 'bouwen-en-wonen', $3, $4, 10, 'curated', $5)
          on conflict (normalized_alias, language_code, domain_id, measure_key) do update set
            alias = excluded.alias,
            dataset_code = excluded.dataset_code,
            priority = excluded.priority,
            notes = excluded.notes,
            updated_at = now()
        `,
        [row.alias, normalize(row.alias), key, row.dataset, row.notes ?? null]
      );
    }

    for (const row of metricPreferences) {
      const key = await measureKey(client, row.label, row.dataset);
      if (!key) continue;
      await client.query(
        `
          insert into semantic.metric_preference (
            preference_code, normalized_metric_label, domain_id, geography_type, calculation_code,
            preferred_measure_key, preferred_dataset_code, priority, reason, metadata_origin, is_active
          )
          values ($1, $2, 'bouwen-en-wonen', $3, $4, $5, $6, 10, $7, 'curated', true)
          on conflict (preference_code) do update set
            normalized_metric_label = excluded.normalized_metric_label,
            geography_type = excluded.geography_type,
            calculation_code = excluded.calculation_code,
            preferred_measure_key = excluded.preferred_measure_key,
            preferred_dataset_code = excluded.preferred_dataset_code,
            priority = excluded.priority,
            reason = excluded.reason,
            is_active = true,
            updated_at = now()
        `,
        [row.code, normalize(row.label), row.geographyType, row.calculationCode, key, row.dataset, row.reason]
      );
    }

    for (const row of geographyAliases) {
      await client.query(
        `
          insert into semantic.geography_alias (
            alias, normalized_alias, language_code, geography_type, geography_name, geography_code, priority, metadata_origin
          )
          values ($1, $2, 'nl', $3, $4, $5, 10, 'curated')
          on conflict (normalized_alias, language_code, geography_type, geography_name) do update set
            alias = excluded.alias,
            geography_code = excluded.geography_code,
            priority = excluded.priority,
            updated_at = now()
        `,
        [row.alias, normalize(row.alias), row.type, row.name, row.code]
      );
    }

    if (options.skipGrains) {
      console.log("Skipped generated semantic.metric_grain refresh.");
    } else {
      await upsertMetricGrains(client);
    }

    for (const row of goldenQuestions) {
      await client.query(
        `
          insert into semantic.golden_question (
            question, domain_id, expected_intent, expected_calculation_code, expected_measure_label,
            expected_secondary_measure_label, expected_geography_names, expected_geography_type,
            expected_year, expected_year_start, expected_year_end, expected_result_shape, metadata_origin, is_active
          )
          values ($1, 'bouwen-en-wonen', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'curated', true)
          on conflict (question) do update set
            expected_intent = excluded.expected_intent,
            expected_calculation_code = excluded.expected_calculation_code,
            expected_measure_label = excluded.expected_measure_label,
            expected_secondary_measure_label = excluded.expected_secondary_measure_label,
            expected_geography_names = excluded.expected_geography_names,
            expected_geography_type = excluded.expected_geography_type,
            expected_year = excluded.expected_year,
            expected_year_start = excluded.expected_year_start,
            expected_year_end = excluded.expected_year_end,
            expected_result_shape = excluded.expected_result_shape,
            is_active = true,
            updated_at = now()
        `,
        [
          row.question,
          row.intent,
          row.calculation,
          row.measure,
          row.secondary ?? null,
          row.geographies ?? [],
          row.geographyType ?? null,
          row.year ?? null,
          row.yearStart ?? null,
          row.yearEnd ?? null,
          JSON.stringify(row.shape ?? {}),
        ]
      );
    }

    console.log("Loaded semantic curation seed rows.");
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
