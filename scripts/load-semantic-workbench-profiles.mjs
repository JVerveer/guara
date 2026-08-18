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
    ensureIndexes: false,
    domain: "",
    dataset: "",
    statementTimeoutMs: 900000,
    missingOnly: false,
    levelsOnly: false,
    limit: 0,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--ensure-schema") options.ensureSchema = true;
    else if (arg === "--ensure-indexes") options.ensureIndexes = true;
    else if (arg === "--missing-only") options.missingOnly = true;
    else if (arg === "--levels-only") options.levelsOnly = true;
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
  --ensure-indexes                Create profile helper indexes concurrently.
  --domain <domain_id>            Limit to one domain.
  --dataset <CBS code>            Limit to one dataset code.
  --missing-only                  Only profile measures missing from semantic.workbench_measure_profile.
  --levels-only                   Refresh geography levels/grains for selected measures only.
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

async function ensureProfileIndexes(client, selectedDomains) {
  for (const [domainId, mart] of selectedDomains) {
    const indexName = `${mart.fact}_dataset_measure_year_profile_idx`;
    const fact = `${sqlIdentifier(mart.schema)}.${sqlIdentifier(mart.fact)}`;
    console.log(`Ensuring Workbench profile index for ${domainId}: ${indexName}`);
    await client.query(`
      create index concurrently if not exists ${sqlIdentifier(indexName)}
      on ${fact} (dataset_code, measure_key, calendar_year)
      where calendar_year is not null
        and observation_value is not null
        and is_missing = false
    `);
  }
}

