#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPostgresClient, explainPostgresConnectionError, loadLocalEnv } from "./lib/runtime.mjs";

const DOMAINS = {
  "bouwen-en-wonen": {
    schema: "gold_bouwen_wonen",
    fact: "fact_housing_observation",
    datasetDim: "dim_housing_dataset",
    indicatorDim: "dim_housing_indicator",
  },
  "inkomen-en-bestedingen": {
    schema: "gold_inkomen_bestedingen",
    fact: "fact_income_observation",
    datasetDim: "dim_income_dataset",
    indicatorDim: "dim_income_indicator",
  },
};

function parseArgs(argv) {
  const options = {
    ensureSchema: false,
    domain: "",
    dataset: "",
    statementTimeoutMs: 900000,
    limit: 0,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--ensure-schema") options.ensureSchema = true;
    else if (arg === "--domain") options.domain = argv[++index] ?? "";
    else if (arg === "--dataset") options.dataset = String(argv[++index] ?? "").toUpperCase();
    else if (arg === "--limit") options.limit = Number(argv[++index] ?? 0);
    else if (arg === "--statement-timeout-ms") options.statementTimeoutMs = Number(argv[++index] ?? options.statementTimeoutMs);
    else if (arg === "--help") {
      console.log(`Usage:
  npm run load:semantic:workbench-profiles -- --ensure-schema
  npm run load:semantic:workbench-profiles -- --domain bouwen-en-wonen
  npm run load:semantic:workbench-profiles -- --domain inkomen-en-bestedingen --dataset 81064NED

Options:
  --ensure-schema                 Apply supabase/semantic_workbench_schema.sql first.
  --domain <domain_id>            Limit to one domain.
  --dataset <CBS code>            Limit to one dataset code.
  --statement-timeout-ms 900000   Postgres statement timeout.
`);
      process.exit(0);
    }
  }
  return options;
}

function sqlIdentifier(value) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) throw new Error(`Unsafe SQL identifier: ${value}`);
  return `"${value}"`;
}

async function ensureSchema(client) {
  await client.query(readFileSync(resolve(process.cwd(), "supabase/semantic_workbench_schema.sql"), "utf8"));
}

async function measuresForDomain(client, mart, dataset, limit) {
  const datasetTable = `${sqlIdentifier(mart.schema)}.${sqlIdentifier(mart.datasetDim)}`;
  const indicatorTable = `${sqlIdentifier(mart.schema)}.${sqlIdentifier(mart.indicatorDim)}`;
  const { rows } = await client.query(
    `
      select d.dataset_code, i.measure_key
      from ${indicatorTable} i
      join ${datasetTable} d on d.dataset_key = i.dataset_key
      where ($1::text = '' or d.dataset_code = $1 or upper(d.dataset_code) = upper($1))
      order by d.dataset_code, i.measure_key
      ${limit > 0 ? "limit $2" : ""}
    `,
    limit > 0 ? [dataset ?? "", limit] : [dataset ?? ""]
  );
  return rows.map((row) => ({ datasetCode: row.dataset_code, measureKey: row.measure_key }));
}

async function profileMeasure(client, domainId, mart, datasetCode, measureKey) {
  const fact = `${sqlIdentifier(mart.schema)}.${sqlIdentifier(mart.fact)}`;
  const { rowCount } = await client.query(
    `
      with bounds as (
        select
          $1::text as domain_id,
          $2::text as dataset_code,
          $3::bigint as measure_key,
          (
            select f.calendar_year
            from ${fact} f
            where f.dataset_code = $2
              and f.measure_key = $3
              and f.calendar_year is not null
              and f.observation_value is not null
              and f.is_missing = false
            order by f.calendar_year asc
            limit 1
          ) as min_year,
          (
            select f.calendar_year
            from ${fact} f
            where f.dataset_code = $2
              and f.measure_key = $3
              and f.calendar_year is not null
              and f.observation_value is not null
              and f.is_missing = false
            order by f.calendar_year desc
            limit 1
          ) as max_year
      ),
      profiled as (
        select
          domain_id,
          dataset_code,
          measure_key,
          case when min_year is null then 0 else 1 end::bigint as loaded_fact_rows,
          case when min_year is null then 0 else 1 end::bigint as populated_fact_rows,
          min_year,
          max_year,
          case
            when min_year is null or max_year is null then '{}'::integer[]
            else array(select generate_series(min_year, max_year))
          end as available_years,
          '{}'::text[] as geography_types,
          '{}'::text[] as grains
        from bounds
        where min_year is not null
      )
      insert into semantic.workbench_measure_profile (
        domain_id, dataset_code, measure_key, loaded_fact_rows, populated_fact_rows,
        min_year, max_year, available_years, geography_types, grains, profiled_at
      )
      select
        domain_id, dataset_code, measure_key, loaded_fact_rows, populated_fact_rows,
        min_year, max_year, available_years, geography_types, grains, now()
      from profiled
      on conflict (domain_id, dataset_code, measure_key) do update set
        loaded_fact_rows = excluded.loaded_fact_rows,
        populated_fact_rows = excluded.populated_fact_rows,
        min_year = excluded.min_year,
        max_year = excluded.max_year,
        available_years = excluded.available_years,
        geography_types = excluded.geography_types,
        grains = excluded.grains,
        profiled_at = now()
    `,
    [domainId, datasetCode, measureKey]
  );
  return rowCount;
}

async function main() {
  loadLocalEnv();
  const options = parseArgs(process.argv);
  const selected = Object.entries(DOMAINS).filter(([domainId]) => !options.domain || options.domain === domainId);
  if (!selected.length) throw new Error(`Unknown domain: ${options.domain}`);

  const client = createPostgresClient({
    applicationName: "guara-semantic-workbench-profiler",
    statementTimeoutMs: options.statementTimeoutMs,
    queryTimeoutMs: options.statementTimeoutMs,
  });

  await client.connect();
  try {
    if (options.ensureSchema) await ensureSchema(client);
    for (const [domainId, mart] of selected) {
      const measures = await measuresForDomain(client, mart, options.dataset, options.limit);
      console.log(`Profiling Workbench measure years for ${domainId}: ${measures.length} measure(s).`);
      let total = 0;
      for (let index = 0; index < measures.length; index += 1) {
        const measure = measures[index];
        const count = await profileMeasure(client, domainId, mart, measure.datasetCode, measure.measureKey);
        total += count;
        if (count > 0 || (index + 1) % 25 === 0 || index === measures.length - 1) {
          console.log(`  ${index + 1}/${measures.length} ${measure.datasetCode}/${measure.measureKey}: ${count} profile row(s).`);
        }
      }
      console.log(`Done ${domainId}: upserted ${total} measure profile row(s).`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(explainPostgresConnectionError(error));
  process.exitCode = 1;
});
