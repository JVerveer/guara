#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPostgresClient, explainPostgresConnectionError, loadLocalEnv, normalizeKey } from "./lib/runtime.mjs";

const DOMAIN_SOURCES = {
  "bouwen-en-wonen": "gold_bouwen_wonen",
  "inkomen-en-bestedingen": "gold_inkomen_bestedingen",
};

function parseArgs(argv) {
  const options = {
    ensureSchema: false,
    domain: "",
    dataset: "",
    limit: 0,
    statementTimeoutMs: 600000,
    includeEmpty: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--ensure-schema") options.ensureSchema = true;
    else if (arg === "--domain") options.domain = argv[++index] ?? "";
    else if (arg === "--dataset") options.dataset = String(argv[++index] ?? "").toUpperCase();
    else if (arg === "--limit") options.limit = Number(argv[++index] ?? 0);
    else if (arg === "--statement-timeout-ms") options.statementTimeoutMs = Number(argv[++index] ?? options.statementTimeoutMs);
    else if (arg === "--include-empty") options.includeEmpty = true;
    else if (arg === "--help") {
      console.log(`Usage:
  npm run load:semantic:review-queue -- --ensure-schema --domain inkomen-en-bestedingen
  npm run load:semantic:review-queue -- --domain bouwen-en-wonen --dataset 85035NED

Options:
  --ensure-schema                 Apply semantic workbench schema first.
  --domain <domain_id>            Limit to one Guara domain.
  --dataset <CBS code>            Limit to one dataset code.
  --limit <n>                     Limit profiled measures.
  --include-empty                 Include measures without populated facts.
  --statement-timeout-ms 600000   Postgres statement timeout.
`);
      process.exit(0);
    }
  }

  return options;
}

