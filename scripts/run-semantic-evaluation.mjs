#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPostgresClient, explainPostgresConnectionError, loadLocalEnv } from "./lib/runtime.mjs";

const DEFAULT_SUITE = {
  suite_code: "gold_capability_smoke",
  suite_name: "Gold capability smoke tests",
  description: "Deterministic execution checks for curated semantic contracts and Gold mart capability.",
  domain_id: null,
};

const CROSS_DOMAIN_SUITE = {
  suite_code: "cross_domain_gold_smoke",
  suite_name: "Cross-domain Gold smoke tests",
  description: "Deterministic execution checks for questions that combine Bouwen en wonen with Inkomen en bestedingen Gold marts.",
  domain_id: "cross-domain",
};

const DEFAULT_CASES = [
  {
    case_code: "income_arrears_municipality_rank_2024",
    question: "Waar zijn de meeste betalingsachterstanden zorgpremie in 2024?",
    domain_id: "inkomen-en-bestedingen",
    expected_intent: "rank_geographies",
    expected_metric_code: "health_insurance_payment_arrears_share",
    expected_dataset_code: "81064ned",
    expected_source: "gold_inkomen_bestedingen",
    expected_geography_type: "municipality",
    expected_grain: "municipality_year",
    expected_year: 2024,
    should_execute: true,
    minimum_rows: 5,
  },
  {
    case_code: "income_consumer_confidence_province_2025",
    question: "Welke provincie had het hoogste consumentenvertrouwen in 2025?",
    domain_id: "inkomen-en-bestedingen",
    expected_intent: "rank_geographies",
    expected_metric_code: "consumer_confidence",
    expected_dataset_code: "83978NED",
    expected_source: "gold_inkomen_bestedingen",
    expected_geography_type: "province",
    expected_grain: "province_year",
    expected_year: 2025,
    should_execute: true,
    minimum_rows: 5,
  },
  {
    case_code: "income_household_income_national_only",
    question: "Welke gemeente heeft het hoogste gemiddelde huishoudinkomen in 2024?",
    domain_id: "inkomen-en-bestedingen",
    expected_intent: "rank_geographies",
    expected_metric_code: "average_household_income",
    expected_dataset_code: "83932NED",
    expected_source: "gold_inkomen_bestedingen",
    expected_geography_type: "municipality",
    expected_grain: "municipality_year",
    expected_year: 2024,
    should_execute: false,
    expected_no_execute_reason: "unsupported_grain",
  },
  {
    case_code: "housing_woz_municipality_rank_2023",
    question: "Welke gemeenten hebben de hoogste gemiddelde WOZ-waarde in 2023?",
    domain_id: "bouwen-en-wonen",
    expected_intent: "rank_geographies",
    expected_metric_code: "average_woz_home_value",
    expected_dataset_code: "85036NED",
    expected_source: "gold_bouwen_wonen",
    expected_geography_type: "municipality",
    expected_grain: "municipality_year",
    expected_year: 2023,
    should_execute: true,
    minimum_rows: 5,
  },
  {
    case_code: "cross_domain_woz_arrears_municipality_2024",
    question: "Vergelijk gemiddelde WOZ-waarde met betalingsachterstanden zorgpremie per gemeente in 2024.",
    domain_id: "cross-domain",
    expected_intent: "compare_geographies",
    expected_source: "cross_domain_gold",
    expected_geography_type: "municipality",
    expected_grain: "municipality_year",
    expected_year: 2024,
    expected_component_metrics: [
      { metric_code: "average_woz_home_value", domain_id: "bouwen-en-wonen" },
      { metric_code: "health_insurance_payment_arrears_share", domain_id: "inkomen-en-bestedingen" },
    ],
    should_execute: true,
    minimum_rows: 5,
  },
  {
    case_code: "housing_corner_homes_region_rank_latest",
    question: "Waar staan de meeste hoekwoningen?",
    domain_id: "bouwen-en-wonen",
    expected_intent: "rank_geographies",
    expected_metric_code: "corner_homes",
    expected_dataset_code: "85035NED",
    expected_source: "gold_bouwen_wonen",
    expected_geography_type: "region",
    expected_grain: "region_year",
    should_execute: true,
    minimum_rows: 5,
  },
];