async function measuresForDomain(client, domainId, mart, dataset, limit, missingOnly) {
  const datasetTable = `${sqlIdentifier(mart.schema)}.${sqlIdentifier(mart.datasetDim)}`;
  const indicatorTable = `${sqlIdentifier(mart.schema)}.${sqlIdentifier(mart.indicatorDim)}`;
  const { rows } = await client.query(
    `
      select d.dataset_code, i.measure_key
      from ${indicatorTable} i
      join ${datasetTable} d on d.dataset_key = i.dataset_key
      left join semantic.workbench_measure_profile p
        on p.domain_id = $2
       and p.dataset_code = d.dataset_code
       and p.measure_key = i.measure_key
      where ($1::text = '' or d.dataset_code = $1 or upper(d.dataset_code) = upper($1))
        and ($3::boolean = false or p.measure_key is null)
      order by d.dataset_code, i.measure_key
      ${limit > 0 ? "limit $4" : ""}
    `,
    limit > 0 ? [dataset ?? "", domainId, missingOnly, limit] : [dataset ?? "", domainId, missingOnly]
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

async function profileMeasureFromSilverPeriods(client, domainId, datasetCode, measureKey) {
  const { rowCount } = await client.query(
    `
      with source_periods as (
        select
          $1::text as domain_id,
          $2::text as dataset_code,
          $3::bigint as measure_key,
          min(substring(period_key from 1 for 4)::int) as min_year,
          max(substring(period_key from 1 for 4)::int) as max_year
        from silver.cbs_period_values
        where dataset_id = $2
          and substring(period_key from 1 for 4) ~ '^[0-9]{4}$'
      ),
      profiled as (
        select
          domain_id,
          dataset_code,
          measure_key,
          0::bigint as loaded_fact_rows,
          0::bigint as populated_fact_rows,
          min_year,
          max_year,
          case
            when min_year is null or max_year is null then '{}'::integer[]
            else array(select generate_series(min_year, max_year))
          end as available_years,
          '{}'::text[] as geography_types,
          '{}'::text[] as grains
        from source_periods
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
        min_year = excluded.min_year,
        max_year = excluded.max_year,
        available_years = excluded.available_years,
        profiled_at = now()
    `,
    [domainId, datasetCode, measureKey]
  );
  return rowCount;
}

async function profileDatasetLevels(client, domainId, mart, datasetCode) {
  const { rowCount } = await client.query(
    `
      with levels as (
        select
          $1::text as domain_id,
          $2::text as dataset_code,
          case
            when not has_country_level
             and not has_province_level
             and not has_municipality_level
             and not has_neighborhood_level
             and not has_other_region_level
            then array['country']::text[]
            else array_remove(array[
            case when has_country_level then 'country' end,
            case when has_province_level then 'province' end,
            case when has_municipality_level then 'municipality' end,
            case when has_neighborhood_level then 'neighborhood' end,
            case when has_other_region_level then 'region' end
            ], null)::text[]
          end as geography_types
        from silver.cbs_dataset_grain
        where dataset_id in ($2, upper($2), lower($2))
        order by case when dataset_id = $2 then 0 when dataset_id = upper($2) then 1 else 2 end
        limit 1
      )
      update semantic.workbench_measure_profile p
      set
        geography_types = levels.geography_types,
        grains = coalesce((
          select array_agg(level || '_year' order by level)
          from unnest(levels.geography_types) level
        ), '{}'::text[]),
        profiled_at = now()
      from levels
      where p.domain_id = levels.domain_id
        and p.dataset_code in (levels.dataset_code, upper(levels.dataset_code), lower(levels.dataset_code))
        and cardinality(levels.geography_types) > 0
    `,
    [domainId, datasetCode]
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
    if (options.ensureIndexes) await ensureProfileIndexes(client, selected);
    for (const [domainId, mart] of selected) {
      const measures = await measuresForDomain(client, domainId, mart, options.dataset, options.limit, options.missingOnly);
      console.log(`Profiling Workbench measure years for ${domainId}: ${measures.length} measure(s).`);
      if (options.levelsOnly) {
        const datasetCodes = [...new Set(measures.map((measure) => measure.datasetCode))];
        let total = 0;
        let failed = 0;
        for (let index = 0; index < datasetCodes.length; index += 1) {
          const datasetCode = datasetCodes[index];
          try {
            const count = await profileDatasetLevels(client, domainId, mart, datasetCode);
            total += count;
            console.log(`  ${index + 1}/${datasetCodes.length} ${datasetCode}: refreshed levels for ${count} measure profile row(s).`);
          } catch (error) {
            failed += 1;
            console.warn(`  ${index + 1}/${datasetCodes.length} ${datasetCode}: skipped levels after error: ${error?.message ?? String(error)}`);
          }
        }
        console.log(`Done ${domainId}: refreshed levels for ${total} profile row(s), skipped ${failed} failed dataset(s).`);
        continue;
      }
      let total = 0;
      let failed = 0;
      for (let index = 0; index < measures.length; index += 1) {
        const measure = measures[index];
        try {
          const count = await profileMeasure(client, domainId, mart, measure.datasetCode, measure.measureKey);
          total += count;
          if (count > 0 || (index + 1) % 25 === 0 || index === measures.length - 1) {
            console.log(`  ${index + 1}/${measures.length} ${measure.datasetCode}/${measure.measureKey}: ${count} profile row(s).`);
          }
        } catch (error) {
          try {
            const fallbackCount = await profileMeasureFromSilverPeriods(
              client,
              domainId,
              measure.datasetCode,
              measure.measureKey
            );
            total += fallbackCount;
            console.warn(
              `  ${index + 1}/${measures.length} ${measure.datasetCode}/${measure.measureKey}: fact profile failed; used source period fallback (${fallbackCount} profile row(s)): ${
                error?.message ?? String(error)
              }`
            );
          } catch (fallbackError) {
            failed += 1;
            console.warn(
              `  ${index + 1}/${measures.length} ${measure.datasetCode}/${measure.measureKey}: skipped after error: ${
                error?.message ?? String(error)
              }; fallback failed: ${fallbackError?.message ?? String(fallbackError)}`
            );
          }
        }
      }
      console.log(`Done ${domainId}: upserted ${total} measure profile row(s), skipped ${failed} failed measure(s).`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(explainPostgresConnectionError(error));
  process.exitCode = 1;
});
