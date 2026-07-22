#!/usr/bin/env node
import { createPostgresClient, explainPostgresConnectionError, loadLocalEnv } from "./lib/runtime.mjs";

function argValue(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

async function ensureSchema(client) {
  await client.query(`
    create table if not exists semantic.metric_contract_observation (
      metric_code text not null,
      housing_observation_key bigint not null,
      dataset_code text not null,
      measure_key bigint not null,
      category_filter_hash text not null,
      metadata_origin text not null default 'generated',
      indexed_at timestamptz not null default now(),
      primary key (metric_code, housing_observation_key)
    )
  `);
  await client.query(`
    create index if not exists semantic_metric_contract_observation_lookup_idx
    on semantic.metric_contract_observation(metric_code, measure_key, dataset_code, housing_observation_key)
  `);
}

async function selectedContracts(client, metricCode) {
  const { rows } = await client.query(`
    select
      metric_code,
      dataset_codes[1] as dataset_code,
      measure_key,
      coalesce(category_filters, '{}'::jsonb) as category_filters,
      md5(coalesce(category_filters, '{}'::jsonb)::text) as category_filter_hash,
      metadata_origin
    from semantic.metric_contract
    where is_active
      and execution_status = 'enabled'
      and jsonb_typeof(coalesce(category_filters, '{}'::jsonb)) = 'object'
      and coalesce(category_filters, '{}'::jsonb) <> '{}'::jsonb
      and ($1::text is null or metric_code = $1)
    order by selection_priority, metric_code
  `, [metricCode]);
  return rows;
}

async function loadContract(client, contract) {
  await client.query("delete from semantic.metric_contract_observation where metric_code = $1", [contract.metric_code]);

  const { rows: availableSlices } = await client.query(`
    select distinct dataset_code, geography_type, calendar_year
    from semantic.contract_availability
    where metric_code = $1
      and dataset_code = $2
      and measure_key = $3
      and category_filter_hash = $4
      and row_count > 0
      and calendar_year is not null
    order by dataset_code, geography_type, calendar_year
  `, [
    contract.metric_code,
    contract.dataset_code,
    contract.measure_key,
    contract.category_filter_hash,
  ]);

  if (!availableSlices.length) {
    return loadContractWithoutSlices(client, contract);
  }

  let total = 0;
  for (const slice of availableSlices) {
    const { rowCount } = await client.query(`
      insert into semantic.metric_contract_observation (
        metric_code,
        housing_observation_key,
        dataset_code,
        measure_key,
        category_filter_hash,
        metadata_origin,
        indexed_at
      )
      with candidate_fact_rows as materialized (
        select
          f.housing_observation_key,
          f.dataset_code,
          f.measure_key
        from gold_bouwen_wonen.fact_housing_observation f
        where f.measure_key = $2::bigint
          and f.dataset_code = $3::text
          and f.geography_type = $7::text
          and f.calendar_year = $8::integer
          and f.observation_value is not null
          and f.is_missing = false
      ),
      required_filters as materialized (
        select lower(dimension_code) as dimension_code, category_value
        from jsonb_each_text($4::jsonb) required_filter(dimension_code, category_value)
      ),
      required_filter_count as materialized (
        select count(*)::integer as value from required_filters
      ),
      matching_observation_keys as materialized (
        select c.housing_observation_key
        from candidate_fact_rows candidate
        join gold_bouwen_wonen.bridge_housing_observation_category c
          on c.housing_observation_key = candidate.housing_observation_key
        join required_filters rf
          on lower(c.dimension_code) = rf.dimension_code
         and (c.category_name = rf.category_value or c.category_code = rf.category_value)
        group by c.housing_observation_key
        having count(distinct lower(c.dimension_code)) = (select value from required_filter_count)
      )
      select
        $1::text as metric_code,
        f.housing_observation_key,
        f.dataset_code,
        f.measure_key,
        $5::text as category_filter_hash,
        $6::text as metadata_origin,
        now() as indexed_at
      from candidate_fact_rows f
      join matching_observation_keys k
        on k.housing_observation_key = f.housing_observation_key
      on conflict (metric_code, housing_observation_key) do update set
        dataset_code = excluded.dataset_code,
        measure_key = excluded.measure_key,
        category_filter_hash = excluded.category_filter_hash,
        metadata_origin = excluded.metadata_origin,
        indexed_at = now()
    `, [
      contract.metric_code,
      contract.measure_key,
      contract.dataset_code,
      JSON.stringify(contract.category_filters ?? {}),
      contract.category_filter_hash,
      contract.metadata_origin ?? "generated",
      slice.geography_type,
      slice.calendar_year,
    ]);
    total += rowCount ?? 0;
  }

  return total;
}

async function loadContractWithoutSlices(client, contract) {
  const { rowCount } = await client.query(`
    insert into semantic.metric_contract_observation (
      metric_code,
      housing_observation_key,
      dataset_code,
      measure_key,
      category_filter_hash,
      metadata_origin,
      indexed_at
    )
    with required_filters as materialized (
      select lower(dimension_code) as dimension_code, category_value
      from jsonb_each_text($4::jsonb) required_filter(dimension_code, category_value)
    ),
    required_filter_count as materialized (
      select count(*)::integer as value from required_filters
    ),
    matching_observation_keys as materialized (
      select c.housing_observation_key
      from gold_bouwen_wonen.bridge_housing_observation_category c
      join required_filters rf
        on lower(c.dimension_code) = rf.dimension_code
       and (c.category_name = rf.category_value or c.category_code = rf.category_value)
      group by c.housing_observation_key
      having count(distinct lower(c.dimension_code)) = (select value from required_filter_count)
    )
    select
      $1::text as metric_code,
      f.housing_observation_key,
      f.dataset_code,
      f.measure_key,
      $5::text as category_filter_hash,
      $6::text as metadata_origin,
      now() as indexed_at
    from gold_bouwen_wonen.fact_housing_observation f
    join matching_observation_keys k on k.housing_observation_key = f.housing_observation_key
    where f.measure_key = $2::bigint
      and f.dataset_code = $3::text
      and f.observation_value is not null
      and f.is_missing = false
    on conflict (metric_code, housing_observation_key) do update set
      dataset_code = excluded.dataset_code,
      measure_key = excluded.measure_key,
      category_filter_hash = excluded.category_filter_hash,
      metadata_origin = excluded.metadata_origin,
      indexed_at = now()
  `, [
    contract.metric_code,
    contract.measure_key,
    contract.dataset_code,
    JSON.stringify(contract.category_filters ?? {}),
    contract.category_filter_hash,
    contract.metadata_origin ?? "generated",
  ]);
  return rowCount ?? 0;
}

async function main() {
  loadLocalEnv();
  const metricCode = argValue("metric-code", null);
  const client = createPostgresClient({
    applicationName: "guara-semantic-contract-observation-loader",
    statementTimeoutMs: 600000,
    queryTimeoutMs: 600000,
  });
  await client.connect();
  try {
    await ensureSchema(client);
    const contracts = await selectedContracts(client, metricCode);
    if (!contracts.length) {
      console.log("No filtered metric contracts selected.");
      return;
    }
    let total = 0;
    for (const contract of contracts) {
      console.log(`Indexing filtered observations for ${contract.metric_code}`);
      const count = await loadContract(client, contract);
      total += count;
      console.log(`  ${contract.metric_code}: ${count} observation key(s)`);
    }
    console.log(`Indexed ${total} filtered observation key(s) for ${contracts.length} contract(s).`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(explainPostgresConnectionError(error));
  process.exitCode = 1;
});