const CROSS_DOMAIN_CASES = [
  {
    case_code: "cross_woz_arrears_municipality_2024",
    question: "Welke gemeenten combineren een hoge gemiddelde WOZ-waarde met veel betalingsachterstanden zorgpremie in 2024?",
    expected_geography_type: "municipality",
    expected_grain: "municipality_year",
    expected_year: 2024,
    expected_component_metrics: [
      { metric_code: "average_woz_home_value", domain_id: "bouwen-en-wonen" },
      { metric_code: "health_insurance_payment_arrears_share", domain_id: "inkomen-en-bestedingen" },
    ],
  },
  {
    case_code: "cross_rental_homes_arrears_municipality_2024",
    question: "Vergelijk het aantal huurwoningen met betalingsachterstanden zorgpremie per gemeente in 2024.",
    expected_geography_type: "municipality",
    expected_grain: "municipality_year",
    expected_year: 2024,
    expected_component_metrics: [
      { metric_code: "total_rental_homes", domain_id: "bouwen-en-wonen" },
      { metric_code: "health_insurance_payment_arrears_share", domain_id: "inkomen-en-bestedingen" },
    ],
  },
  {
    case_code: "cross_new_construction_arrears_municipality_2024",
    question: "Waar valt veel nieuwbouw samen met veel betalingsachterstanden zorgpremie in 2024?",
    expected_geography_type: "municipality",
    expected_grain: "municipality_year",
    expected_year: 2024,
    expected_component_metrics: [
      { metric_code: "new_construction", domain_id: "bouwen-en-wonen" },
      { metric_code: "health_insurance_payment_arrears_share", domain_id: "inkomen-en-bestedingen" },
    ],
  },
  {
    case_code: "cross_demolished_arrears_municipality_2024",
    question: "Welke gemeenten hebben veel gesloopte woningen en veel betalingsachterstanden zorgpremie in 2024?",
    expected_geography_type: "municipality",
    expected_grain: "municipality_year",
    expected_year: 2024,
    expected_component_metrics: [
      { metric_code: "demolished_dwellings", domain_id: "bouwen-en-wonen" },
      { metric_code: "health_insurance_payment_arrears_share", domain_id: "inkomen-en-bestedingen" },
    ],
  },
  {
    case_code: "cross_housing_stock_arrears_municipality_2024",
    question: "Vergelijk de beginstand woningvoorraad met betalingsachterstanden zorgpremie per gemeente in 2024.",
    expected_geography_type: "municipality",
    expected_grain: "municipality_year",
    expected_year: 2024,
    expected_component_metrics: [
      { metric_code: "housing_stock_start", domain_id: "bouwen-en-wonen" },
      { metric_code: "health_insurance_payment_arrears_share", domain_id: "inkomen-en-bestedingen" },
    ],
  },
  {
    case_code: "cross_home_satisfaction_arrears_municipality_2024",
    question: "Waar is woontevredenheid hoog maar zijn er ook veel betalingsachterstanden zorgpremie in 2024?",
    expected_geography_type: "municipality",
    expected_grain: "municipality_year",
    expected_year: 2024,
    expected_component_metrics: [
      { metric_code: "current_home_satisfaction", domain_id: "bouwen-en-wonen" },
      { metric_code: "health_insurance_payment_arrears_share", domain_id: "inkomen-en-bestedingen" },
    ],
  },
  {
    case_code: "cross_physical_additions_arrears_municipality_2024",
    question: "Welke gemeenten hebben veel fysieke toevoegingen aan de woningvoorraad en veel betalingsachterstanden zorgpremie in 2024?",
    expected_geography_type: "municipality",
    expected_grain: "municipality_year",
    expected_year: 2024,
    expected_component_metrics: [
      { metric_code: "physical_housing_additions", domain_id: "bouwen-en-wonen" },
      { metric_code: "health_insurance_payment_arrears_share", domain_id: "inkomen-en-bestedingen" },
    ],
  },
  {
    case_code: "cross_physical_withdrawals_arrears_municipality_2024",
    question: "Waar vallen fysieke onttrekkingen aan de woningvoorraad samen met betalingsachterstanden zorgpremie in 2024?",
    expected_geography_type: "municipality",
    expected_grain: "municipality_year",
    expected_year: 2024,
    expected_component_metrics: [
      { metric_code: "physical_housing_withdrawals", domain_id: "bouwen-en-wonen" },
      { metric_code: "health_insurance_payment_arrears_share", domain_id: "inkomen-en-bestedingen" },
    ],
  },
  {
    case_code: "cross_transformations_arrears_municipality_2024",
    question: "Vergelijk woningtransformaties met betalingsachterstanden zorgpremie per gemeente in 2024.",
    expected_geography_type: "municipality",
    expected_grain: "municipality_year",
    expected_year: 2024,
    expected_component_metrics: [
      { metric_code: "housing_transformations", domain_id: "bouwen-en-wonen" },
      { metric_code: "health_insurance_payment_arrears_share", domain_id: "inkomen-en-bestedingen" },
    ],
  },
  {
    case_code: "cross_splits_arrears_municipality_2024",
    question: "Welke gemeenten hebben veel woningsplitsingen en veel betalingsachterstanden zorgpremie in 2024?",
    expected_geography_type: "municipality",
    expected_grain: "municipality_year",
    expected_year: 2024,
    expected_component_metrics: [
      { metric_code: "housing_splits", domain_id: "bouwen-en-wonen" },
      { metric_code: "health_insurance_payment_arrears_share", domain_id: "inkomen-en-bestedingen" },
    ],
  },
  {
    case_code: "cross_mergers_arrears_municipality_2024",
    question: "Welke gemeenten hebben veel woningsamenvoegingen en veel betalingsachterstanden zorgpremie in 2024?",
    expected_geography_type: "municipality",
    expected_grain: "municipality_year",
    expected_year: 2024,
    expected_component_metrics: [
      { metric_code: "housing_mergers", domain_id: "bouwen-en-wonen" },
      { metric_code: "health_insurance_payment_arrears_share", domain_id: "inkomen-en-bestedingen" },
    ],
  },
  {
    case_code: "cross_stock_balance_arrears_municipality_2024",
    question: "Vergelijk het saldo woningvoorraad met betalingsachterstanden zorgpremie per gemeente in 2024.",
    expected_geography_type: "municipality",
    expected_grain: "municipality_year",
    expected_year: 2024,
    expected_component_metrics: [
      { metric_code: "housing_stock_balance", domain_id: "bouwen-en-wonen" },
      { metric_code: "health_insurance_payment_arrears_share", domain_id: "inkomen-en-bestedingen" },
    ],
  },
  {
    case_code: "cross_rent_increase_arrears_municipality_2024",
    question: "Waar zijn huurverhogingen hoog en betalingsachterstanden zorgpremie ook hoog in 2024?",
    expected_geography_type: "municipality",
    expected_grain: "municipality_year",
    expected_year: 2024,
    expected_component_metrics: [
      { metric_code: "rent_increase_including_harmonisation", domain_id: "bouwen-en-wonen" },
      { metric_code: "health_insurance_payment_arrears_share", domain_id: "inkomen-en-bestedingen" },
    ],
    minimum_rows: 4,
  },
  {
    case_code: "cross_woz_consumer_confidence_province_2024",
    question: "Vergelijk gemiddelde WOZ-waarde met consumentenvertrouwen per provincie in 2024.",
    expected_geography_type: "province",
    expected_grain: "province_year",
    expected_year: 2024,
    expected_component_metrics: [
      { metric_code: "average_woz_home_value", domain_id: "bouwen-en-wonen" },
      { metric_code: "consumer_confidence", domain_id: "inkomen-en-bestedingen" },
    ],
  },
  {
    case_code: "cross_new_construction_consumer_confidence_province_2024",
    question: "Welke provincies combineren veel nieuwbouw met hoog consumentenvertrouwen in 2024?",
    expected_geography_type: "province",
    expected_grain: "province_year",
    expected_year: 2024,
    expected_component_metrics: [
      { metric_code: "new_construction", domain_id: "bouwen-en-wonen" },
      { metric_code: "consumer_confidence", domain_id: "inkomen-en-bestedingen" },
    ],
  },
  {
    case_code: "cross_demolished_consumer_confidence_province_2024",
    question: "Vergelijk gesloopte woningen met consumentenvertrouwen per provincie in 2024.",
    expected_geography_type: "province",
    expected_grain: "province_year",
    expected_year: 2024,
    expected_component_metrics: [
      { metric_code: "demolished_dwellings", domain_id: "bouwen-en-wonen" },
      { metric_code: "consumer_confidence", domain_id: "inkomen-en-bestedingen" },
    ],
  },
  {
    case_code: "cross_housing_stock_consumer_confidence_province_2024",
    question: "Vergelijk de woningvoorraad met consumentenvertrouwen per provincie in 2024.",
    expected_geography_type: "province",
    expected_grain: "province_year",
    expected_year: 2024,
    expected_component_metrics: [
      { metric_code: "housing_stock_start", domain_id: "bouwen-en-wonen" },
      { metric_code: "consumer_confidence", domain_id: "inkomen-en-bestedingen" },
    ],
  },
  {
    case_code: "cross_rental_homes_consumer_confidence_province_2024",
    question: "Vergelijk huurwoningen met consumentenvertrouwen per provincie in 2024.",
    expected_geography_type: "province",
    expected_grain: "province_year",
    expected_year: 2024,
    expected_component_metrics: [
      { metric_code: "total_rental_homes", domain_id: "bouwen-en-wonen" },
      { metric_code: "consumer_confidence", domain_id: "inkomen-en-bestedingen" },
    ],
  },
  {
    case_code: "cross_home_satisfaction_consumer_confidence_province_2024",
    question: "Welke provincies combineren hoge woontevredenheid met hoog consumentenvertrouwen in 2024?",
    expected_geography_type: "province",
    expected_grain: "province_year",
    expected_year: 2024,
    expected_component_metrics: [
      { metric_code: "current_home_satisfaction", domain_id: "bouwen-en-wonen" },
      { metric_code: "consumer_confidence", domain_id: "inkomen-en-bestedingen" },
    ],
  },
  {
    case_code: "cross_physical_additions_consumer_confidence_province_2024",
    question: "Vergelijk fysieke toevoegingen aan de woningvoorraad met consumentenvertrouwen per provincie in 2024.",
    expected_geography_type: "province",
    expected_grain: "province_year",
    expected_year: 2024,
    expected_component_metrics: [
      { metric_code: "physical_housing_additions", domain_id: "bouwen-en-wonen" },
      { metric_code: "consumer_confidence", domain_id: "inkomen-en-bestedingen" },
    ],
  },
].map((testCase) => ({
  domain_id: "cross-domain",
  expected_intent: "compare_geographies",
  expected_source: "cross_domain_gold",
  should_execute: true,
  minimum_rows: 5,
  ...testCase,
}));

