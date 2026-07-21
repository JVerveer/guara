#!/usr/bin/env node
import { createPostgresClient, explainPostgresConnectionError, loadLocalEnv } from "./lib/runtime.mjs";

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function argValue(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function numberArg(name, fallback) {
  const value = argValue(name, null);
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function chunks(values, size) {
  const output = [];
  for (let index = 0; index < values.length; index += size) {
    output.push(values.slice(index, index + size));
  }
  return output;
}

function isStatementTimeout(error) {
  return error?.code === "57014" || String(error?.message ?? "").toLowerCase().includes("statement timeout");
}

async function selectedContracts(client, { domain, metricCode, dataset, executableOnly, limit, offset, type, missingOnly, startAfter }) {
  const { rows } = await client.query(`
    with selected as (
      select metric_code, 'metric'::text as contract_type, selection_priority
      from semantic.metric_contract
      where is_active
        and ($1::text is null or domain_id = $1)
        and ($2::text is null or metric_code = $2)
        and ($3::text is null or $3 = any(dataset_codes))
        and ($7::text is null or $7 in ('all', 'metric'))
        and (
          not $4::boolean
          or (
            execution_status = 'enabled'
            and contract_status in ('reviewed', 'curated')
          )
        )
        and (
          not $9::boolean
          or not exists (
            select 1
            from semantic.contract_availability a
            where a.metric_code = metric_contract.metric_code
              and a.category_filter_hash = md5('{}')
          )
        )
      union all
      select contract_code as metric_code, 'category_value'::text as contract_type, selection_priority
      from semantic.category_value_contract
      where is_active
        and ($1::text is null or domain_id = $1)
        and ($2::text is null or metric_code = $2 or contract_code = $2)
        and ($3::text is null or dataset_code = $3)
        and ($7::text is null or $7 in ('all', 'category', 'category_value'))
        and (
          not $4::boolean
          or execution_status = 'enabled'
        )
        and (
          not $9::boolean
          or not exists (
            select 1
            from semantic.contract_availability a
            where a.metric_code = category_value_contract.metric_code
              and a.dataset_code = category_value_contract.dataset_code
              and a.measure_key = category_value_contract.measure_key
              and a.category_filter_hash = md5(coalesce(category_value_contract.category_filters, '{}'::jsonb)::text)
          )
          and coalesce(category_value_contract.availability_status, 'unknown') not in ('available', 'no_data', 'timeout', 'failed')
        )
    )
    select metric_code, contract_type
    from selected
    where ($8::text is null or metric_code > $8)
    order by selection_priority, metric_code
    limit nullif($5::integer, 0)
    offset $6::integer
  `, [domain, metricCode, dataset, executableOnly, limit, offset, type, startAfter, missingOnly]);
  return rows;
}

async function refreshBaseAvailability(client, metricCodes) {
  if (!metricCodes.length) return 0;
  await client.query("delete from semantic.contract_availability where metric_code = any($1::text[]) and category_filter_hash = md5('{}')", [metricCodes]);
  const { rowCount } = await client.query(`
    insert into semantic.contract_availability (
      metric_code,
      dataset_code,
      measure_key,
      geography_type,
      period_type,
      calendar_year,
      category_filter_hash,
      category_filters,
      row_count,
      geography_count,
      min_value,
      max_value,
      availability_status,
      metadata_origin,
      checked_at
    )
    select
      mc.metric_code,
      f.dataset_code,
      f.measure_key,
      coalesce(f.geography_type, 'unknown') as geography_type,
      coalesce(nullif(f.period_type, ''), 'year') as period_type,
      f.calendar_year,
      md5('{}') as category_filter_hash,
      '{}'::jsonb as category_filters,
      count(*)::bigint as row_count,
      count(distinct f.geography_key)::bigint as geography_count,
      min(f.observation_value) as min_value,
      max(f.observation_value) as max_value,
      'available' as availability_status,
      'generated' as metadata_origin,
      now() as checked_at
    from semantic.metric_contract mc
    join gold_bouwen_wonen.fact_housing_observation f
      on f.measure_key = mc.measure_key
     and f.dataset_code = any(mc.dataset_codes)
    where mc.metric_code = any($1::text[])
      and f.observation_value is not null
      and f.is_missing = false
      and f.dataset_code is not null
      and f.calendar_year is not null
    group by
      mc.metric_code,
      f.dataset_code,
      f.measure_key,
      coalesce(f.geography_type, 'unknown'),
      coalesce(nullif(f.period_type, ''), 'year'),
      f.calendar_year
    on conflict (metric_code, dataset_code, measure_key, geography_type, period_type, calendar_year, category_filter_hash)
    do update set
      category_filters = excluded.category_filters,
      row_count = excluded.row_count,
      geography_count = excluded.geography_count,
      min_value = excluded.min_value,
      max_value = excluded.max_value,
      availability_status = excluded.availability_status,
      checked_at = now()
  `, [metricCodes]);
  return rowCount ?? 0;
}

async function markCategoryContracts(client, contracts, status) {
  const categoryContractCodes = contracts.filter((row) => row.contract_type === "category_value").map((row) => row.metric_code);
  if (!categoryContractCodes.length) return;

  await client.query(`
    update semantic.category_value_contract
    set
      availability_status = $2,
      availability_checked_at = now(),
      updated_at = now()
    where contract_code = any($1::text[])
      and metadata_origin <> 'curated'
  `, [categoryContractCodes, status]);
}

async function refreshFilteredAvailability(client, contracts, { filteredTimeoutMs }) {
  if (!contracts.length) return 0;
  const metricCodes = contracts.filter((row) => row.contract_type === "metric").map((row) => row.metric_code);
  const categoryContractCodes = contracts.filter((row) => row.contract_type === "category_value").map((row) => row.metric_code);
  if (!metricCodes.length && !categoryContractCodes.length) return 0;

  await client.query("begin");
  try {
    if (filteredTimeoutMs > 0) {
      await client.query("select set_config('statement_timeout', $1, true)", [`${filteredTimeoutMs}ms`]);
    }

    await client.query(`
      delete from semantic.contract_availability
      where (
          metric_code = any($1::text[])
          or exists (
            select 1
            from semantic.category_value_contract cvc
            where cvc.contract_code = any($2::text[])
              and cvc.metric_code = contract_availability.metric_code
              and cvc.dataset_code = contract_availability.dataset_code
              and cvc.measure_key = contract_availability.measure_key
              and md5(coalesce(cvc.category_filters, '{}'::jsonb)::text) = contract_availability.category_filter_hash
          )
        )
        and category_filter_hash <> md5('{}')
    `, [metricCodes, categoryContractCodes]);

    const { rowCount } = await client.query(`
      with selected_filters as (
        select
          metric_code,
          measure_key,
          dataset_codes,
          coalesce(category_filters, '{}'::jsonb) as category_filters,
          md5(coalesce(category_filters, '{}'::jsonb)::text) as category_filter_hash
        from semantic.metric_contract
        where metric_code = any($1::text[])
          and jsonb_typeof(coalesce(category_filters, '{}'::jsonb)) = 'object'
          and coalesce(category_filters, '{}'::jsonb) <> '{}'::jsonb
        union all
        select
          b.metric_code,
          b.measure_key,
          array[b.dataset_code]::text[] as dataset_codes,
          coalesce(b.category_filters, '{}'::jsonb) as category_filters,
          md5(coalesce(b.category_filters, '{}'::jsonb)::text) as category_filter_hash
        from semantic.concept_metric_binding b
        where b.is_active
          and b.metric_code = any($1::text[])
          and jsonb_typeof(coalesce(b.category_filters, '{}'::jsonb)) = 'object'
          and coalesce(b.category_filters, '{}'::jsonb) <> '{}'::jsonb
        union all
        select
          cvc.metric_code,
          cvc.measure_key,
          array[cvc.dataset_code]::text[] as dataset_codes,
          coalesce(cvc.category_filters, '{}'::jsonb) as category_filters,
          md5(coalesce(cvc.category_filters, '{}'::jsonb)::text) as category_filter_hash
        from semantic.category_value_contract cvc
        where cvc.is_active
          and cvc.execution_status = 'enabled'
          and (
            cvc.metric_code = any($1::text[])
            or cvc.contract_code = any($2::text[])
          )
          and jsonb_typeof(coalesce(cvc.category_filters, '{}'::jsonb)) = 'object'
          and coalesce(cvc.category_filters, '{}'::jsonb) <> '{}'::jsonb
      ),
      selected_contracts as (
        select distinct on (metric_code, measure_key, category_filter_hash)
          metric_code,
          measure_key,
          dataset_codes,
          category_filters,
          category_filter_hash,
          (
            select count(*)::integer
            from jsonb_each_text(category_filters)
          ) as filter_count
        from selected_filters
        order by metric_code, measure_key, category_filter_hash
      ),
      selected_filter_values as (
        select
          sc.metric_code,
          sc.measure_key,
          sc.dataset_codes,
          sc.category_filters,
          sc.category_filter_hash,
          sc.filter_count,
          required_filter.dimension_code,
          required_filter.category_value
        from selected_contracts sc
        cross join lateral jsonb_each_text(sc.category_filters) required_filter(dimension_code, category_value)
      ),
      matched_observations as (
        select
          sc.metric_code,
          sc.measure_key,
          sc.dataset_codes,
          sc.category_filters,
          sc.category_filter_hash,
          f.dataset_code,
          f.geography_type,
          f.period_type,
          f.calendar_year,
          f.geography_key,
          f.observation_value
        from selected_contracts sc
        join gold_bouwen_wonen.fact_housing_observation f
          on f.measure_key = sc.measure_key
         and f.dataset_code = any(sc.dataset_codes)
        where f.observation_value is not null
          and f.is_missing = false
          and f.dataset_code is not null
          and f.calendar_year is not null
          and not exists (
            select 1
            from selected_filter_values sfv
            where sfv.metric_code = sc.metric_code
              and sfv.measure_key = sc.measure_key
              and sfv.category_filter_hash = sc.category_filter_hash
              and not exists (
                select 1
                from gold_bouwen_wonen.bridge_housing_observation_category c
                where c.housing_observation_key = f.housing_observation_key
                  and lower(c.dimension_code) = lower(sfv.dimension_code)
                  and (
                    c.category_name = sfv.category_value
                    or c.category_code = sfv.category_value
                  )
              )
          )
      )
      insert into semantic.contract_availability (
        metric_code,
        dataset_code,
        measure_key,
        geography_type,
        period_type,
        calendar_year,
        category_filter_hash,
        category_filters,
        row_count,
        geography_count,
        min_value,
        max_value,
        availability_status,
        metadata_origin,
        checked_at
      )
      select
        mo.metric_code,
        mo.dataset_code,
        mo.measure_key,
        coalesce(mo.geography_type, 'unknown') as geography_type,
        coalesce(nullif(mo.period_type, ''), 'year') as period_type,
        mo.calendar_year,
        mo.category_filter_hash,
        mo.category_filters,
        count(*)::bigint as row_count,
        count(distinct mo.geography_key)::bigint as geography_count,
        min(mo.observation_value) as min_value,
        max(mo.observation_value) as max_value,
        'available' as availability_status,
        'generated' as metadata_origin,
        now() as checked_at
      from matched_observations mo
      group by
        mo.metric_code,
        mo.dataset_code,
        mo.measure_key,
        coalesce(mo.geography_type, 'unknown'),
        coalesce(nullif(mo.period_type, ''), 'year'),
        mo.calendar_year,
        mo.category_filter_hash,
        mo.category_filters
      on conflict (metric_code, dataset_code, measure_key, geography_type, period_type, calendar_year, category_filter_hash)
      do update set
        category_filters = excluded.category_filters,
        row_count = excluded.row_count,
        geography_count = excluded.geography_count,
        min_value = excluded.min_value,
        max_value = excluded.max_value,
        availability_status = excluded.availability_status,
        checked_at = now()
    `, [metricCodes, categoryContractCodes]);

    await client.query("commit");
    await markCategoryContracts(client, contracts, rowCount ? "available" : "no_data");
    return rowCount ?? 0;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  }
}

async function main() {
  loadLocalEnv();
  const statementTimeoutMs = numberArg("statement-timeout-ms", 600000);
  const filteredTimeoutMs = numberArg("filtered-timeout-ms", Math.min(statementTimeoutMs || 120000, 120000));
  const client = createPostgresClient({
    applicationName: "guara-semantic-contract-availability-loader",
    statementTimeoutMs,
    queryTimeoutMs: statementTimeoutMs,
  });
  await client.connect();
  try {
    const domain = argValue("domain", "bouwen-en-wonen");
    const metricCode = argValue("metric-code", null);
    const dataset = argValue("dataset", null);
    const type = argValue("type", "all");
    const executableOnly = hasFlag("executable-only");
    const skipFiltered = hasFlag("skip-filtered");
    const skipBase = hasFlag("skip-base");
    const missingOnly = hasFlag("missing-only");
    const continueOnError = hasFlag("continue-on-error");
    const batchSize = Math.max(1, numberArg("batch-size", 25));
    const limit = numberArg("limit", 0);
    const offset = numberArg("offset", 0);
    const startAfter = argValue("start-after", null);
    const contracts = await selectedContracts(client, { domain, metricCode, dataset, executableOnly, limit, offset, type, missingOnly, startAfter });
    if (!contracts.length) {
      console.log("No semantic contracts selected for availability indexing.");
      return;
    }
    const baseMetricCodes = contracts.filter((row) => row.contract_type === "metric").map((row) => row.metric_code);
    const metricBatches = chunks(baseMetricCodes, batchSize);
    const filteredBatches = chunks(contracts, batchSize);
    let baseCount = 0;
    let filteredCount = 0;

    console.log(`Selected ${contracts.length} semantic contract(s) for availability indexing${dataset ? ` in ${dataset}` : ""}. Batch size: ${batchSize}.`);

    if (!skipBase) {
      for (let index = 0; index < metricBatches.length; index += 1) {
        const batch = metricBatches[index];
        console.log(`Base availability batch ${index + 1}/${metricBatches.length}: ${batch.length} metric contract(s).`);
        try {
          baseCount += await refreshBaseAvailability(client, batch);
        } catch (error) {
          console.error(`Base availability batch failed: ${batch.join(", ")}`);
          if (!continueOnError) throw error;
          console.error(explainPostgresConnectionError(error));
        }
      }
    }

    if (!skipFiltered) {
      for (let index = 0; index < filteredBatches.length; index += 1) {
        const batch = filteredBatches[index];
        console.log(`Filtered availability batch ${index + 1}/${filteredBatches.length}: ${batch.length} contract(s): ${batch.map((row) => row.metric_code).join(", ")}`);
        try {
          filteredCount += await refreshFilteredAvailability(client, batch, { filteredTimeoutMs });
        } catch (error) {
          console.error(`Filtered availability batch failed: ${batch.map((row) => row.metric_code).join(", ")}`);
          if (isStatementTimeout(error)) {
            await markCategoryContracts(client, batch, "timeout").catch((markError) => {
              console.error(`Could not mark timed-out contract(s): ${explainPostgresConnectionError(markError)}`);
            });
          }
          if (!continueOnError) throw error;
          console.error(explainPostgresConnectionError(error));
        }
      }
    }

    await client.query("notify pgrst, 'reload schema'");
    console.log(`Indexed semantic contract availability for ${contracts.length} contract(s): ${baseCount} base row(s), ${filteredCount} filtered row(s).`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(explainPostgresConnectionError(error));
  process.exitCode = 1;
});
