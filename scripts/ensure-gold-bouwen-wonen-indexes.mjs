#!/usr/bin/env node
import { createPostgresClient, explainPostgresConnectionError, loadLocalEnv } from "./lib/runtime.mjs";

const indexes = [
  {
    name: "silver.cbs_observation_dimensions(dataset_id, row_id)",
    schema: "silver",
    indexName: "cbs_observation_dimensions_dataset_row_idx",
    sql: `
      create index concurrently if not exists cbs_observation_dimensions_dataset_row_idx
      on silver.cbs_observation_dimensions (dataset_id, row_id)
    `,
  },
  {
    name: "silver.cbs_observation_measures(dataset_id, row_id)",
    schema: "silver",
    indexName: "cbs_observation_measures_dataset_row_idx",
    sql: `
      create index concurrently if not exists cbs_observation_measures_dataset_row_idx
      on silver.cbs_observation_measures (dataset_id, row_id)
    `,
  },
  {
    name: "gold_bouwen_wonen.fact_housing_observation(housing_dataset_key, source_row_id)",
    schema: "gold_bouwen_wonen",
    indexName: "fact_housing_observation_dataset_source_row_idx",
    sql: `
      create index concurrently if not exists fact_housing_observation_dataset_source_row_idx
      on gold_bouwen_wonen.fact_housing_observation (housing_dataset_key, source_row_id)
    `,
  },
  {
    name: "gold_bouwen_wonen.fact_housing_observation(housing_dataset_key, housing_observation_key)",
    schema: "gold_bouwen_wonen",
    indexName: "fact_housing_observation_dataset_observation_idx",
    sql: `
      create index concurrently if not exists fact_housing_observation_dataset_observation_idx
      on gold_bouwen_wonen.fact_housing_observation (housing_dataset_key, housing_observation_key)
    `,
  },
  {
    name: "gold_bouwen_wonen.fact_housing_observation(source_dataset_id)",
    schema: "gold_bouwen_wonen",
    indexName: "fact_housing_observation_source_dataset_idx",
    sql: `
      create index concurrently if not exists fact_housing_observation_source_dataset_idx
      on gold_bouwen_wonen.fact_housing_observation (source_dataset_id)
    `,
  },
  {
    name: "gold_bouwen_wonen.fact_housing_observation(dataset_code, measure_key, housing_observation_key)",
    schema: "gold_bouwen_wonen",
    indexName: "fact_housing_observation_dataset_measure_observation_idx",
    sql: `
      create index concurrently if not exists fact_housing_observation_dataset_measure_observation_idx
      on gold_bouwen_wonen.fact_housing_observation (dataset_code, measure_key, housing_observation_key)
      where observation_value is not null and is_missing = false and calendar_year is not null
    `,
  },
  {
    name: "gold_bouwen_wonen.fact_housing_observation(measure_key, geography_type, calendar_year, housing_observation_key)",
    schema: "gold_bouwen_wonen",
    indexName: "fact_housing_observation_measure_geo_year_observation_idx",
    sql: `
      create index concurrently if not exists fact_housing_observation_measure_geo_year_observation_idx
      on gold_bouwen_wonen.fact_housing_observation (measure_key, geography_type, calendar_year, housing_observation_key)
      where observation_value is not null and is_missing = false and calendar_year is not null
    `,
  },
  {
    name: "gold_bouwen_wonen.bridge_housing_observation_category(lower(dimension_code), category_name)",
    schema: "gold_bouwen_wonen",
    indexName: "bridge_housing_observation_category_dimension_name_idx",
    sql: `
      create index concurrently if not exists bridge_housing_observation_category_dimension_name_idx
      on gold_bouwen_wonen.bridge_housing_observation_category (lower(dimension_code), category_name, housing_observation_key)
    `,
  },
  {
    name: "gold_bouwen_wonen.bridge_housing_observation_category(lower(dimension_code), category_code)",
    schema: "gold_bouwen_wonen",
    indexName: "bridge_housing_observation_category_dimension_code_idx",
    sql: `
      create index concurrently if not exists bridge_housing_observation_category_dimension_code_idx
      on gold_bouwen_wonen.bridge_housing_observation_category (lower(dimension_code), category_code, housing_observation_key)
    `,
  },
];

async function dropInvalidIndex(client, index) {
  const result = await client.query(
    `
      select i.indisvalid
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_index i on i.indexrelid = c.oid
      where n.nspname = $1 and c.relname = $2
    `,
    [index.schema, index.indexName]
  );

  if (result.rows.length === 0 || result.rows[0].indisvalid) return;

  console.log(`  dropping invalid index stub: ${index.schema}.${index.indexName}`);
  await client.query(`drop index concurrently if exists ${index.schema}.${index.indexName}`);
}

async function main() {
  loadLocalEnv();
  const client = createPostgresClient({
    applicationName: "guara-gold-bouwen-wonen-indexes",
    statementTimeoutMs: 0,
    queryTimeoutMs: 0,
  });

  try {
    await client.connect();
    await client.query("set statement_timeout = 0");
    await client.query("set lock_timeout = '30s'");

    for (const index of indexes) {
      console.log(`Ensuring index: ${index.name}`);
      await dropInvalidIndex(client, index);
      await client.query(index.sql);
      console.log(`  ok: ${index.name}`);
    }
  } catch (error) {
    throw new Error(explainPostgresConnectionError(error));
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