function parseArgs(argv) {
  const options = { ensureSchema: false, seedDefaults: false, suite: DEFAULT_SUITE.suite_code, domain: "", caseCode: "", statementTimeoutMs: 300000 };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--ensure-schema") options.ensureSchema = true;
    else if (arg === "--seed-defaults") options.seedDefaults = true;
    else if (arg === "--suite") options.suite = argv[++index] ?? options.suite;
    else if (arg === "--domain") options.domain = argv[++index] ?? "";
    else if (arg === "--case") options.caseCode = argv[++index] ?? "";
    else if (arg === "--statement-timeout-ms") options.statementTimeoutMs = Number(argv[++index] ?? options.statementTimeoutMs);
    else if (arg === "--help") {
      console.log(`Usage:
  npm run test:semantic:evaluation -- --ensure-schema --seed-defaults
  npm run test:semantic:evaluation -- --suite gold_capability_smoke
  npm run test:semantic:evaluation -- --domain inkomen-en-bestedingen

Options:
  --ensure-schema                 Apply supabase/gold_capability_registry_schema.sql first.
  --seed-defaults                 Upsert the starter evaluation suite and cases.
  --suite <suite_code>            Evaluation suite to run.
  --domain <domain_id>            Limit cases by domain.
  --case <case_code>              Run one case.
  --statement-timeout-ms 300000   Postgres statement timeout.
`);
      process.exit(0);
    }
  }
  return options;
}

