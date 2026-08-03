#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPostgresClient, explainPostgresConnectionError, loadLocalEnv } from "./lib/runtime.mjs";

const MARTS = [
  {
    domainId: "bouwen-en-wonen",
    martSchema: "gold_bouwen_wonen",
    factTable: "fact_housing_observation",
    bridgeTable: "bridge_housing_observation_category",
    observationKey: "housing_observation_key",
  },
  {
    domainId: "inkomen-en-bestedingen",
    martSchema: "gold_inkomen_bestedingen",
    factTable: "fact_income_observation",
    bridgeTable: "bridge_income_observation_category",
    observationKey: "income_observation_key",
  },
];

function parseArgs(argv) {
  const options = { ensureSchema: false, domain: "", dataset: "", mart: "", statementTimeoutMs: 900000 };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--ensure-schema") options.ensureSchema = true;
    else if (arg === "--domain") options.domain = argv[++index] ?? "";
    else if (arg === "--dataset") options.dataset = argv[++index] ?? "";
    else if (arg === "--mart") options.mart = argv[++index] ?? "";
    else if (arg === "--statement-timeout-ms") options.statementTimeoutMs = Number(argv[++index] ?? options.statementTimeoutMs);
    else if (arg === "--help") {
      console.log(`Usage:
  npm run load:gold:capabilities -- --ensure-schema
  npm run load:gold:capabilities -- --domain bouwen-en-wonen
  npm run load:gold:capabilities -- --domain inkomen-en-bestedingen --dataset 81064ned

Options:
  --ensure-schema                 Apply supabase/gold_capability_registry_schema.sql first.
  --domain <domain_id>            Limit to one Guara domain.
  --dataset <CBS code>            Limit to one dataset code.
  --mart <schema.table>           Limit to one fact mart, for example gold_bouwen_wonen.fact_housing_observation.
  --statement-timeout-ms 900000   Postgres statement timeout for profiling queries.
`);
      process.exit(0);
    }
  }
  return options;
}

function selectedMarts(options) {
  return MARTS.filter((mart) => {
    const martName = `${mart.martSchema}.${mart.factTable}`;
    if (options.domain && mart.domainId !== options.domain) return false;
    if (options.mart && martName !== options.mart) return false;
    return true;
  });
}

function sqlIdentifier(value) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) throw new Error(`Unsafe SQL identifier: ${value}`);
  return `"${value}"`;
}

async function ensureSchema(client) {
  await client.query(readFileSync(resolve(process.cwd(), "supabase/gold_capability_registry_schema.sql"), "utf8"));
}

