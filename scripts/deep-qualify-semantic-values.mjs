#!/usr/bin/env node
import { createPostgresClient, explainPostgresConnectionError, loadLocalEnv } from "./lib/runtime.mjs";

const MARTS = {
  "bouwen-en-wonen": {
    martSchema: "gold_bouwen_wonen",
    factTable: "fact_housing_observation",
    datasetDim: "dim_housing_dataset",
    indicatorDim: "dim_housing_indicator",
  },
  "inkomen-en-bestedingen": {
    martSchema: "gold_inkomen_bestedingen",
    factTable: "fact_income_observation",
    datasetDim: "dim_income_dataset",
    indicatorDim: "dim_income_indicator",
  },
};

function parseArgs(argv) {
  const options = {
    domain: "",
    dataset: "",
    limit: 0,
    missingOnly: false,
    measureByMeasure: false,
    statementTimeoutMs: 180000,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--domain") options.domain = argv[++index] ?? "";
    else if (arg === "--dataset") options.dataset = String(argv[++index] ?? "");
    else if (arg === "--limit") options.limit = Number(argv[++index] ?? 0);
    else if (arg === "--missing-only") options.missingOnly = true;
    else if (arg === "--measure-by-measure") options.measureByMeasure = true;
    else if (arg === "--statement-timeout-ms") options.statementTimeoutMs = Number(argv[++index] ?? options.statementTimeoutMs);
    else if (arg === "--help") {
      console.log(`Usage:
  npm run deep-qualify:semantic -- --domain bouwen-en-wonen
  npm run deep-qualify:semantic -- --domain inkomen-en-bestedingen --dataset 81064ned

Options:
  --domain <domain_id>            Limit to one Guara domain.
  --dataset <CBS code>            Limit to one dataset code.
  --limit <n>                     Limit selected datasets.
  --missing-only                  Only select measures not already in semantic.gold_measure_capability.
  --measure-by-measure            Profile selected measures one at a time for timeout-prone datasets.
  --statement-timeout-ms 180000   Per-dataset Postgres timeout.
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

async function createRun(client, options) {
  const { rows } = await client.query(
    `
      insert into semantic.gold_capability_run (status, mart_filter, domain_filter, dataset_filter)
      values ('running', 'deep-qualify-semantic-values', $1, $2)
      returning capability_run_id
    `,
    [options.domain || null, options.dataset || null]
  );
  return rows[0].capability_run_id;
}

async function finishRun(client, runId, status, counts = {}, errorMessage = null) {
  await client.query(
    `
      update semantic.gold_capability_run
      set status = $2,
          finished_at = now(),
          dataset_count = coalesce($3, dataset_count),
          measure_count = coalesce($4, measure_count),
          error_message = $5
      where capability_run_id = $1
    `,
    [runId, status, counts.datasetCount ?? null, counts.measureCount ?? null, errorMessage]
  );
}

async function selectedDatasets(client, options) {
  const { rows } = await client.query(
    `
      select p.domain_id, p.dataset_code, count(*)::int as measure_count
      from semantic.workbench_measure_profile p
      left join semantic.gold_measure_capability c
        on c.domain_id = p.domain_id
       and upper(c.dataset_code) = upper(p.dataset_code)
       and c.measure_key = p.measure_key
      where p.populated_fact_rows > 0
        and ($1::text = '' or p.domain_id = $1)
        and ($2::text = '' or upper(p.dataset_code) = upper($2))
        and ($3::boolean = false or c.measure_key is null)
      group by p.domain_id, p.dataset_code
      order by p.domain_id, p.dataset_code
      ${options.limit > 0 ? "limit $3" : ""}
    `,
    options.limit > 0
      ? [options.domain, options.dataset, options.missingOnly, options.limit]
      : [options.domain, options.dataset, options.missingOnly]
  );
  return rows.filter((row) => MARTS[row.domain_id]);
}

async function selectedMeasures(client, domainId, datasetCode, options) {
  const { rows } = await client.query(
    `
      select p.measure_key::text as measure_key
      from semantic.workbench_measure_profile p
      left join semantic.gold_measure_capability c
        on c.domain_id = p.domain_id
       and upper(c.dataset_code) = upper(p.dataset_code)
       and c.measure_key = p.measure_key
      where p.domain_id = $1
        and upper(p.dataset_code) = upper($2)
        and p.populated_fact_rows > 0
        and ($3::boolean = false or c.measure_key is null)
      order by p.measure_key
    `,
    [domainId, datasetCode, options.missingOnly]
  );
  return rows.map((row) => row.measure_key);
}

async function profileDatasetMeasures(client, domainId, datasetCode, runId) {
  const mart = MARTS[domainId];
  const fact = `${sqlIdentifier(mart.martSchema)}.${sqlIdentifier(mart.factTable)}`;
  const datasetDim = `${sqlIdentifier(mart.martSchema)}.${sqlIdentifier(mart.datasetDim)}`;
  const indicatorDim = `${sqlIdentifier(mart.martSchema)}.${sqlIdentifier(mart.indicatorDim)}`;

  const result = await client.query(
    `
      with measure_rollup as (
        select
          $1::text as dataset_code,
          f.measure_key,
          count(*)::bigint as populated_fact_rows,
          min(f.calendar_year) filter (where f.calendar_year is not null) as min_year,
          max(f.calendar_year) filter (where f.calendar_year is not null) as max_year,
          coalesce(array_agg(distinct f.calendar_year order by f.calendar_year) filter (where f.calendar_year is not null), '{}'::integer[]) as available_years,
          coalesce(array_agg(distinct coalesce(nullif(f.period_type, ''), 'year') order by coalesce(nullif(f.period_type, ''), 'year')), '{}'::text[]) as period_types,
          coalesce(array_agg(distinct coalesce(nullif(f.geography_type, ''), 'country') order by coalesce(nullif(f.geography_type, ''), 'country')), '{}'::text[]) as geography_types,
          coalesce(array_agg(distinct (
            case when coalesce(nullif(f.geography_type, ''), 'country') in ('country', 'unknown') then 'national' else coalesce(nullif(f.geography_type, ''), 'country') end
            || '_' || coalesce(nullif(f.period_type, ''), 'year')
          )), '{}'::text[]) as grains
        from ${fact} f
        where f.dataset_code in ($1, upper($1), lower($1))
          and f.observation_value is not null
          and f.is_missing = false
          and f.calendar_year is not null
        group by f.measure_key
      )
      insert into semantic.gold_measure_capability (
        domain_id, mart_schema, fact_table, dataset_code, measure_key, measure_code, measure_name,
        measure_description, unit_code, unit_name, unit_category, scale_factor, default_aggregation,
        value_type, is_additive, is_non_additive, loaded_fact_rows, populated_fact_rows, min_year,
        max_year, available_years, period_types, geography_types, grains, supports_national_year,
        supports_province_year, supports_region_year, supports_municipality_year, supports_trend,
        supports_ranking, supports_comparison, executable_candidate, non_executable_reasons,
        metadata, last_profiled_at, capability_run_id
      )
      select
        $2,
        $3,
        $4,
        r.dataset_code,
        i.measure_key,
        i.measure_code,
        i.indicator_name,
        i.indicator_description,
        i.unit_code,
        i.unit_name,
        u.unit_category,
        u.scale_factor,
        i.default_aggregation,
        i.value_type,
        i.is_additive,
        i.is_non_additive,
        r.populated_fact_rows,
        r.populated_fact_rows,
        r.min_year,
        r.max_year,
        r.available_years,
        r.period_types,
        r.geography_types,
        r.grains,
        'national_year' = any(r.grains),
        'province_year' = any(r.grains),
        'region_year' = any(r.grains),
        'municipality_year' = any(r.grains),
        coalesce(array_length(r.available_years, 1), 0) > 1,
        exists (select 1 from unnest(r.grains) g where g in ('municipality_year', 'province_year', 'region_year')),
        exists (select 1 from unnest(r.grains) g where g in ('municipality_year', 'province_year', 'region_year', 'national_year')),
        r.populated_fact_rows > 0
          and i.default_aggregation is not null
          and i.default_aggregation <> 'none'
          and exists (select 1 from unnest(r.grains) g where g in ('municipality_year', 'province_year', 'region_year', 'national_year')),
        array_remove(array[
          case when r.populated_fact_rows = 0 then 'no_populated_facts' end,
          case when i.default_aggregation is null or i.default_aggregation = 'none' then 'missing_safe_aggregation' end,
          case when not exists (select 1 from unnest(r.grains) g where g in ('municipality_year', 'province_year', 'region_year', 'national_year')) then 'unsupported_grain' end
        ], null),
        jsonb_build_object(
          'profile_source', 'gold_fact_scan_by_dataset',
          'metadata_origin', 'generated',
          'row_count_scope', 'non_missing_gold_fact_rows',
          'derived_from_layers', jsonb_build_array('cbs_api', 'bronze', 'silver', 'gold')
        ),
        now(),
        $5::uuid
      from measure_rollup r
      join ${indicatorDim} i on i.measure_key = r.measure_key
      join ${datasetDim} d on d.dataset_key = i.dataset_key
      left join gold.dim_unit u on u.unit_key = i.unit_key
      where d.dataset_code in ($1, upper($1), lower($1))
      on conflict (domain_id, mart_schema, fact_table, dataset_code, measure_key) do update set
        measure_code = excluded.measure_code,
        measure_name = excluded.measure_name,
        measure_description = excluded.measure_description,
        unit_code = excluded.unit_code,
        unit_name = excluded.unit_name,
        unit_category = excluded.unit_category,
        scale_factor = excluded.scale_factor,
        default_aggregation = excluded.default_aggregation,
        value_type = excluded.value_type,
        is_additive = excluded.is_additive,
        is_non_additive = excluded.is_non_additive,
        loaded_fact_rows = excluded.loaded_fact_rows,
        populated_fact_rows = excluded.populated_fact_rows,
        min_year = excluded.min_year,
        max_year = excluded.max_year,
        available_years = excluded.available_years,
        period_types = excluded.period_types,
        geography_types = excluded.geography_types,
        grains = excluded.grains,
        supports_national_year = excluded.supports_national_year,
        supports_province_year = excluded.supports_province_year,
        supports_region_year = excluded.supports_region_year,
        supports_municipality_year = excluded.supports_municipality_year,
        supports_trend = excluded.supports_trend,
        supports_ranking = excluded.supports_ranking,
        supports_comparison = excluded.supports_comparison,
        executable_candidate = excluded.executable_candidate,
        non_executable_reasons = excluded.non_executable_reasons,
        metadata = excluded.metadata,
        last_profiled_at = excluded.last_profiled_at,
        capability_run_id = excluded.capability_run_id
      returning measure_key
    `,
    [datasetCode, domainId, mart.martSchema, mart.factTable, runId]
  );
  return result.rowCount;
}

async function profileSingleMeasure(client, domainId, datasetCode, measureKey, runId) {
  const mart = MARTS[domainId];
  const fact = `${sqlIdentifier(mart.martSchema)}.${sqlIdentifier(mart.factTable)}`;
  const datasetDim = `${sqlIdentifier(mart.martSchema)}.${sqlIdentifier(mart.datasetDim)}`;
  const indicatorDim = `${sqlIdentifier(mart.martSchema)}.${sqlIdentifier(mart.indicatorDim)}`;

  const result = await client.query(
    `
      with measure_rollup as (
        select
          $1::text as dataset_code,
          $2::bigint as measure_key,
          count(*)::bigint as populated_fact_rows
        from ${fact} f
        where f.dataset_code = $1
          and f.measure_key = $2
          and f.observation_value is not null
          and f.is_missing = false
          and f.calendar_year is not null
      ),
      profile as (
        select
          p.min_year,
          p.max_year,
          p.available_years,
          array['year']::text[] as period_types,
          p.geography_types,
          p.grains
        from semantic.workbench_measure_profile p
        where p.domain_id = $3
          and upper(p.dataset_code) = upper($1)
          and p.measure_key = $2
        limit 1
      )
      insert into semantic.gold_measure_capability (
        domain_id, mart_schema, fact_table, dataset_code, measure_key, measure_code, measure_name,
        measure_description, unit_code, unit_name, unit_category, scale_factor, default_aggregation,
        value_type, is_additive, is_non_additive, loaded_fact_rows, populated_fact_rows, min_year,
        max_year, available_years, period_types, geography_types, grains, supports_national_year,
        supports_province_year, supports_region_year, supports_municipality_year, supports_trend,
        supports_ranking, supports_comparison, executable_candidate, non_executable_reasons,
        metadata, last_profiled_at, capability_run_id
      )
      select
        $3,
        $4,
        $5,
        r.dataset_code,
        i.measure_key,
        i.measure_code,
        i.indicator_name,
        i.indicator_description,
        i.unit_code,
        i.unit_name,
        u.unit_category,
        u.scale_factor,
        i.default_aggregation,
        i.value_type,
        i.is_additive,
        i.is_non_additive,
        r.populated_fact_rows,
        r.populated_fact_rows,
        p.min_year,
        p.max_year,
        p.available_years,
        p.period_types,
        p.geography_types,
        p.grains,
        'national_year' = any(p.grains),
        'province_year' = any(p.grains),
        'region_year' = any(p.grains),
        'municipality_year' = any(p.grains),
        coalesce(array_length(p.available_years, 1), 0) > 1,
        exists (select 1 from unnest(p.grains) g where g in ('municipality_year', 'province_year', 'region_year')),
        exists (select 1 from unnest(p.grains) g where g in ('municipality_year', 'province_year', 'region_year', 'national_year')),
        r.populated_fact_rows > 0
          and i.default_aggregation is not null
          and i.default_aggregation <> 'none'
          and exists (select 1 from unnest(p.grains) g where g in ('municipality_year', 'province_year', 'region_year', 'national_year')),
        array_remove(array[
          case when r.populated_fact_rows = 0 then 'no_populated_facts' end,
          case when i.default_aggregation is null or i.default_aggregation = 'none' then 'missing_safe_aggregation' end,
          case when not exists (select 1 from unnest(p.grains) g where g in ('municipality_year', 'province_year', 'region_year', 'national_year')) then 'unsupported_grain' end
        ], null),
        jsonb_build_object(
          'profile_source', 'gold_fact_scan_by_measure',
          'metadata_origin', 'generated',
          'row_count_scope', 'non_missing_gold_fact_rows',
          'derived_from_layers', jsonb_build_array('cbs_api', 'bronze', 'silver', 'gold')
        ),
        now(),
        $6::uuid
      from measure_rollup r
      join profile p on true
      join ${indicatorDim} i on i.measure_key = r.measure_key
      join ${datasetDim} d on d.dataset_key = i.dataset_key
      left join gold.dim_unit u on u.unit_key = i.unit_key
      where d.dataset_code in ($1, upper($1), lower($1))
        and r.populated_fact_rows > 0
      on conflict (domain_id, mart_schema, fact_table, dataset_code, measure_key) do update set
        measure_code = excluded.measure_code,
        measure_name = excluded.measure_name,
        measure_description = excluded.measure_description,
        unit_code = excluded.unit_code,
        unit_name = excluded.unit_name,
        unit_category = excluded.unit_category,
        scale_factor = excluded.scale_factor,
        default_aggregation = excluded.default_aggregation,
        value_type = excluded.value_type,
        is_additive = excluded.is_additive,
        is_non_additive = excluded.is_non_additive,
        loaded_fact_rows = excluded.loaded_fact_rows,
        populated_fact_rows = excluded.populated_fact_rows,
        min_year = excluded.min_year,
        max_year = excluded.max_year,
        available_years = excluded.available_years,
        period_types = excluded.period_types,
        geography_types = excluded.geography_types,
        grains = excluded.grains,
        supports_national_year = excluded.supports_national_year,
        supports_province_year = excluded.supports_province_year,
        supports_region_year = excluded.supports_region_year,
        supports_municipality_year = excluded.supports_municipality_year,
        supports_trend = excluded.supports_trend,
        supports_ranking = excluded.supports_ranking,
        supports_comparison = excluded.supports_comparison,
        executable_candidate = excluded.executable_candidate,
        non_executable_reasons = excluded.non_executable_reasons,
        metadata = excluded.metadata,
        last_profiled_at = excluded.last_profiled_at,
        capability_run_id = excluded.capability_run_id
      returning measure_key
    `,
    [datasetCode, measureKey, domainId, mart.martSchema, mart.factTable, runId]
  );
  return result.rowCount;
}

async function main() {
  loadLocalEnv();
  const options = parseArgs(process.argv);
  const client = createPostgresClient({
    applicationName: "guara-deep-qualify-semantic-values",
    statementTimeoutMs: options.statementTimeoutMs,
    queryTimeoutMs: options.statementTimeoutMs,
  });

  let runId = null;
  await client.connect();
  try {
    runId = await createRun(client, options);
    const datasets = await selectedDatasets(client, options);
    console.log(`Selected ${datasets.length} dataset(s) for deep semantic qualification.`);

    let measureCount = 0;
    let failed = 0;
    let failedMeasures = 0;
    for (let index = 0; index < datasets.length; index += 1) {
      const dataset = datasets[index];
      try {
        let count = 0;
        if (options.measureByMeasure) {
          const measures = await selectedMeasures(client, dataset.domain_id, dataset.dataset_code, options);
          for (let measureIndex = 0; measureIndex < measures.length; measureIndex += 1) {
            try {
              count += await profileSingleMeasure(client, dataset.domain_id, dataset.dataset_code, measures[measureIndex], runId);
            } catch (error) {
              failedMeasures += 1;
              console.warn(
                `    ${dataset.domain_id} ${dataset.dataset_code}/${measures[measureIndex]} failed: ${error?.message ?? String(error)}`
              );
            }
          }
        } else {
          count = await profileDatasetMeasures(client, dataset.domain_id, dataset.dataset_code, runId);
        }
        measureCount += count;
        console.log(`  ${index + 1}/${datasets.length} ${dataset.domain_id} ${dataset.dataset_code}: ${count} measure capability row(s).`);
      } catch (error) {
        failed += 1;
        console.warn(`  ${index + 1}/${datasets.length} ${dataset.domain_id} ${dataset.dataset_code}: failed: ${error?.message ?? String(error)}`);
      }
    }

    const status = failed > 0 || failedMeasures > 0 ? "partial" : "complete";
    await finishRun(
      client,
      runId,
      status,
      { datasetCount: datasets.length - failed, measureCount },
      failed || failedMeasures ? `${failed} dataset(s) failed; ${failedMeasures} measure(s) failed.` : null
    );
    console.log(`Deep qualification ${status}: ${measureCount} measure capability row(s), ${failed} failed dataset(s), ${failedMeasures} failed measure(s).`);
    if (failed > 0 || failedMeasures > 0) process.exitCode = 1;
  } catch (error) {
    if (runId) await finishRun(client, runId, "failed", {}, error.message).catch(() => {});
    throw error;
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(explainPostgresConnectionError(error));
  process.exitCode = 1;
});