async function ensureSchema(client) {
  await client.query(readFileSync(resolve(process.cwd(), "supabase/gold_capability_registry_schema.sql"), "utf8"));
}

async function seedDefaults(client) {
  const suites = [
    { suite: DEFAULT_SUITE, cases: DEFAULT_CASES },
    { suite: CROSS_DOMAIN_SUITE, cases: CROSS_DOMAIN_CASES },
  ];

  for (const { suite, cases } of suites) {
    await client.query(
      `
        insert into semantic.semantic_evaluation_suite (suite_code, suite_name, description, domain_id, metadata, is_active)
        values ($1, $2, $3, $4, $5::jsonb, true)
        on conflict (suite_code) do update set
          suite_name = excluded.suite_name,
          description = excluded.description,
          domain_id = excluded.domain_id,
          metadata = excluded.metadata,
          is_active = true,
          updated_at = now()
      `,
      [suite.suite_code, suite.suite_name, suite.description, suite.domain_id, JSON.stringify({ metadata_origin: "curated_seed" })]
    );

    for (const testCase of cases) {
      await client.query(
        `
          insert into semantic.semantic_evaluation_case (
            suite_code, case_code, question, language_code, domain_id, expected_intent,
            expected_metric_code, expected_dataset_code, expected_source, expected_geography_type,
            expected_grain, expected_year, expected_year_start, expected_year_end,
            expected_category_filters, expected_component_metrics, should_execute, minimum_rows, expected_no_execute_reason,
            metadata, is_active
          )
          values ($1, $2, $3, 'nl', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16, $17, $18, $19::jsonb, true)
          on conflict (case_code) do update set
            suite_code = excluded.suite_code,
            question = excluded.question,
            domain_id = excluded.domain_id,
            expected_intent = excluded.expected_intent,
            expected_metric_code = excluded.expected_metric_code,
            expected_dataset_code = excluded.expected_dataset_code,
            expected_source = excluded.expected_source,
            expected_geography_type = excluded.expected_geography_type,
            expected_grain = excluded.expected_grain,
            expected_year = excluded.expected_year,
            expected_year_start = excluded.expected_year_start,
            expected_year_end = excluded.expected_year_end,
            expected_category_filters = excluded.expected_category_filters,
            expected_component_metrics = excluded.expected_component_metrics,
            should_execute = excluded.should_execute,
            minimum_rows = excluded.minimum_rows,
            expected_no_execute_reason = excluded.expected_no_execute_reason,
            metadata = excluded.metadata,
            is_active = true,
            updated_at = now()
        `,
        [
          suite.suite_code,
          testCase.case_code,
          testCase.question,
          testCase.domain_id,
          testCase.expected_intent,
          testCase.expected_metric_code ?? null,
          testCase.expected_dataset_code ?? null,
          testCase.expected_source ?? null,
          testCase.expected_geography_type ?? null,
          testCase.expected_grain ?? null,
          testCase.expected_year ?? null,
          testCase.expected_year_start ?? null,
          testCase.expected_year_end ?? null,
          JSON.stringify(testCase.expected_category_filters ?? {}),
          JSON.stringify(testCase.expected_component_metrics ?? []),
          testCase.should_execute,
          testCase.minimum_rows ?? 1,
          testCase.expected_no_execute_reason ?? null,
          JSON.stringify({ metadata_origin: "curated_seed" }),
        ]
      );
    }

    console.log(`Seeded semantic evaluation suite "${suite.suite_code}" with ${cases.length} case(s).`);
  }
}