async function createRun(client, options) {
  const { rows } = await client.query(
    `
      insert into semantic.gold_capability_run (status, mart_filter, domain_filter, dataset_filter)
      values ('running', $1, $2, $3)
      returning capability_run_id
    `,
    [options.mart || null, options.domain || null, options.dataset || null]
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
          grain_count = coalesce($5, grain_count),
          error_message = $6
      where capability_run_id = $1
    `,
    [runId, status, counts.datasetCount ?? null, counts.measureCount ?? null, counts.grainCount ?? null, errorMessage]
  );
}

async function profileDatasets(client, mart, runId, datasetFilter) {
  const fact = `${sqlIdentifier(mart.martSchema)}.${sqlIdentifier(mart.factTable)}`;
  const bridge = `${sqlIdentifier(mart.martSchema)}.${sqlIdentifier(mart.bridgeTable)}`;
  const observationKey = sqlIdentifier(mart.observationKey);
  const result = await client.query(
    `
      with fact_rollup as (
        select
          f.dataset_key,
          f.dataset_code,
          count(*)::bigint as loaded_fact_rows,
          count(*) filter (where f.observation_value is not null and f.is_missing = false)::bigint as populated_fact_rows,
          count(*) filter (where f.observation_value is null or f.is_missing = true)::bigint as missing_fact_rows,
          count(distinct f.measure_key)::integer as measure_count,
          count(distinct f.geography_key) filter (where f.geography_type is distinct from 'unknown')::integer as geography_count,
          min(f.calendar_year) filter (where f.calendar_year is not null) as min_year,
          max(f.calendar_year) filter (where f.calendar_year is not null) as max_year,
          coalesce(array_agg(distinct f.calendar_year order by f.calendar_year) filter (where f.calendar_year is not null), '{}'::integer[]) as available_years,
          coalesce(array_agg(distinct coalesce(nullif(f.period_type, ''), 'year') order by coalesce(nullif(f.period_type, ''), 'year')), '{}'::text[]) as period_types,
          coalesce(array_agg(distinct coalesce(nullif(f.geography_type, ''), 'unknown') order by coalesce(nullif(f.geography_type, ''), 'unknown')), '{}'::text[]) as geography_types,
          coalesce(array_agg(distinct (
            case when f.geography_type in ('country', 'unknown') then 'national' else coalesce(nullif(f.geography_type, ''), 'unknown') end
            || '_' || coalesce(nullif(f.period_type, ''), 'year')
          )), '{}'::text[]) as grains
        from ${fact} f
        where ($1::text is null or f.dataset_code = $1 or f.source_dataset_id = $1)
        group by f.dataset_key, f.dataset_code
      ),
      category_rollup as (
        select
          f.dataset_key,
          count(distinct b.dimension_code)::integer as category_dimension_count,
          count(distinct b.category_key)::integer as category_value_count
        from ${fact} f
        join ${bridge} b on b.${observationKey} = f.${observationKey}
        where ($1::text is null or f.dataset_code = $1 or f.source_dataset_id = $1)
        group by f.dataset_key
      )
      insert into semantic.gold_dataset_capability (
        domain_id, mart_schema, fact_table, dataset_key, dataset_code, dataset_title, source_system,
        source_organization, source_url, source_last_updated_at, gold_loaded_at, loaded_fact_rows,
        populated_fact_rows, missing_fact_rows, measure_count, geography_count, category_dimension_count,
        category_value_count, min_year, max_year, available_years, period_types, geography_types, grains,
        supports_national_year, supports_province_year, supports_region_year, supports_municipality_year,
        supports_trend, supports_ranking, supports_comparison, capability_status, capability_notes,
        metadata, last_profiled_at, capability_run_id
      )
      select
        $2,
        $3,
        $4,
        d.dataset_key,
        r.dataset_code,
        d.dataset_title,
        d.source_system,
        d.source_organization,
        d.source_url,
        d.last_updated_at_source,
        d.loaded_at,
        r.loaded_fact_rows,
        r.populated_fact_rows,
        r.missing_fact_rows,
        r.measure_count,
        r.geography_count,
        coalesce(c.category_dimension_count, 0),
        coalesce(c.category_value_count, 0),
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
        case
          when r.populated_fact_rows = 0 then 'no_populated_facts'
          when not exists (select 1 from unnest(r.grains) g where g in ('municipality_year', 'province_year', 'region_year', 'national_year')) then 'limited_unknown_grain'
          when r.missing_fact_rows > r.populated_fact_rows then 'partial_sparse'
          else 'ready'
        end,
        array_remove(array[
          case when r.populated_fact_rows = 0 then 'No populated observation values found.' end,
          case when not ('municipality_year' = any(r.grains)) then 'No municipality-year grain detected.' end,
          case when r.min_year is null then 'No calendar year detected.' end
        ], null),
        jsonb_build_object('profile_source', 'gold_fact_scan', 'derived_from_layers', jsonb_build_array('cbs_api', 'bronze', 'silver', 'gold')),
        now(),
        $5::uuid
      from fact_rollup r
      join gold.dim_dataset d on d.dataset_key = r.dataset_key
      left join category_rollup c on c.dataset_key = r.dataset_key
      on conflict (domain_id, mart_schema, fact_table, dataset_code) do update set
        dataset_title = excluded.dataset_title,
        source_system = excluded.source_system,
        source_organization = excluded.source_organization,
        source_url = excluded.source_url,
        source_last_updated_at = excluded.source_last_updated_at,
        gold_loaded_at = excluded.gold_loaded_at,
        loaded_fact_rows = excluded.loaded_fact_rows,
        populated_fact_rows = excluded.populated_fact_rows,
        missing_fact_rows = excluded.missing_fact_rows,
        measure_count = excluded.measure_count,
        geography_count = excluded.geography_count,
        category_dimension_count = excluded.category_dimension_count,
        category_value_count = excluded.category_value_count,
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
        capability_status = excluded.capability_status,
        capability_notes = excluded.capability_notes,
        metadata = excluded.metadata,
        last_profiled_at = excluded.last_profiled_at,
        capability_run_id = excluded.capability_run_id
      returning dataset_code
    `,
    [datasetFilter || null, mart.domainId, mart.martSchema, mart.factTable, runId]
  );
  return result.rowCount;
}

async function profileMeasures(client, mart, runId, datasetFilter) {
  const fact = `${sqlIdentifier(mart.martSchema)}.${sqlIdentifier(mart.factTable)}`;
  const result = await client.query(
    `
      with measure_rollup as (
        select
          f.dataset_code,
          f.measure_key,
          count(*)::bigint as loaded_fact_rows,
          count(*) filter (where f.observation_value is not null and f.is_missing = false)::bigint as populated_fact_rows,
          min(f.calendar_year) filter (where f.calendar_year is not null) as min_year,
          max(f.calendar_year) filter (where f.calendar_year is not null) as max_year,
          coalesce(array_agg(distinct f.calendar_year order by f.calendar_year) filter (where f.calendar_year is not null), '{}'::integer[]) as available_years,
          coalesce(array_agg(distinct coalesce(nullif(f.period_type, ''), 'year') order by coalesce(nullif(f.period_type, ''), 'year')), '{}'::text[]) as period_types,
          coalesce(array_agg(distinct coalesce(nullif(f.geography_type, ''), 'unknown') order by coalesce(nullif(f.geography_type, ''), 'unknown')), '{}'::text[]) as geography_types,
          coalesce(array_agg(distinct (
            case when f.geography_type in ('country', 'unknown') then 'national' else coalesce(nullif(f.geography_type, ''), 'unknown') end
            || '_' || coalesce(nullif(f.period_type, ''), 'year')
          )), '{}'::text[]) as grains
        from ${fact} f
        where ($1::text is null or f.dataset_code = $1 or f.source_dataset_id = $1)
        group by f.dataset_code, f.measure_key
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
        m.measure_key,
        m.measure_code,
        m.measure_name,
        m.measure_description,
        u.unit_code,
        u.unit_name,
        u.unit_category,
        u.scale_factor,
        m.default_aggregation,
        m.value_type,
        m.is_additive,
        m.is_non_additive,
        r.loaded_fact_rows,
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
          and m.default_aggregation is not null
          and m.default_aggregation <> 'none'
          and exists (select 1 from unnest(r.grains) g where g in ('municipality_year', 'province_year', 'region_year', 'national_year')),
        array_remove(array[
          case when r.populated_fact_rows = 0 then 'no_populated_facts' end,
          case when m.default_aggregation is null or m.default_aggregation = 'none' then 'missing_safe_aggregation' end,
          case when not exists (select 1 from unnest(r.grains) g where g in ('municipality_year', 'province_year', 'region_year', 'national_year')) then 'unsupported_grain' end
        ], null),
        jsonb_build_object('profile_source', 'gold_fact_scan', 'metadata_origin', 'generated'),
        now(),
        $5::uuid
      from measure_rollup r
      join gold.dim_measure m on m.measure_key = r.measure_key
      left join gold.dim_unit u on u.unit_key = m.unit_key
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
    [datasetFilter || null, mart.domainId, mart.martSchema, mart.factTable, runId]
  );
  return result.rowCount;
}

async function profileGrains(client, mart, runId, datasetFilter) {
  const fact = `${sqlIdentifier(mart.martSchema)}.${sqlIdentifier(mart.factTable)}`;
  const result = await client.query(
    `
      insert into semantic.gold_grain_capability (
        domain_id, mart_schema, fact_table, dataset_code, measure_key, geography_type, period_type, grain,
        loaded_fact_rows, populated_fact_rows, geography_count, category_combination_count,
        min_year, max_year, available_years, last_profiled_at, capability_run_id
      )
      select
        $2,
        $3,
        $4,
        f.dataset_code,
        f.measure_key,
        coalesce(nullif(f.geography_type, ''), 'unknown'),
        coalesce(nullif(f.period_type, ''), 'year'),
        case when coalesce(nullif(f.geography_type, ''), 'unknown') in ('country', 'unknown')
          then 'national'
          else coalesce(nullif(f.geography_type, ''), 'unknown')
        end
          || '_' || coalesce(nullif(f.period_type, ''), 'year'),
        count(*)::bigint,
        count(*) filter (where f.observation_value is not null and f.is_missing = false)::bigint,
        count(distinct f.geography_key)::integer,
        count(distinct f.category_combination_hash)::integer,
        min(f.calendar_year) filter (where f.calendar_year is not null),
        max(f.calendar_year) filter (where f.calendar_year is not null),
        coalesce(array_agg(distinct f.calendar_year order by f.calendar_year) filter (where f.calendar_year is not null), '{}'::integer[]),
        now(),
        $5::uuid
      from ${fact} f
      where ($1::text is null or f.dataset_code = $1 or f.source_dataset_id = $1)
      group by
        f.dataset_code,
        f.measure_key,
        coalesce(nullif(f.geography_type, ''), 'unknown'),
        coalesce(nullif(f.period_type, ''), 'year'),
        case when coalesce(nullif(f.geography_type, ''), 'unknown') in ('country', 'unknown')
          then 'national'
          else coalesce(nullif(f.geography_type, ''), 'unknown')
        end || '_' || coalesce(nullif(f.period_type, ''), 'year')
      on conflict (domain_id, mart_schema, fact_table, dataset_code, measure_key, geography_type, period_type) do update set
        grain = excluded.grain,
        loaded_fact_rows = excluded.loaded_fact_rows,
        populated_fact_rows = excluded.populated_fact_rows,
        geography_count = excluded.geography_count,
        category_combination_count = excluded.category_combination_count,
        min_year = excluded.min_year,
        max_year = excluded.max_year,
        available_years = excluded.available_years,
        last_profiled_at = excluded.last_profiled_at,
        capability_run_id = excluded.capability_run_id
      returning measure_key
    `,
    [datasetFilter || null, mart.domainId, mart.martSchema, mart.factTable, runId]
  );
  return result.rowCount;
}

async function main() {
  const options = parseArgs(process.argv);
  loadLocalEnv();
  const client = createPostgresClient({
    applicationName: "guara-gold-capability-registry-loader",
    statementTimeoutMs: options.statementTimeoutMs,
    queryTimeoutMs: options.statementTimeoutMs,
  });

  let runId = null;
  try {
    await client.connect();
    if (options.ensureSchema) await ensureSchema(client);
    runId = await createRun(client, options);

    let datasetCount = 0;
    let measureCount = 0;
    let grainCount = 0;
    for (const mart of selectedMarts(options)) {
      console.log(`Profiling ${mart.martSchema}.${mart.factTable}${options.dataset ? ` for ${options.dataset}` : ""}`);
      console.log("  dataset capabilities");
      datasetCount += await profileDatasets(client, mart, runId, options.dataset);
      console.log("  measure capabilities");
      measureCount += await profileMeasures(client, mart, runId, options.dataset);
      console.log("  grain capabilities");
      grainCount += await profileGrains(client, mart, runId, options.dataset);
    }

    await finishRun(client, runId, "complete", { datasetCount, measureCount, grainCount });
    console.log(`Gold capability registry loaded: ${datasetCount} dataset(s), ${measureCount} measure(s), ${grainCount} grain profile(s).`);
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