function slug(value, fallback = "metric") {
  const normalized = normalizeKey(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return normalized || fallback;
}

function hashCode(value) {
  let hash = 5381;
  for (const char of String(value)) hash = (hash * 33) ^ char.charCodeAt(0);
  return (hash >>> 0).toString(36).slice(0, 6);
}

function generatedMetricCode(capability) {
  const dataset = String(capability.dataset_code ?? "dataset").toLowerCase();
  const measure = slug(capability.measure_code || capability.measure_name || capability.measure_key);
  const suffix = hashCode(`${capability.domain_id}:${capability.dataset_code}:${capability.measure_key}`);
  return `gen_${dataset}_${measure}_${suffix}`;
}

function normalizeGrain(grain) {
  if (grain === "country_year") return "national_year";
  return grain;
}

function selectDefaultGrain(grains) {
  for (const grain of ["municipality_year", "province_year", "region_year", "national_year"]) {
    if (grains.includes(grain)) return grain;
  }
  return grains[0] ?? null;
}

function safeAggregation(capability) {
  const name = normalizeKey(capability.measure_name);
  const unit = normalizeKey(capability.unit_code || capability.unit_name || capability.unit_category);
  const configured = normalizeKey(capability.default_aggregation);

  if (configured && configured !== "none" && configured !== "unknown") return configured;
  if (name.includes("mediaan") || name.includes("median")) return "median";
  if (name.includes("gemiddeld") || name.includes("average") || unit.includes("percent") || unit.includes("percentage")) return "average";
  if (capability.is_additive === true) return "sum";
  if (unit.includes("count") || unit.includes("aantal") || unit.includes("personen") || unit.includes("woningen")) return "sum";
  return "none";
}

function makeSynonyms(label, measureCode) {
  const synonyms = Array.from(
    new Set(
      [label, measureCode, label?.replace(/\s+/g, " "), label?.replace(/-/g, " ")]
        .filter(Boolean)
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  );
  return { nl: synonyms, en: [] };
}

function summarizeDiagnostics(diagnostics) {
  const blocking = diagnostics.filter((item) => item.isBlocking);
  const warnings = diagnostics.filter((item) => item.severity === "warning");
  return {
    blocking_count: blocking.length,
    warning_count: warnings.length,
    blocking_codes: blocking.map((item) => item.code),
    warning_codes: warnings.map((item) => item.code),
  };
}

function diagnose(capability, contract, duplicateLabelCount) {
  const diagnostics = [];
  const add = (code, severity, message, isBlocking = false, metadata = {}) => {
    diagnostics.push({ code, severity, message, isBlocking, metadata });
  };

  if (!capability.dataset_code) add("missing_dataset_code", "error", "The Gold capability has no dataset code.", true);
  if (!capability.measure_key) add("missing_measure_key", "error", "The Gold capability has no measure key.", true);
  if (!contract.unit_code || contract.unit_code === "UNKNOWN") add("missing_unit_code", "error", "The measure has no unit code.", true);
  if (contract.aggregation === "none") {
    add("unsafe_aggregation", "error", "No safe aggregation behavior could be inferred.", true);
  }
  if (!contract.valid_grains.length) add("missing_grains", "error", "No supported analytical grain was found.", true);
  if (!contract.default_grain) add("missing_default_grain", "error", "No default grain could be selected.", true);
  if (Number(capability.populated_fact_rows ?? 0) <= 0) {
    add("no_populated_facts", "error", "The measure has no populated Gold values.", true);
  }
  if (duplicateLabelCount > 1) {
    add("duplicate_label", "warning", "Multiple measures share this label in the same domain.", false, { duplicate_label_count: duplicateLabelCount });
  }
  if (capability.is_non_additive === true || ["average", "median"].includes(contract.aggregation)) {
    add("non_additive_metric", "warning", "This metric is non-additive and cannot be summed across collapsed dimensions.", false);
  }
  if (!contract.valid_grains.includes("municipality_year")) {
    add("not_municipality_ready", "warning", "This metric is not available at municipality-year grain.", false);
  }
  if (!contract.synonyms.nl || contract.synonyms.nl.length < 2) {
    add("thin_synonyms", "warning", "Only source-backed label synonyms are available.", false);
  }

  return diagnostics;
}

function reviewState(capability, diagnostics) {
  const hasBlocking = diagnostics.some((item) => item.isBlocking);
  if (hasBlocking) return { reviewStatus: "needs_fix", recommendation: "keep_disabled", risk: "high", priority: 900 };
  if (capability.executable_candidate === true) {
    const warningCount = diagnostics.filter((item) => item.severity === "warning").length;
    return {
      reviewStatus: "review_candidate",
      recommendation: "human_review_then_enable",
      risk: warningCount > 0 ? "medium" : "low",
      priority: warningCount > 0 ? 220 : 120,
    };
  }
  return { reviewStatus: "profiled", recommendation: "keep_disabled", risk: "medium", priority: 500 };
}

function testCasesFor(contract, sourceName, capability) {
  const latestYear = capability.max_year ?? null;
  const earliestYear = capability.min_year ?? null;
  const cases = [];
  if (contract.supports.ranking && latestYear) {
    cases.push({
      question: `Waar is ${contract.label} het hoogst in ${latestYear}?`,
      expected_intent: "rank_geographies",
      expected_year: latestYear,
    });
  }
  if (contract.supports.comparison && latestYear) {
    cases.push({
      question: `Vergelijk ${contract.label} per ${contract.default_grain?.replace("_year", "") ?? "gebied"} in ${latestYear}.`,
      expected_intent: "compare_geographies",
      expected_year: latestYear,
    });
  }
  if (contract.supports.trend && earliestYear) {
    cases.push({
      question: `Hoe ontwikkelde ${contract.label} zich sinds ${earliestYear}?`,
      expected_intent: "trend",
      expected_year: earliestYear,
    });
  }

  return cases.map((item) => ({
    ...item,
    language_code: "nl",
    expected_source: sourceName,
    expected_metric_code: contract.metric_code,
    expected_dataset_code: contract.dataset_codes[0] ?? null,
    expected_grain: contract.default_grain,
    should_execute: true,
    metadata: { generated_from: "semantic_review_queue", metadata_origin: "generated" },
  }));
}

async function ensureSchema(client) {
  for (const file of ["supabase/semantic_workbench_schema.sql"]) {
    await client.query(readFileSync(resolve(process.cwd(), file), "utf8"));
  }
}

async function loadCapabilities(client, options) {
  const where = [
    "($1::text = '' or domain_id = $1)",
    "($2::text = '' or upper(dataset_code) = upper($2))",
  ];
  if (!options.includeEmpty) where.push("populated_fact_rows > 0");

  const { rows } = await client.query(
    `
      with selected as (
        select c.*,
          count(*) over (partition by c.domain_id, lower(coalesce(c.measure_name, ''))) as duplicate_label_count,
          existing.metric_code as existing_metric_code,
          existing.metadata_origin as existing_metadata_origin,
          existing.contract_status as existing_contract_status,
          existing.execution_status as existing_execution_status
        from semantic.gold_measure_capability c
        left join lateral (
          select mc.metric_code, mc.metadata_origin, mc.contract_status, mc.execution_status
          from semantic.metric_contract mc
          where mc.domain_id = c.domain_id
            and mc.measure_key = c.measure_key
            and c.dataset_code = any(mc.dataset_codes)
            and mc.is_active
          order by case when mc.metadata_origin = 'curated' then 0 else 1 end, mc.selection_priority
          limit 1
        ) existing on true
        where ${where.join("\n          and ")}
        order by
          case when c.executable_candidate then 0 else 1 end,
          c.populated_fact_rows desc,
          c.dataset_code,
          c.measure_key
        ${options.limit > 0 ? "limit $3" : ""}
      )
      select * from selected
    `,
    options.limit > 0 ? [options.domain, options.dataset, options.limit] : [options.domain, options.dataset]
  );
  return rows;
}

async function upsertContract(client, contract, sourceCapability, existingOrigin) {
  if (existingOrigin === "curated") return;

  await client.query(
    `
      insert into semantic.metric_contract (
        metric_code, label, description, domain_id, measure_key, dataset_codes, unit_code,
        aggregation, valid_grains, default_grain, synonyms, exclusions, supports, category_filters,
        selection_priority, metadata_origin, contract_status, execution_status, semantic_quality_status,
        is_active, updated_at
      )
      values (
        $1, $2, $3, $4, $5, $6::text[], $7,
        $8, $9::text[], $10, $11::jsonb, $12::text[], $13::jsonb, $14::jsonb,
        $15, 'generated', 'profiled', 'disabled', 'profiled',
        true, now()
      )
      on conflict (metric_code) do update set
        label = excluded.label,
        description = excluded.description,
        domain_id = excluded.domain_id,
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
        contract_status = case
          when semantic.metric_contract.contract_status in ('reviewed', 'curated') then semantic.metric_contract.contract_status
          else excluded.contract_status
        end,
        execution_status = case
          when semantic.metric_contract.contract_status in ('reviewed', 'curated') then semantic.metric_contract.execution_status
          else excluded.execution_status
        end,
        semantic_quality_status = case
          when semantic.metric_contract.contract_status in ('reviewed', 'curated') then semantic.metric_contract.semantic_quality_status
          else excluded.semantic_quality_status
        end,
        updated_at = now()
      where semantic.metric_contract.metadata_origin <> 'curated'
    `,
    [
      contract.metric_code,
      contract.label,
      contract.description,
      contract.domain_id,
      contract.measure_key,
      contract.dataset_codes,
      contract.unit_code,
      contract.aggregation,
      contract.valid_grains,
      contract.default_grain,
      JSON.stringify(contract.synonyms),
      contract.exclusions,
      JSON.stringify(contract.supports),
      JSON.stringify(contract.category_filters),
      contract.selection_priority,
    ]
  );
}

async function upsertReview(client, capability, contract, diagnostics, state) {
  const diagnosticSummary = summarizeDiagnostics(diagnostics);
  const { rows } = await client.query(
    `
      insert into semantic.metric_contract_review (
        metric_code, domain_id, dataset_code, measure_key, measure_code, label, review_status,
        execution_recommendation, risk_level, priority_score, diagnostic_summary,
        suggested_contract, source_capability, updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13::jsonb, now())
      on conflict (metric_code) do update set
        domain_id = excluded.domain_id,
        dataset_code = excluded.dataset_code,
        measure_key = excluded.measure_key,
        measure_code = excluded.measure_code,
        label = excluded.label,
        review_status = case
          when semantic.metric_contract_review.review_status = 'promoted' then semantic.metric_contract_review.review_status
          else excluded.review_status
        end,
        execution_recommendation = excluded.execution_recommendation,
        risk_level = excluded.risk_level,
        priority_score = excluded.priority_score,
        diagnostic_summary = excluded.diagnostic_summary,
        suggested_contract = excluded.suggested_contract,
        source_capability = excluded.source_capability,
        updated_at = now()
      returning review_id
    `,
    [
      contract.metric_code,
      contract.domain_id,
      capability.dataset_code,
      contract.measure_key,
      capability.measure_code,
      contract.label,
      state.reviewStatus,
      state.recommendation,
      state.risk,
      state.priority,
      JSON.stringify(diagnosticSummary),
      JSON.stringify(contract),
      JSON.stringify(capability),
    ]
  );
  return rows[0].review_id;
}

async function replaceDiagnostics(client, reviewId, metricCode, diagnostics) {
  await client.query("delete from semantic.metric_contract_diagnostic where metric_code = $1", [metricCode]);
  for (const diagnostic of diagnostics) {
    await client.query(
      `
        insert into semantic.metric_contract_diagnostic (
          review_id, metric_code, diagnostic_code, severity, message, is_blocking, metadata
        )
        values ($1, $2, $3, $4, $5, $6, $7::jsonb)
        on conflict (metric_code, diagnostic_code) do update set
          review_id = excluded.review_id,
          severity = excluded.severity,
          message = excluded.message,
          is_blocking = excluded.is_blocking,
          metadata = excluded.metadata,
          created_at = now()
      `,
      [
        reviewId,
        metricCode,
        diagnostic.code,
        diagnostic.severity,
        diagnostic.message,
        diagnostic.isBlocking,
        JSON.stringify(diagnostic.metadata ?? {}),
      ]
    );
  }
}

async function upsertTestCases(client, reviewId, contract, capability) {
  const sourceName = DOMAIN_SOURCES[contract.domain_id] ?? contract.domain_id;
  const cases = testCasesFor(contract, sourceName, capability);
  for (const testCase of cases) {
    await client.query(
      `
        insert into semantic.metric_contract_test_case (
          metric_code, review_id, question, language_code, expected_intent, expected_source,
          expected_metric_code, expected_dataset_code, expected_grain, expected_year,
          should_execute, generation_status, metadata, updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'generated', $12::jsonb, now())
        on conflict (metric_code, question, language_code) do update set
          review_id = excluded.review_id,
          expected_intent = excluded.expected_intent,
          expected_source = excluded.expected_source,
          expected_metric_code = excluded.expected_metric_code,
          expected_dataset_code = excluded.expected_dataset_code,
          expected_grain = excluded.expected_grain,
          expected_year = excluded.expected_year,
          should_execute = excluded.should_execute,
          generation_status = excluded.generation_status,
          metadata = excluded.metadata,
          updated_at = now()
      `,
      [
        contract.metric_code,
        reviewId,
        testCase.question,
        testCase.language_code,
        testCase.expected_intent,
        testCase.expected_source,
        testCase.expected_metric_code,
        testCase.expected_dataset_code,
        testCase.expected_grain,
        testCase.expected_year,
        testCase.should_execute,
        JSON.stringify(testCase.metadata),
      ]
    );
  }
  return cases.length;
}

function buildContract(capability) {
  const validGrains = Array.from(new Set((capability.grains ?? []).map(normalizeGrain).filter(Boolean))).sort();
  const defaultGrain = selectDefaultGrain(validGrains);
  const aggregation = safeAggregation(capability);
  const metricCode = capability.existing_metric_code || generatedMetricCode(capability);
  const label = capability.measure_name || capability.measure_code || metricCode;

  return {
    metric_code: metricCode,
    label,
    description: capability.measure_description || `Generated semantic contract candidate for ${label}.`,
    domain_id: capability.domain_id,
    measure_key: Number(capability.measure_key),
    dataset_codes: [String(capability.dataset_code)],
    unit_code: capability.unit_code || "UNKNOWN",
    aggregation,
    valid_grains: validGrains,
    default_grain: defaultGrain,
    synonyms: makeSynonyms(label, capability.measure_code),
    exclusions: [],
    supports: {
      ranking: Boolean(capability.supports_ranking),
      trend: Boolean(capability.supports_trend),
      comparison: Boolean(capability.supports_comparison),
      percentage_change: Boolean(capability.supports_trend && !["median", "none"].includes(aggregation)),
    },
    category_filters: {},
    selection_priority: 300,
    metadata_origin: "generated",
    source_quality: {
      populated_fact_rows: Number(capability.populated_fact_rows ?? 0),
      min_year: capability.min_year,
      max_year: capability.max_year,
      available_years: capability.available_years ?? [],
      executable_candidate: capability.executable_candidate,
      non_executable_reasons: capability.non_executable_reasons ?? [],
    },
  };
}

async function main() {
  loadLocalEnv();
  const options = parseArgs(process.argv);
  const client = createPostgresClient({
    applicationName: "guara-semantic-review-queue-loader",
    statementTimeoutMs: options.statementTimeoutMs,
    queryTimeoutMs: options.statementTimeoutMs,
  });

  await client.connect();
  try {
    if (options.ensureSchema) await ensureSchema(client);
    const capabilities = await loadCapabilities(client, options);
    console.log(`Selected ${capabilities.length} Gold measure capability row(s) for semantic review profiling.`);

    const summary = new Map();
    let contractsWritten = 0;
    let testCasesWritten = 0;

    for (const capability of capabilities) {
      const contract = buildContract(capability);
      const diagnostics = diagnose(capability, contract, Number(capability.duplicate_label_count ?? 0));
      const state = reviewState(capability, diagnostics);
      const key = `${state.reviewStatus}:${state.risk}`;
      summary.set(key, (summary.get(key) ?? 0) + 1);

      await upsertContract(client, contract, capability, capability.existing_metadata_origin);
      if (capability.existing_metadata_origin !== "curated") contractsWritten += 1;
      const reviewId = await upsertReview(client, capability, contract, diagnostics, state);
      await replaceDiagnostics(client, reviewId, contract.metric_code, diagnostics);
      testCasesWritten += await upsertTestCases(client, reviewId, contract, capability);
    }

    console.table(
      Array.from(summary.entries()).map(([statusRisk, count]) => {
        const [review_status, risk_level] = statusRisk.split(":");
        return { review_status, risk_level, count };
      })
    );
    console.log(`Upserted ${contractsWritten} generated/profiling contract(s) and ${testCasesWritten} generated test case(s).`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(explainPostgresConnectionError(error));
  process.exitCode = 1;
});