async function createRun(client, options) {
  const { rows } = await client.query(
    `
      insert into semantic.semantic_evaluation_run (suite_code, domain_id, status, metadata)
      values ($1, $2, 'running', $3::jsonb)
      returning evaluation_run_id
    `,
    [options.suite, options.domain || null, JSON.stringify({ runner: "scripts/run-semantic-evaluation.mjs" })]
  );
  return rows[0].evaluation_run_id;
}

async function finishRun(client, runId, status, counts = {}, errorMessage = null) {
  await client.query(
    `
      update semantic.semantic_evaluation_run
      set status = $2,
          finished_at = now(),
          total_cases = coalesce($3, total_cases),
          passed_cases = coalesce($4, passed_cases),
          failed_cases = coalesce($5, failed_cases),
          skipped_cases = coalesce($6, skipped_cases),
          error_message = $7
      where evaluation_run_id = $1
    `,
    [runId, status, counts.total ?? null, counts.passed ?? null, counts.failed ?? null, counts.skipped ?? null, errorMessage]
  );
}

async function casesToRun(client, options) {
  const { rows } = await client.query(
    `
      select *
      from semantic.semantic_evaluation_case
      where is_active
        and suite_code = $1
        and ($2::text is null or domain_id = $2)
        and ($3::text is null or case_code = $3)
      order by domain_id, case_code
    `,
    [options.suite, options.domain || null, options.caseCode || null]
  );
  return rows;
}

function sourceForDomain(domainId) {
  if (domainId === "cross-domain") return "cross_domain_gold";
  if (domainId === "inkomen-en-bestedingen") return "gold_inkomen_bestedingen";
  if (domainId === "bouwen-en-wonen") return "gold_bouwen_wonen";
  return "semantic_catalogue";
}

async function buildPlan(client, testCase) {
  const componentSpecs = Array.isArray(testCase.expected_component_metrics) ? testCase.expected_component_metrics : [];
  if (componentSpecs.length >= 2) {
    const components = [];
    for (const spec of componentSpecs) {
      const { rows } = await client.query(
        `
          select *
          from semantic.metric_contract
          where metric_code = $1
            and domain_id = $2
            and is_active
          limit 1
        `,
        [spec.metric_code, spec.domain_id]
      );
      const contract = rows[0];
      if (!contract) continue;
      components.push({
        metric_code: contract.metric_code,
        measure_key: String(contract.measure_key),
        dataset_code: contract.dataset_codes?.[0],
        source: sourceForDomain(contract.domain_id),
        label: contract.label,
        domain_id: contract.domain_id,
        unit_code: contract.unit_code,
        category_filters: contract.category_filters ?? {},
      });
    }
    return {
      contract: null,
      plan: {
        intent: testCase.expected_intent,
        source: "cross_domain_gold",
        calculation_code: "cross_domain_comparison",
        component_measures: components,
        metric_code: components.map((component) => component.metric_code).join("+"),
        measure_label: components.map((component) => component.label).join(" + "),
        dataset_code: components.map((component) => component.dataset_code).join(","),
        geography_type: testCase.expected_geography_type,
        period_type: "year",
        year: testCase.expected_year ?? undefined,
        year_start: testCase.expected_year_start ?? undefined,
        year_end: testCase.expected_year_end ?? undefined,
        grain: testCase.expected_grain
          ? {
            geography_type: testCase.expected_geography_type,
            period_type: "year",
            display_grain: testCase.expected_grain,
          }
          : undefined,
        limit: 10,
      },
    };
  }

  const { rows } = await client.query(
    `
      select *
      from semantic.metric_contract
      where metric_code = $1
        and domain_id = $2
        and is_active
      limit 1
    `,
    [testCase.expected_metric_code, testCase.domain_id]
  );
  const contract = rows[0] ?? null;
  const expectedSource = testCase.expected_source ?? sourceForDomain(testCase.domain_id);
  const plan = {
    intent: testCase.expected_intent,
    source: expectedSource,
    measure_key: contract?.measure_key == null ? undefined : String(contract.measure_key),
    metric_code: testCase.expected_metric_code,
    measure_label: contract?.label ?? testCase.expected_metric_code,
    dataset_code: testCase.expected_dataset_code ?? contract?.dataset_codes?.[0],
    geography_type: testCase.expected_geography_type,
    period_type: "year",
    year: testCase.expected_year ?? undefined,
    year_start: testCase.expected_year_start ?? undefined,
    year_end: testCase.expected_year_end ?? undefined,
    grain: testCase.expected_grain
      ? {
        geography_type: testCase.expected_geography_type,
        period_type: "year",
        display_grain: testCase.expected_grain,
      }
      : undefined,
    category_filters: testCase.expected_category_filters ?? {},
    limit: 10,
    sort_direction: "desc",
  };
  return { contract, plan };
}

async function evaluateCase(client, runId, testCase) {
  const checks = {};
  const { contract, plan } = await buildPlan(client, testCase);
  checks.contract_found = Boolean(contract);
  if (testCase.expected_source === "cross_domain_gold") checks.contract_found = (plan.component_measures?.length ?? 0) >= 2;
  checks.source_matches = !testCase.expected_source || plan.source === testCase.expected_source;
  checks.dataset_matches = !testCase.expected_dataset_code || plan.dataset_code === testCase.expected_dataset_code;
  checks.grain_declared = !testCase.expected_grain || plan.grain?.display_grain === testCase.expected_grain;
  checks.contract_supports_grain = testCase.expected_source === "cross_domain_gold"
    ? (plan.component_measures?.length ?? 0) >= 2
    : !testCase.expected_grain || Boolean(contract?.valid_grains?.includes(testCase.expected_grain));

  let availability = {};
  let execution = {};
  let errorMessage = null;
  try {
    if (contract?.measure_key != null || plan.component_measures?.length) {
      const availabilityResult = await client.query("select public.guara_check_query_availability($1::jsonb) as result", [JSON.stringify(plan)]);
      availability = availabilityResult.rows[0]?.result ?? {};
      checks.availability_checked = true;
      checks.metric_available = availability.metric_available === true;
      checks.grain_available = availability.grain_available === true;
      checks.period_available = availability.period_available === true;

      if (testCase.should_execute) {
        const executionResult = await client.query("select public.guara_execute_query_plan($1::jsonb) as result", [JSON.stringify(plan)]);
        execution = executionResult.rows[0]?.result ?? {};
      }
    }
  } catch (error) {
    errorMessage = error.message;
  }

  const resultRows = Array.isArray(execution.rows) ? execution.rows : [];
  const relationshipAnalysis = execution.analysis && typeof execution.analysis === "object" && !Array.isArray(execution.analysis)
    ? execution.analysis
    : {};
  if (testCase.expected_source === "cross_domain_gold" && testCase.should_execute) {
    checks.relationship_analysis_present = relationshipAnalysis.analysis_type === "cross_domain_relationship";
    checks.relationship_type_is_association = relationshipAnalysis.relationship_type === "association";
    checks.causality_not_established = relationshipAnalysis.causality_status === "not_established";
    checks.relationship_has_sample_size = Number(relationshipAnalysis.observation_count ?? 0) >= Number(testCase.minimum_rows ?? 1);
  }
  checks.minimum_rows_met = !testCase.should_execute || resultRows.length >= Number(testCase.minimum_rows ?? 1);
  checks.no_execute_expected = testCase.should_execute === false;

  const failures = [];
  if (!checks.contract_found) failures.push("contract_not_found");
  if (!checks.source_matches) failures.push("source_mismatch");
  if (!checks.dataset_matches) failures.push("dataset_mismatch");
  if (!checks.grain_declared) failures.push("grain_not_declared");
  if (testCase.should_execute && !checks.contract_supports_grain) failures.push("contract_does_not_support_expected_grain");
  if (testCase.should_execute && availability.metric_available !== true) failures.push("metric_not_available");
  if (testCase.should_execute && availability.grain_available !== true) failures.push("grain_not_available");
  if (testCase.should_execute && availability.period_available !== true) failures.push("period_not_available");
  if (testCase.should_execute && !checks.minimum_rows_met) failures.push("too_few_rows");
  if (testCase.expected_source === "cross_domain_gold" && testCase.should_execute && !checks.relationship_analysis_present) failures.push("relationship_analysis_missing");
  if (testCase.expected_source === "cross_domain_gold" && testCase.should_execute && !checks.relationship_type_is_association) failures.push("relationship_type_not_association");
  if (testCase.expected_source === "cross_domain_gold" && testCase.should_execute && !checks.causality_not_established) failures.push("causality_status_not_safe");
  if (testCase.expected_source === "cross_domain_gold" && testCase.should_execute && !checks.relationship_has_sample_size) failures.push("relationship_sample_too_small");
  if (!testCase.should_execute && availability.grain_available === true && availability.period_available === true) failures.push("unexpectedly_executable");
  if (errorMessage) failures.push("execution_error");

  checks.failures = failures;
  const status = failures.length ? "failed" : "passed";

  await client.query(
    `
      insert into semantic.semantic_evaluation_result (
        evaluation_run_id, evaluation_case_id, case_code, question, status, checks,
        query_plan, availability_result, execution_result, error_message
      )
      values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10)
    `,
    [
      runId,
      testCase.evaluation_case_id,
      testCase.case_code,
      testCase.question,
      status,
      JSON.stringify(checks),
      JSON.stringify(plan),
      JSON.stringify(availability),
      JSON.stringify(execution),
      errorMessage,
    ]
  );

  return { status, checks, rows: resultRows.length };
}

async function main() {
  const options = parseArgs(process.argv);
  loadLocalEnv();
  const client = createPostgresClient({
    applicationName: "guara-semantic-evaluation-runner",
    statementTimeoutMs: options.statementTimeoutMs,
    queryTimeoutMs: options.statementTimeoutMs,
  });
  let runId = null;
  try {
    await client.connect();
    if (options.ensureSchema) await ensureSchema(client);
    if (options.seedDefaults) await seedDefaults(client);

    const tests = await casesToRun(client, options);
    runId = await createRun(client, options);
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    for (const testCase of tests) {
      const result = await evaluateCase(client, runId, testCase);
      if (result.status === "passed") passed += 1;
      else if (result.status === "failed") failed += 1;
      else skipped += 1;
      console.log(`${result.status.toUpperCase()} ${testCase.case_code}${result.rows ? ` (${result.rows} row(s))` : ""}`);
      if (result.checks.failures?.length) console.log(`  ${result.checks.failures.join(", ")}`);
    }

    await finishRun(client, runId, failed ? "failed" : "passed", { total: tests.length, passed, failed, skipped });
    console.log(`Semantic evaluation complete: ${passed}/${tests.length} passed, ${failed} failed, ${skipped} skipped.`);
    if (failed) process.exitCode = 1;
  } catch (error) {
    if (runId) {
      try {
        await finishRun(client, runId, "failed", {}, error.message);
      } catch {
        // Preserve the original failure.
      }
    }
    console.error(explainPostgresConnectionError(error));
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
